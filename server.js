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
  
  // Kullanıcıların lastSeen bilgisini güncelle
  const now = Date.now();
  Object.values(r.users).forEach(user => {
    if (!user.lastSeen) {
      user.lastSeen = now;
    }
  });
  
  const usersArr = Object.values(r.users); // [{id,name,lastSeen}, ...]
  
  const state = {
    roomId,
    revealed: r.revealed,
    currentTask: r.currentTask || "",
    history: r.history || [],
    users: usersArr,
    votes: r.revealed ? r.votes : {}, // reveal olmadan kimseye oyları göstermeyiz
    voted: Object.keys(r.votes), // Bu her zaman doğru oy sayısını verir
    voteCount: Object.keys(r.votes).length, // Bu her zaman doğru oy sayısını verir
    owner: r.owner || null, // Oda sahibinin socket ID'si
    theme: r.theme || 'poker' // Oda teması
  };
  
  // Debug için console.log ekle
  console.log(`Room ${roomId} State:`, {
    revealed: r.revealed,
    currentTask: r.currentTask,
    votes: r.votes,
    voted: Object.keys(r.votes),
    voteCount: Object.keys(r.votes).length,
    owner: r.owner,
    userCount: usersArr.length
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
    // Sadece aktif kullanıcıları say (son 5 dakika içinde aktif olan)
    const now = Date.now();
    const activeUsers = Object.values(room.users || {}).filter(user => {
      return user.lastSeen && (now - user.lastSeen) < (5 * 60 * 1000); // 5 dakika
    });
    totalUsers += activeUsers.length;
    
    // Sadece aktif oyları say (son 10 dakika içinde verilen)
    const activeVotes = Object.entries(room.votes || {}).filter(([userId, vote]) => {
      const user = room.users[userId];
      return user && user.lastSeen && (now - user.lastSeen) < (10 * 60 * 1000); // 10 dakika
    });
    totalVotes += activeVotes.length;
    
    // Aktif oyları ekle
    activeVotes.forEach(([userId, vote]) => {
      allVotes.push(vote);
    });
  });
  
  // Ortalama puanı hesapla
  const voteMap = { "0":0, "½":0.5, "1":1, "2":2, "3":3, "5":5, "8":8, "13":13, "21":21 };
  const numericVotes = allVotes
    .map(v => voteMap[v])
    .filter(v => typeof v === "number");
  
  const avgPoints = numericVotes.length > 0 
    ? (numericVotes.reduce((a, b) => a + b, 0) / numericVotes.length).toFixed(1)
    : "0.0";
  
  console.log(`📊 Global Stats: ${totalRooms} rooms, ${totalUsers} users, ${totalVotes} votes, ${avgPoints} avg`);
  
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
  // Tüm tema kartlarını destekle
  const allMaps = {
    // Poker kartları
    poker: { "0":0, "½":0.5, "1":1, "2":2, "3":3, "5":5, "8":8, "13":13, "21":21, "34":34, "55":55, "89":89 },
    // T-shirt boyutları
    tshirt: { "XXS":0.5, "XS":1, "S":2, "M":3, "L":5, "XL":8, "XXL":13, "XXXL":21 },
    // Saat
    time: { "15m":0.25, "30m":0.5, "45m":0.75, "1h":1, "1.5h":1.5, "2h":2, "3h":3, "4h":4, "6h":6, "8h":8, "12h":12, "16h":16, "24h":24, "2d":48, "3d":72, "1w":168 },
    // Meyve
    fruit: { "🍒":0.5, "🍎":1, "🍌":2, "🍊":3, "🍇":5, "🍓":8, "🍑":13, "🥭":21, "🥝":34, "🍍":55 },
    // Hayvan
    animal: { "🐛":0.5, "🐰":1, "🐸":2, "🐱":3, "🐶":5, "🐼":8, "🦊":13, "🐯":21, "🦁":34, "🐘":55 },
    // Renk
    color: { "⚪":0.5, "🔴":1, "🟢":2, "🔵":3, "🟡":5, "🟣":8, "🟠":13, "🟤":21, "⚫":34, "🌈":55 }
  };
  
  // Hangi temaya ait olduğunu tespit et
  let detectedTheme = 'poker'; // Varsayılan
  let currentMap = allMaps.poker;
  
  // Oy değerlerine bakarak temayı tespit et
  const voteValues = Object.values(votes);
  for (const [theme, map] of Object.entries(allMaps)) {
    if (voteValues.some(vote => map[vote] !== undefined)) {
      detectedTheme = theme;
      currentMap = map;
      break;
    }
  }
  
  // Sayısal oyları işle
  const nums = Object.values(votes)
    .map((v) => currentMap[v])
    .filter((v) => typeof v === "number");
    
  if (nums.length === 0) {
    return { 
      count: 0, 
      distribution: {}, 
      average: null, 
      median: null, 
      mode: null, 
      summary: "Geçerli oy yok.",
      theme: detectedTheme,
      displayAverage: null,
      displayMedian: null,
      displayMode: []
    };
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
  
  // Debug: Log mode calculation
  console.log('Mode calculation debug:');
  console.log('nums:', nums);
  console.log('freq:', freq);
  console.log('maxF:', maxF);
  console.log('mode (before conversion):', Object.keys(freq).filter(k => Number(freq[k]) === maxF));
  console.log('mode (after conversion):', mode);
  const dist = {};
  Object.values(votes).forEach(v => { dist[v] = (dist[v]||0)+1; });
  
  // Tema'ya göre görüntüleme değerlerini hesapla
  let displayAverage = average;
  let displayMedian = median;
  let displayMode = mode;
  
  if (detectedTheme === 'tshirt') {
    // T-shirt boyutları için sayısal değerleri boyutlara geri çevir
    displayAverage = convertNumericToTshirt(average);
    displayMedian = convertNumericToTshirt(median);
    displayMode = mode.map(m => convertNumericToTshirt(m));
  } else if (detectedTheme === 'time') {
    // Saat için sayısal değerleri saatlere geri çevir
    displayAverage = convertNumericToTime(average);
    displayMedian = convertNumericToTime(median);
    displayMode = mode.map(m => convertNumericToTime(m));
  } else if (detectedTheme === 'fruit') {
    // Meyve için sayısal değerleri meyvelere geri çevir
    displayAverage = convertNumericToFruit(average);
    displayMedian = convertNumericToFruit(median);
    displayMode = mode.map(m => convertNumericToFruit(m));
  } else if (detectedTheme === 'animal') {
    // Hayvan için sayısal değerleri hayvanlara geri çevir
    displayAverage = convertNumericToAnimal(average);
    displayMedian = convertNumericToAnimal(median);
    displayMode = mode.map(m => convertNumericToAnimal(m));
  } else if (detectedTheme === 'color') {
    // Renk için sayısal değerleri renklere geri çevir
    displayAverage = convertNumericToColor(average);
    displayMedian = convertNumericToColor(median);
    displayMode = mode.map(m => convertNumericToColor(m));
  } else {
    // Poker kartları için sayısal değerleri 1 ondalık basamakla göster
    displayAverage = average.toFixed(1);
    displayMedian = median.toFixed(1);
    displayMode = mode.map(m => m.toString());
  }
  
  // Dağılımı tema'ya göre anlaşılır hale getir
  const distText = Object.entries(dist).map(([k,c]) => {
    if (k === "☕") return `${c} kişi mola istedi`;
    if (k === "?") return `${c} kişi belirsiz`;
    
    // Tema'ya göre açıklama
    if (detectedTheme === 'tshirt') {
      return `${c} kişi ${k} boyut`;
    } else if (detectedTheme === 'time') {
      return `${c} kişi ${k}`;
    } else if (detectedTheme === 'fruit') {
      return `${c} kişi ${k}`;
    } else if (detectedTheme === 'animal') {
      return `${c} kişi ${k}`;
    } else if (detectedTheme === 'color') {
      return `${c} kişi ${k}`;
    } else {
      // Poker kartları
      if (k === "½") return `${c} kişi 0.5 puan`;
      return `${c} kişi ${k} puan`;
    }
  }).join("\n");
  
  const summary = `${distText}

📊 İSTATİSTİKLER:
• Ortalama: ${displayAverage}
• Medyan: ${displayMedian}
• En Çok Verilen: ${displayMode.join(", ")}`;
  
  return { 
    count: nums.length, 
    distribution: dist, 
    average, 
    median, 
    mode, 
    summary,
    theme: detectedTheme,
    displayAverage,
    displayMedian,
    displayMode
  };
}

