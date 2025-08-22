// server.js
const express = require("express");
const app = express();
const http = require("http").createServer(app);
const { Server } = require("socket.io");
const io = new Server(http, { 
  cors: { 
    origin: "*",
    methods: ["GET", "POST"],
    credentials: true
  },
  transports: ["websocket", "polling"],
  allowEIO3: true,
  pingTimeout: 60000,
  pingInterval: 25000,
  upgradeTimeout: 10000
});

app.use(express.static("public"));

/**
 * rooms = {
 *   [roomId]: {
 *     revealed: false,
 *     currentTask: string,
 *     history: Array<{ task: string, votes: Record<string,string>, stats: object, revealedAt: number }>,
 *     users: { [socketId]: { id, name } },
 *     votes: { [socketId]: "card" },
 *     owner: string // Oda sahibinin socket ID'si
 *   }
 * }
 */
const rooms = {};

// Oda sahibi kontrolü
function isRoomOwner(roomId, socketId) {
  const room = rooms[roomId];
  return room && room.owner === socketId;
}

function roomState(roomId, revealedOnly=false) {
  const r = rooms[roomId] || { revealed:false, currentTask:"", history:[], users:{}, votes:{} };
  const usersArr = Object.values(r.users); // [{id,name}, ...]
  
  const state = {
    roomId,
    revealed: r.revealed,
    currentTask: r.currentTask || "",
    history: r.history || [],
    users: usersArr,
    votes: r.revealed ? r.votes : {}, // reveal olmadan kimseye oyları göstermeyiz
    voted: Object.keys(r.votes), // Bu her zaman doğru oy sayısını verir
    voteCount: Object.keys(r.votes).length, // Bu her zaman doğru oy sayısını verir
    owner: r.owner || null // Oda sahibinin socket ID'si
  };
  
  // Debug için console.log ekle
  console.log(`Room ${roomId} State:`, {
    revealed: r.revealed,
    currentTask: r.currentTask,
    votes: r.votes,
    voted: Object.keys(r.votes),
    voteCount: Object.keys(r.votes).length,
    owner: r.owner
  });
  
  return state;
}

// Global istatistikleri hesapla
function getGlobalStats() {
  const totalRooms = Object.keys(rooms).length;
  let totalUsers = 0;
  let totalVotes = 0;
  let allVotes = [];
  
  // Tüm odalardaki kullanıcıları ve oyları topla
  Object.values(rooms).forEach(room => {
    totalUsers += Object.keys(room.users || {}).length;
    const roomVotes = Object.values(room.votes || {});
    totalVotes += roomVotes.length;
    allVotes.push(...roomVotes);
  });
  
  // Ortalama puanı hesapla
  const voteMap = { "0":0, "½":0.5, "1":1, "2":2, "3":3, "5":5, "8":8, "13":13, "21":21 };
  const numericVotes = allVotes
    .map(v => voteMap[v])
    .filter(v => typeof v === "number");
  
  const avgPoints = numericVotes.length > 0 
    ? (numericVotes.reduce((a, b) => a + b, 0) / numericVotes.length).toFixed(1)
    : "0.0";
  
  return {
    totalRooms,
    activeUsers: totalUsers,
    totalVotes,
    avgPoints: avgPoints
  };
}