// T-shirt boyutları için sayısal değeri boyuta geri çevir
function convertNumericToTshirt(numericValue) {
  const tshirtMap = { 0.5: "XXS", 1: "XS", 2: "S", 3: "M", 5: "L", 8: "XL", 13: "XXL", 21: "XXXL" };
  
  // Eğer tam eşleşme varsa onu döndür
  if (tshirtMap[numericValue] !== undefined) {
    return tshirtMap[numericValue];
  }
  
  // En yakın T-shirt boyutunu bul
  const sizes = Object.keys(tshirtMap).map(Number).sort((a, b) => a - b);
  let closestSize = sizes[0];
  let minDifference = Math.abs(numericValue - closestSize);
  
  for (const size of sizes) {
    const difference = Math.abs(numericValue - size);
    if (difference < minDifference) {
      minDifference = difference;
      closestSize = size;
    }
  }
  
  // Eğer birden fazla aynı farkta değer varsa, sayısal olarak daha yakın olanı seç
  if (minDifference > 0) {
    const sameDifferenceSizes = sizes.filter(size => Math.abs(numericValue - size) === minDifference);
    if (sameDifferenceSizes.length > 1) {
      // Sayısal olarak en yakın olanı bul - daha akıllı mantık
      // Eğer numericValue iki değer arasındaysa, daha büyük olanı seç
      const sortedSizes = sameDifferenceSizes.sort((a, b) => a - b);
      if (numericValue > sortedSizes[0] && numericValue < sortedSizes[sortedSizes.length - 1]) {
        // numericValue iki değer arasındaysa, daha büyük olanı seç
        closestSize = sortedSizes[sortedSizes.length - 1];
      } else {
        // Değilse en yakın olanı bul
        let bestSize = sameDifferenceSizes[0];
        let bestDifference = Math.abs(numericValue - bestSize);
        
        for (const size of sameDifferenceSizes) {
          const difference = Math.abs(numericValue - size);
          if (difference < bestDifference) {
            bestDifference = difference;
            bestSize = size;
          }
        }
        
        closestSize = bestSize;
      }
    }
  }
  
  return tshirtMap[closestSize];
}

// Saat için sayısal değeri saate geri çevir
function convertNumericToTime(numericValue) {
  const timeMap = { 0.25: "15m", 0.5: "30m", 0.75: "45m", 1: "1h", 1.5: "1.5h", 2: "2h", 3: "3h", 4: "4h", 6: "6h", 8: "8h", 12: "12h", 16: "16h", 24: "24h", 48: "2d", 72: "3d", 168: "1w" };
  
  // Eğer tam eşleşme varsa onu döndür
  if (timeMap[numericValue] !== undefined) {
    return timeMap[numericValue];
  }
  
  // En yakın zaman değerini bul
  const times = Object.keys(timeMap).map(Number).sort((a, b) => a - b);
  let closestTime = times[0];
  let minDifference = Math.abs(numericValue - closestTime);
  
  for (const time of times) {
    const difference = Math.abs(numericValue - time);
    if (difference < minDifference) {
      minDifference = difference;
      closestTime = time;
    }
  }
  
  // Eğer birden fazla aynı farkta değer varsa, sayısal olarak daha yakın olanı seç
  if (minDifference > 0) {
    const sameDifferenceTimes = times.filter(time => Math.abs(numericValue - time) === minDifference);
    if (sameDifferenceTimes.length > 1) {
      // Sayısal olarak en yakın olanı bul - daha akıllı mantık
      // Eğer numericValue iki değer arasındaysa, daha büyük olanı seç
      const sortedTimes = sameDifferenceTimes.sort((a, b) => a - b);
      if (numericValue > sortedTimes[0] && numericValue < sortedTimes[sortedTimes.length - 1]) {
        // numericValue iki değer arasındaysa, daha büyük olanı seç
        closestTime = sortedTimes[sortedTimes.length - 1];
      } else {
        // Değilse en yakın olanı bul
        let bestTime = sameDifferenceTimes[0];
        let bestDifference = Math.abs(numericValue - bestTime);
        
        for (const time of sameDifferenceTimes) {
          const difference = Math.abs(numericValue - time);
          if (difference < bestDifference) {
            bestDifference = difference;
            bestTime = time;
          }
        }
        
        closestTime = bestTime;
      }
    }
  }
  
  return timeMap[closestTime];
}