// Son aktiviteleri getir
function getRecentActivities() {
  const activities = [];
  const now = Date.now();
  
  // Tüm odalardaki son aktiviteleri topla
  Object.entries(rooms).forEach(([roomId, room]) => {
    // Son reveal aktiviteleri
    if (room.history && room.history.length > 0) {
      room.history.forEach((item, index) => {
        const timeDiff = now - item.revealedAt;
        const minutes = Math.floor(timeDiff / (1000 * 60));
        const hours = Math.floor(timeDiff / (1000 * 60 * 60));
        
        let timeText;
        if (minutes < 1) timeText = "Şimdi";
        else if (minutes < 60) timeText = `${minutes} dk önce`;
        else if (hours < 24) timeText = `${hours} saat önce`;
        else timeText = `${Math.floor(hours / 24)} gün önce`;
        
        activities.push({
          time: timeText,
          text: `"${item.task}" görevi için oylama tamamlandı`,
          roomId: roomId,
          timestamp: item.revealedAt,
          type: 'reveal'
        });
      });
    }
    
    // Oda aktiviteleri (kullanıcı katılımı, görev ayarlama)
    if (room.activities && room.activities.length > 0) {
      room.activities.forEach((activity) => {
        const timeDiff = now - activity.timestamp;
        const minutes = Math.floor(timeDiff / (1000 * 60));
        const hours = Math.floor(timeDiff / (1000 * 60 * 60));
        
        let timeText;
        if (minutes < 1) timeText = "Şimdi";
        else if (minutes < 60) timeText = `${minutes} dk önce`;
        else if (hours < 24) timeText = `${hours} saat önce`;
        else timeText = `${Math.floor(hours / 24)} gün önce`;
        
        activities.push({
          time: timeText,
          text: activity.text,
          roomId: roomId,
          timestamp: activity.timestamp,
          type: activity.type
        });
      });
    }
    
    // Aktif kullanıcı sayısı (sadece aktif odalar için)
    const userCount = Object.keys(room.users || {}).length;
    if (userCount > 0) {
      activities.push({
        time: "Şimdi",
        text: `${roomId} odasında ${userCount} kullanıcı aktif`,
        roomId: roomId,
        timestamp: now,
        type: 'active'
      });
    }
  });
  
  // Zaman damrasına göre sırala (en yeni önce)
  activities.sort((a, b) => b.timestamp - a.timestamp);
  
  // En son 8 aktiviteyi döndür
  return activities.slice(0, 8);
}

function calcStatsFromVotes(votes) {
  const map = { "0":0, "½":0.5, "1":1, "2":2, "3":3, "5":5, "8":8, "13":13, "21":21 };
  const nums = Object.values(votes)
    .map((v) => map[v])
    .filter((v) => typeof v === "number");
  if (nums.length === 0) {
    return { count: 0, distribution: {}, average: null, median: null, mode: null, summary: "Geçerli oy yok." };
  }
  nums.sort((a,b) => a-b);
  const sum = nums.reduce((a,b)=>a+b,0);
  const average = sum / nums.length;
  const mid = Math.floor(nums.length/2);
  const median = nums.length % 2 ? nums[mid] : (nums[mid-1] + nums[mid]) / 2;
  const freq = {};
  nums.forEach(n => { freq[n] = (freq[n]||0)+1; });
  const maxF = Math.max(...Object.values(freq));
  const mode = Object.keys(freq).filter(k => Number(freq[k]) === maxF).map(Number);
  const dist = {};
  Object.values(votes).forEach(v => { dist[v] = (dist[v]||0)+1; });
  
  // Dağılımı daha anlaşılır hale getir
  const distText = Object.entries(dist).map(([k,c]) => {
    if (k === "☕") return `${c} kişi mola istedi`;
    if (k === "?") return `${c} kişi belirsiz`;
    if (k === "½") return `${c} kişi 0.5 puan`;
    return `${c} kişi ${k} puan`;
  }).join("\n");
  
  const summary = `${distText}

📊 Özet: Ortalama ${average.toFixed(1)} | Medyan ${median} | En çok ${mode.join(", ")}`;
  return { count: nums.length, distribution: dist, average, median, mode, summary };
}