// Meyve için sayısal değeri meyveye geri çevir
function convertNumericToFruit(numericValue) {
  const fruitMap = { 0.5: "🍒", 1: "🍎", 2: "🍌", 3: "🍊", 5: "🍇", 8: "🍓", 13: "🍑", 21: "🥭", 34: "🥝", 55: "🍍" };
  
  // Eğer tam eşleşme varsa onu döndür
  if (fruitMap[numericValue] !== undefined) {
    return fruitMap[numericValue];
  }
  
  // En yakın meyve değerini bul
  const fruits = Object.keys(fruitMap).map(Number).sort((a, b) => a - b);
  let closestFruit = fruits[0];
  let minDifference = Math.abs(numericValue - closestFruit);
  
  for (const fruit of fruits) {
    const difference = Math.abs(numericValue - fruit);
    if (difference < minDifference) {
      minDifference = difference;
      closestFruit = fruit;
    }
  }
  
  // Eğer birden fazla aynı farkta değer varsa, sayısal olarak daha yakın olanı seç
  if (minDifference > 0) {
    const sameDifferenceFruits = fruits.filter(fruit => Math.abs(numericValue - fruit) === minDifference);
    if (sameDifferenceFruits.length > 1) {
      // Sayısal olarak en yakın olanı bul - daha akıllı mantık
      // Eğer numericValue iki değer arasındaysa, daha büyük olanı seç
      const sortedFruits = sameDifferenceFruits.sort((a, b) => a - b);
      if (numericValue > sortedFruits[0] && numericValue < sortedFruits[sortedFruits.length - 1]) {
        // numericValue iki değer arasındaysa, daha büyük olanı seç
        closestFruit = sortedFruits[sortedFruits.length - 1];
      } else {
        // Değilse en yakın olanı bul
        let bestFruit = sameDifferenceFruits[0];
        let bestDifference = Math.abs(numericValue - bestFruit);
        
        for (const fruit of sameDifferenceFruits) {
          const difference = Math.abs(numericValue - fruit);
          if (difference < bestDifference) {
            bestDifference = difference;
            bestFruit = fruit;
          }
        }
        
        closestFruit = bestFruit;
      }
    }
  }
  
  return fruitMap[closestFruit];
}

// Hayvan için sayısal değeri hayvana geri çevir
function convertNumericToAnimal(numericValue) {
  const animalMap = { 0.5: "🐛", 1: "🐰", 2: "🐸", 3: "🐱", 5: "🐶", 8: "🐼", 13: "🦊", 21: "🐯", 34: "🦁", 55: "🐘" };
  
  // Eğer tam eşleşme varsa onu döndür
  if (animalMap[numericValue] !== undefined) {
    return animalMap[numericValue];
  }
  
  // En yakın hayvan değerini bul
  const animals = Object.keys(animalMap).map(Number).sort((a, b) => a - b);
  let closestAnimal = animals[0];
  let minDifference = Math.abs(numericValue - closestAnimal);
  
  for (const animal of animals) {
    const difference = Math.abs(numericValue - animal);
    if (difference < minDifference) {
      minDifference = difference;
      closestAnimal = animal;
    }
  }
  
  // Eğer birden fazla aynı farkta değer varsa, sayısal olarak daha yakın olanı seç
  if (minDifference > 0) {
    const sameDifferenceAnimals = animals.filter(animal => Math.abs(numericValue - animal) === minDifference);
    if (sameDifferenceAnimals.length > 1) {
      // Sayısal olarak en yakın olanı bul - daha akıllı mantık
      // Eğer numericValue iki değer arasındaysa, daha büyük olanı seç
      const sortedAnimals = sameDifferenceAnimals.sort((a, b) => a - b);
      if (numericValue > sortedAnimals[0] && numericValue < sortedAnimals[sortedAnimals.length - 1]) {
        // numericValue iki değer arasındaysa, daha büyük olanı seç
        closestAnimal = sortedAnimals[sortedAnimals.length - 1];
      } else {
        // Değilse en yakın olanı bul
        let bestAnimal = sameDifferenceAnimals[0];
        let bestDifference = Math.abs(numericValue - bestAnimal);
        
        for (const animal of sameDifferenceAnimals) {
          const difference = Math.abs(numericValue - animal);
          if (difference < bestDifference) {
            bestDifference = difference;
            bestAnimal = animal;
          }
        }
        
        closestAnimal = bestAnimal;
      }
    }
  }
  
  return animalMap[closestAnimal];
}