io.on("connection", (socket) => {
  socket.data.roomId = null;

  socket.on("join", ({ roomId, name }) => {
    if (!roomId || !name) return;

    // Oda kodunu case-insensitive yap (küçük harfe çevir)
    const normalizedRoomId = roomId.toLowerCase();

    if (!rooms[normalizedRoomId]) {
      rooms[normalizedRoomId] = { 
        revealed:false, 
        currentTask:"", 
        history:[], 
        users:{}, 
        votes:{},
        owner: socket.id // İlk kullanıcı oda sahibi olur
      };
    }

    // Aynı isimleri benzersizleştir
    const existingNames = new Set(Object.values(rooms[normalizedRoomId].users).map(u => u.name));
    let finalName = name;
    
    console.log(`Join attempt - Room: ${normalizedRoomId}, Name: ${name}`);
    console.log(`Room users object:`, rooms[normalizedRoomId].users);
    console.log(`Existing names array:`, Array.from(existingNames));
    console.log(`Existing names size:`, existingNames.size);
    console.log(`Is name "${name}" in existing names?`, existingNames.has(name));
    console.log(`Is finalName "${finalName}" in existing names?`, existingNames.has(finalName));
    
    // Eğer bu isim zaten varsa, suffix ekle
    if (existingNames.has(finalName)) {
      console.log(`Name ${name} already exists, adding suffix...`);
      let i = 1; 
      
      do {
        // Her seferinde -i şeklinde suffix ekle
        finalName = `${name}-${i}`;
        
        console.log(`Trying suffix ${i}: "${finalName}"`);
        console.log(`Is "${finalName}" in existing names?`, existingNames.has(finalName));
        i++;
      } while (existingNames.has(finalName));
      console.log(`Final name with suffix: ${finalName}`);
    } else {
      console.log(`Name ${name} is unique, no suffix needed`);
    }
    
    // Debug: Final name'i kontrol et
    console.log(`Final name that will be used: "${finalName}"`);

    rooms[normalizedRoomId].users[socket.id] = { id: socket.id, name: finalName };
    socket.join(normalizedRoomId);
    socket.data.roomId = normalizedRoomId;

    // Kendi görünen adını gönder
    socket.emit("me", { id: socket.id, name: finalName });

    // Oda durumunu herkese yayınla
    io.to(normalizedRoomId).emit("state", roomState(normalizedRoomId));
    // Ayrı bir history yayını da yap (istemciler direkt listeyi güncellesin)
    io.to(normalizedRoomId).emit("history", rooms[normalizedRoomId].history || []);
    
    // Yeni kullanıcıya hemen state gönder - gecikmeyi önle
    socket.emit("state", roomState(normalizedRoomId));
    socket.emit("history", rooms[normalizedRoomId].history || []);
    
    // Yeni kullanıcı katıldı aktivitesi ekle
    if (!rooms[normalizedRoomId].activities) rooms[normalizedRoomId].activities = [];
    rooms[normalizedRoomId].activities.unshift({
      type: 'join',
      text: `${finalName} odaya katıldı`,
      timestamp: Date.now(),
      user: finalName
    });
    
    // Sadece son 10 aktiviteyi tut
    if (rooms[normalizedRoomId].activities.length > 10) {
      rooms[normalizedRoomId].activities = rooms[normalizedRoomId].activities.slice(0, 10);
    }
  });

  socket.on("vote", (card, ack) => {
    const roomId = socket.data.roomId;
    if (!roomId || !rooms[roomId]) return;
    
    // Görev aktif değilse oy kabul etmeyelim
    const taskName = (rooms[roomId].currentTask || "").trim();
    if (!taskName) {
      if (typeof ack === "function") ack({ ok:false, reason: "Önce görev adını ayarlamalısınız." });
      return;
    }
    
    // Reveal edilmiş turda oy kabul etmeyelim
    if (rooms[roomId].revealed) {
      if (typeof ack === "function") ack({ ok:false, reason: "Reveal sonrası oy alınmaz." });
      return;
    }

    const deck = ["0","½","1","2","3","5","8","13","21","?","☕"];
    if (!deck.includes(card)) {
      if (typeof ack === "function") ack({ ok:false, reason: "Geçersiz kart." });
      return;
    }

    rooms[roomId].votes[socket.id] = card;
    console.log(`Vote received: ${card} from ${socket.id} in room ${roomId}. Total votes: ${Object.keys(rooms[roomId].votes).length}`);
    console.log(`Room ${roomId} votes after vote:`, rooms[roomId].votes);

    // Reveal olmadan oyları yayınlamıyoruz; sadece state (count) yenilensin diye
    io.to(roomId).emit("state", roomState(roomId));
    if (typeof ack === "function") ack({ ok:true });
  });

  // İstemci mevcut odayı tekrar istemek istediğinde
  socket.on("getState", () => {
    const roomId = socket.data.roomId;
    if (!roomId || !rooms[roomId]) return;
    socket.emit("state", roomState(roomId));
    socket.emit("history", rooms[roomId].history || []);
  });

  // İstatistikleri getir
  socket.on("getStats", (ack) => {
    const stats = getGlobalStats();
    if (typeof ack === "function") ack(stats);
  });

  // Son aktiviteleri getir
  socket.on("getRecentActivities", (ack) => {
    const activities = getRecentActivities();
    if (typeof ack === "function") ack(activities);
  });

  socket.on("setTask", (task, ack) => {
    const roomId = socket.data.roomId;
    if (!roomId || !rooms[roomId]) return;
    
    // Sadece oda sahibi görev ekleyebilir
    if (!isRoomOwner(roomId, socket.id)) {
      console.log(`SetTask blocked: ${socket.id} is not room owner in room ${roomId}`);
      if (typeof ack === "function") ack({ ok:false, reason: "Sadece oda sahibi görev ekleyebilir." });
      return;
    }
    
    const t = String(task || "").trim();
    // Reveal sonrası görev değiştirilmesin
    if (rooms[roomId].revealed) {
      if (typeof ack === "function") ack({ ok:false, reason: "Reveal sonrası görev değiştirilemez." });
      return;
    }
    rooms[roomId].currentTask = t;
    console.log(`Task set: "${t}" in room ${roomId}`);
    
    // Görev ayarlandı aktivitesi ekle
    if (!rooms[roomId].activities) rooms[roomId].activities = [];
    rooms[roomId].activities.unshift({
      type: 'task',
      text: `"${t}" görevi ayarlandı`,
      timestamp: Date.now(),
      task: t
    });
    
    // Sadece son 10 aktiviteyi tut
    if (rooms[roomId].activities.length > 10) {
      rooms[roomId].activities = rooms[roomId].activities.slice(0, 10);
    }
    
    io.to(roomId).emit("state", roomState(roomId));
    io.to(roomId).emit("history", rooms[roomId].history || []);
    if (typeof ack === "function") ack({ ok:true, task: t });
  });

  socket.on("reveal", (ack) => {
    const roomId = socket.data.roomId;
    if (!roomId || !rooms[roomId]) return;
    
    // Sadece oda sahibi reveal yapabilir
    if (!isRoomOwner(roomId, socket.id)) {
      console.log(`Reveal blocked: ${socket.id} is not room owner in room ${roomId}`);
      if (typeof ack === "function") ack({ ok:false, reason: "Sadece oda sahibi reveal yapabilir." });
      return;
    }
    
    // Görev adı boşsa reveal'ı engelle (scrum mantığı: görev + oy)
    const taskName = (rooms[roomId].currentTask || "").trim();
    if (!taskName) {
      console.log(`Reveal blocked: No task name in room ${roomId}`);
      if (typeof ack === "function") ack({ ok:false, reason: "Önce görev adını kaydetmelisin." });
      return;
    }
    // En az bir oy şartı
    const hasAnyVote = Object.keys(rooms[roomId].votes || {}).length > 0;
    if (!hasAnyVote) {
      console.log(`Reveal blocked: No votes in room ${roomId}. Votes:`, rooms[roomId].votes);
      if (typeof ack === "function") ack({ ok:false, reason: "Reveal için en az bir oy gerekli." });
      return;
    }
    console.log(`Reveal successful in room ${roomId}. Task: "${taskName}", Votes:`, rooms[roomId].votes);
    rooms[roomId].revealed = true;
    // Tarihçeye ekle
    const snapshotVotes = { ...rooms[roomId].votes };
    const stats = calcStatsFromVotes(snapshotVotes);
    rooms[roomId].history = rooms[roomId].history || [];
    rooms[roomId].history.unshift({
      task: taskName,
      votes: snapshotVotes,
      stats,
      revealedAt: Date.now()
    });
    io.to(roomId).emit("state", roomState(roomId));
    io.to(roomId).emit("history", rooms[roomId].history || []);
    if (typeof ack === "function") ack({ ok:true });
  });

  socket.on("reset", (ack) => {
    const roomId = socket.data.roomId;
    if (!roomId || !rooms[roomId]) return;
    
    // Sadece oda sahibi reset yapabilir
    if (!isRoomOwner(roomId, socket.id)) {
      console.log(`Reset blocked: ${socket.id} is not room owner in room ${roomId}`);
      if (typeof ack === "function") ack({ ok:false, reason: "Sadece oda sahibi reset yapabilir." });
      return;
    }
    
    rooms[roomId].revealed = false;
    rooms[roomId].votes = {};
    rooms[roomId].currentTask = ''; // Aktif görevi de sıfırla
    rooms[roomId].voted = []; // Oy veren listesini de sıfırla
    rooms[roomId].voteCount = 0; // Oy sayacını da sıfırla
    io.to(roomId).emit("state", roomState(roomId));
    io.to(roomId).emit("history", rooms[roomId].history || []);
    console.log(`Reset successful in room ${roomId}. Task and votes cleared.`);
    if (typeof ack === "function") ack({ ok:true });
  });

  socket.on("leave", () => {
    const roomId = socket.data.roomId;
    if (!roomId || !rooms[roomId]) return;
    
    // Kullanıcıyı odadan çıkar
    delete rooms[roomId].users[socket.id];
    delete rooms[roomId].votes[socket.id];
    
    // Odadan ayrıl
    socket.leave(roomId);
    socket.data.roomId = null;
    
    // Oda boşsa sil
    const empty = Object.keys(rooms[roomId].users).length === 0;
    if (empty) {
      delete rooms[roomId];
    } else {
      // Oda sahibi ayrıldıysa yeni oda sahibi ata
      if (rooms[roomId].owner === socket.id) {
        const remainingUsers = Object.keys(rooms[roomId].users);
        if (remainingUsers.length > 0) {
          rooms[roomId].owner = remainingUsers[0]; // İlk kalan kullanıcıyı oda sahibi yap
          console.log(`New room owner assigned: ${remainingUsers[0]} in room ${roomId}`);
        }
      }
      
      // Diğer kullanıcılara güncel durumu gönder
      io.to(roomId).emit("state", roomState(roomId));
    }
    
    // Çıkan kullanıcıya onay gönder
    socket.emit("left", { ok: true });
    
    // Kullanıcı çıktı aktivitesi ekle
    if (rooms[roomId] && rooms[roomId].activities) {
      const userName = rooms[roomId].users[socket.id]?.name || 'Bilinmeyen kullanıcı';
      rooms[roomId].activities.unshift({
        type: 'leave',
        text: `${userName} odadan ayrıldı`,
        timestamp: Date.now(),
        user: userName
      });
      
      // Sadece son 10 aktiviteyi tut
      if (rooms[roomId].activities.length > 10) {
        rooms[roomId].activities = rooms[roomId].activities.slice(0, 10);
      }
    }
  });

  socket.on("disconnect", () => {
    const roomId = socket.data.roomId;
    if (!roomId || !rooms[roomId]) return;
    
    // Kullanıcı çıktı aktivitesi ekle
    if (rooms[roomId].activities) {
      const userName = rooms[roomId].users[socket.id]?.name || 'Bilinmeyen kullanıcı';
      rooms[roomId].activities.unshift({
        type: 'disconnect',
        text: `${userName} bağlantısı kesildi`,
        timestamp: Date.now(),
        user: userName
      });
      
      // Sadece son 10 aktiviteyi tut
      if (rooms[roomId].activities.length > 10) {
        rooms[roomId].activities = rooms[roomId].activities.slice(0, 10);
      }
    }
    
    delete rooms[roomId].users[socket.id];
    delete rooms[roomId].votes[socket.id];
    
    const empty = Object.keys(rooms[roomId].users).length === 0;
    if (empty) {
      delete rooms[roomId];
    } else {
      // Oda sahibi ayrıldıysa yeni oda sahibi ata
      if (rooms[roomId].owner === socket.id) {
        const remainingUsers = Object.keys(rooms[roomId].users);
        if (remainingUsers.length > 0) {
          rooms[roomId].owner = remainingUsers[0]; // İlk kalan kullanıcıyı oda sahibi yap
          console.log(`New room owner assigned: ${remainingUsers[0]} in room ${roomId}`);
        }
      }
      
      io.to(roomId).emit("state", roomState(roomId));
    }
  });
});

const PORT = process.env.PORT || 3001;
http.listen(PORT, () => {
  console.log(`🚀 Server çalışıyor: http://localhost:${PORT}`);
  console.log("📡 Socket.IO aktif ve bağlantıları kabul ediyor");
  console.log("🎯 Aktiviteler ve istatistikler canlı olarak takip ediliyor");
});