// Renk için sayısal değeri renge geri çevir
function convertNumericToColor(numericValue) {
  const colorMap = { 0.5: "⚪", 1: "🔴", 2: "🟢", 3: "🔵", 5: "🟡", 8: "🟣", 13: "🟠", 21: "🟤", 34: "⚫", 55: "🌈" };
  
  // Eğer tam eşleşme varsa onu döndür
  if (colorMap[numericValue] !== undefined) {
    return colorMap[numericValue];
  }
  
  // En yakın renk değerini bul
  const colors = Object.keys(colorMap).map(Number).sort((a, b) => a - b);
  let closestColor = colors[0];
  let minDifference = Math.abs(numericValue - closestColor);
  
  for (const color of colors) {
    const difference = Math.abs(numericValue - color);
    if (difference < minDifference) {
      minDifference = difference;
      closestColor = color;
    }
  }
  
  // Eğer birden fazla aynı farkta değer varsa, sayısal olarak daha yakın olanı seç
  if (minDifference > 0) {
    const sameDifferenceColors = colors.filter(color => Math.abs(numericValue - color) === minDifference);
    if (sameDifferenceColors.length > 1) {
      // Sayısal olarak en yakın olanı bul - daha akıllı mantık
      // Eğer numericValue iki değer arasındaysa, daha büyük olanı seç
      const sortedColors = sameDifferenceColors.sort((a, b) => a - b);
      if (numericValue > sortedColors[0] && numericValue < sortedColors[sortedColors.length - 1]) {
        // numericValue iki değer arasındaysa, daha büyük olanı seç
        closestColor = sortedColors[sortedColors.length - 1];
      } else {
        // Değilse en yakın olanı bul
        let bestColor = sameDifferenceColors[0];
        let bestDifference = Math.abs(numericValue - bestColor);
        
        for (const color of sameDifferenceColors) {
          const difference = Math.abs(numericValue - color);
          if (difference < bestDifference) {
            bestDifference = difference;
            bestColor = color;
          }
        }
        
        closestColor = bestColor;
      }
    }
  }
  
  return colorMap[closestColor];
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

    // Kullanıcıyı ekle ve lastSeen bilgisini güncelle
    const now = Date.now();
    rooms[normalizedRoomId].users[socket.id] = { 
      id: socket.id, 
      name: finalName,
      lastSeen: now
    };
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

    // Tüm tema kartlarını kabul et
    const validCards = [
      // Poker kartları
      "0", "½", "1", "2", "3", "5", "8", "13", "21", "34", "55", "89", "?", "☕",
      // T-shirt boyutları
      "XXS", "XS", "S", "M", "L", "XL", "XXL", "XXXL",
      // Saat
      "15m", "30m", "45m", "1h", "1.5h", "2h", "3h", "4h", "6h", "8h", "12h", "16h", "24h", "2d", "3d", "1w",
      // Meyve
      "🍒", "🍎", "🍌", "🍊", "🍇", "🍓", "🍑", "🥭", "🥝", "🍍",
      // Hayvan
      "🐛", "🐰", "🐸", "🐱", "🐶", "🐼", "🦊", "🐯", "🦁", "🐘",
      // Renk
      "⚪", "🔴", "🟢", "🔵", "🟡", "🟣", "🟠", "🟤", "⚫", "🌈"
    ];
    
    if (!validCards.includes(card)) {
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

  // Chat mesajı gönderme
  socket.on("chatMessage", (message) => {
    const roomId = socket.data.roomId;
    if (!roomId || !rooms[roomId]) return;
    
    const userName = rooms[roomId].users[socket.id]?.name;
    if (!userName) return;
    
    const chatMessage = {
      id: Date.now() + Math.random(), // Unique ID
      user: userName,
      message: String(message || "").trim(),
      timestamp: Date.now(),
      type: 'chat'
    };
    
    // Chat mesajını odaya ekle
    if (!rooms[roomId].chat) rooms[roomId].chat = [];
    rooms[roomId].chat.push(chatMessage);
    
    // Son 50 mesajı tut
    if (rooms[roomId].chat.length > 50) {
      rooms[roomId].chat = rooms[roomId].chat.slice(-50);
    }
    
    // Chat mesajını odaya yayınla
    io.to(roomId).emit("chatMessage", chatMessage);
    
    console.log(`Chat message from ${userName} in room ${roomId}: ${chatMessage.message}`);
  });
  
  // Chat geçmişini getir
  socket.on("getChatHistory", () => {
    const roomId = socket.data.roomId;
    if (!roomId || !rooms[roomId]) return;
    
    const chatHistory = rooms[roomId].chat || [];
    socket.emit("chatHistory", chatHistory);
  });

  // Tema değişikliği
  socket.on("themeChanged", (data) => {
    const roomId = socket.data.roomId;
    if (!roomId || !rooms[roomId]) return;
    
    // Sadece oda sahibi tema değiştirebilir
    if (!isRoomOwner(roomId, socket.id)) {
      console.log(`Non-owner user ${socket.id} tried to change theme in room ${roomId}`);
      return;
    }
    
    const { theme } = data;
    if (!theme) return;
    
    // Temayı odaya kaydet
    rooms[roomId].theme = theme;
    
    // Tüm kullanıcılara tema değişikliğini bildir
    io.to(roomId).emit("themeChanged", { theme });
    
    console.log(`Theme changed to ${theme} in room ${roomId} by owner ${socket.id}`);
  });
  
  // Kullanıcı adı değişikliği
  socket.on("usernameChanged", (data) => {
    const roomId = socket.data.roomId;
    if (!roomId || !rooms[roomId]) return;
    
    const { newUsername } = data;
    if (newUsername && newUsername.trim()) {
      // Kullanıcının adını güncelle
      if (rooms[roomId].users[socket.id]) {
        rooms[roomId].users[socket.id].name = newUsername.trim();
        
        // Tüm oyunculara güncellenmiş kullanıcı listesini gönder
        io.to(roomId).emit("state", roomState(roomId));
        
        console.log(`Oda ${roomId}: Kullanıcı ${socket.id} adını "${newUsername}" olarak değiştirdi`);
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
