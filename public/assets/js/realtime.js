// realtime.js — Socket.io istemci katmanı (RT burada)
// Localhost kontrolü - hem localhost hem de 127.0.0.1'i kontrol et
const isLocal = location.hostname === "localhost" || 
                location.hostname === "127.0.0.1" || 
                location.hostname.includes("127.0.0.1");

const SOCKET_URL = isLocal ? "http://localhost:3001" : window.location.origin;

const socket = io(SOCKET_URL, { 
  transports: ["websocket", "polling"],
  upgrade: true,
  rememberUpgrade: true,
  timeout: 20000,
  forceNew: true
});

// Bağlantı kurulduğunda hemen state talep et
socket.on("connect", () => {
  console.log("Socket.IO bağlantısı kuruldu");
  if (ROOM_ID) {
    // Eğer zaten bir odadaysak, state'i yenile
    socket.emit("getState");
  }
});

function getQuery(key) {
  const url = new URL(window.location.href);
  return url.searchParams.get(key);
}
function getUsername() {
  return localStorage.getItem("username") || "";
}

function showMsg(message, type = "info") {
  try {
    const box = document.getElementById("alerts");
    if (!box) {
      alert(message);
      return;
    }
    const p = document.createElement("p");
    p.textContent = message;
    p.className = `alert alert-${type}`;
    box.appendChild(p);
    setTimeout(() => {
      if (p.parentNode === box) box.removeChild(p);
    }, 5000);
  } catch (e) {
    console.error(message);
  }
}

let ROOM_ID = null;
let shownError = false;

// Tüm UI'nin kullandığı RT API'si
window.RT = {
  me: { id: null, name: null },
  state: null,
  myVote: null, // reveal öncesi kendi seçimini hatırlamak için
  socket: socket, // Socket referansını ekle

  join(roomId, name) {
    ROOM_ID = roomId;
    socket.emit("join", { roomId, name });
    
    // Hemen state talep et - gecikmeyi önle
    setTimeout(() => {
      socket.emit("getState");
    }, 100);
    
    // Ek güvenlik için 500ms sonra tekrar dene
    setTimeout(() => {
      socket.emit("getState");
    }, 500);
  },
  vote(card) {
    this.myVote = card;        // reveal öncesi highlight için
    
    // Mevcut görev yazısını KESİNLİKLE koru
    const currentTaskInput = document.getElementById('taskInput');
    const currentTaskValue = currentTaskInput ? currentTaskInput.value : '';
    
    socket.emit("vote", card, (res) => {
      if (res && res.ok) {
        // Oy başarıyla gönderildi, state'i güncelle
        if (!RT.state) RT.state = {};
        
        // Görev yazısını KESİNLİKLE geri yükle - daha uzun gecikme ile
        setTimeout(() => {
          if (currentTaskInput && currentTaskValue) {
            if (currentTaskInput.value !== currentTaskValue) {
              currentTaskInput.value = currentTaskValue;
            }
          }
        }, 200);
        
        // UI'yi tetikle
        try { window.dispatchEvent(new CustomEvent("rt:state", { detail: RT.state })); } catch {}
        // Sunucudan taze state iste
        socket.emit("getState");
        return;
      }
      showMsg(res.reason || "Oy gönderilemedi.", "error");
    });
  },
  reveal() {
    socket.emit("reveal", (res) => {
      if (res && res.ok) {
        showMsg("Oy gönderildi.", "info");
        return;
      }
      showMsg(res?.reason || "Reveal gerçekleştirilemedi.", "error");
    });
  },
  reset() {
    this.myVote = null;
    socket.emit("reset", (res) => {
      if (res && res.ok) {
        showMsg("Yeni tura geçildi.", "info");
        // Reset sonrası yerel state'i de temizle
        if (this.state) {
          this.state.currentTask = '';
          this.state.votes = {};
          this.state.voted = [];
          this.state.voteCount = 0;
          this.state.revealed = false;
        }
      }
    });
    // Reset sonrası kartları tekrar aktif hale getirmek için güncel state iste
    socket.emit("getState");
  },
  getState() {
    socket.emit("getState");
  },
  setTask(task) {
    const t = String(task || "").trim();
    socket.emit("setTask", t, (res) => {
      if (res && res.ok) {
        // Yerel state'i de anında güncelle; UI bekletmesin
        if (!RT.state) RT.state = {};
        RT.state.currentTask = res.task || t;
        RT.state.taskUndoDepth = typeof res.depth === "number" ? res.depth : (RT.state.taskUndoDepth || 0);
        
        // Eğer daha önce oy verilmişse, o oyu tekrar aktif et
        if (RT.myVote) {
          // Oy verildi olarak işaretle
          RT.state.votes[RT.me.id] = RT.myVote;
          if (!RT.state.voted) RT.state.voted = [];
          if (!RT.state.voted.includes(RT.me.id)) {
            RT.state.voted.push(RT.me.id);
          }
          RT.state.voteCount = RT.state.voted.length;
        }
        
        // UI'yi tetikle
        try { window.dispatchEvent(new CustomEvent("rt:state", { detail: RT.state })); } catch {}
        showMsg("Görev kaydedildi.", "info");
        // Sunucudan taze state+history de isteyelim
        socket.emit("getState");
      } else {
        showMsg(res?.reason || "Görev kaydedilemedi.", "error");
      }
    });
  },
  leave() {
    if (ROOM_ID) {
      socket.emit("leave");
      // Ana sayfaya yönlendir
      window.location.href = "index.html";
    }
  }
};

// Bağlantı lifecycle
socket.on("connect", () => {
  shownError = false;
  // Yeniden bağlandıysa odaya tekrar katıl
  const name = getUsername();
  if (ROOM_ID && name) socket.emit("join", { roomId: ROOM_ID, name });
  // Bağlantı kurulur kurulmaz state+history iste
  socket.emit("getState");
});

socket.on("connect_error", () => {
  if (!shownError) {
    showMsg("Sunucuya bağlanılamadı. İnternet bağlantını kontrol et.", "error");
    shownError = true;
  } else {
    console.log("Bağlantı hatası tekrarlandı");
  }
});

socket.on("disconnect", () => {
  if (!shownError) {
    showMsg("Bağlantı koptu! Tekrar bağlanmayı dene.", "error");
    shownError = true;
  } else {
    console.log("Bağlantı tekrar koptu");
  }
});

// Kimlik bilgim
socket.on("me", (me) => {
  RT.me = me;
  // Kimlik gelince de en güncel state'i iste
  socket.emit("getState");
});

// Oda durumu (server’dan)
socket.on("state", (incoming) => {
  // Server 'users'ı obje (id->name) olarak gönderebilir; UI dizi bekliyor.
  const usersArray = Array.isArray(incoming.users)
    ? incoming.users
    : Object.entries(incoming.users || {}).map(([id, name]) => ({ id, name }));

  const state = {
    roomId: incoming.roomId,
    revealed: incoming.revealed,
    currentTask: incoming.currentTask || "",
    history: Array.isArray(incoming.history) ? incoming.history : [],
    users: usersArray,
    votes: incoming.votes || {},
    voted: Array.isArray(incoming.voted) ? incoming.voted : Object.keys(incoming.votes || {}),
    voteCount: typeof incoming.voteCount === "number" ? incoming.voteCount : Object.keys(incoming.votes || {}).length,
    owner: incoming.owner || null, // Oda sahibi bilgisi
    theme: incoming.theme || 'poker' // Oda teması
  };

  RT.state = state;
  
  // Oda sahibi kontrolü
  if (RT.me && state.owner) {
    const isOwner = RT.me.id === state.owner;
    // Global değişkeni güncelle
    if (typeof window.isRoomOwner !== 'undefined') {
      window.isRoomOwner = isOwner;
    }
    // Custom event ile oda sahibi bilgisini yayınla
    try {
      window.dispatchEvent(new CustomEvent("rt:owner", { detail: { isOwner, ownerId: state.owner } }));
    } catch {}
  }
  
  // UI'yi çiz
  if (typeof window.renderRoom === "function") {
    window.renderRoom(state);
  }
  // Ek olarak bir custom event yayınla; UI hazır değilse dinleyenler sonra render edebilir
  try {
    window.dispatchEvent(new CustomEvent("rt:state", { detail: state }));
  } catch {}
  
  // Tema değişikliği varsa custom event yayınla
  if (incoming.theme && incoming.theme !== (RT.state?.theme || 'poker')) {
    try {
      window.dispatchEvent(new CustomEvent("rt:themeChanged", { detail: { theme: incoming.theme } }));
    } catch {}
  }
});

// History ayrı kanal
socket.on("history", (history) => {
  if (RT.state) {
    RT.state.history = Array.isArray(history) ? history : [];
  }
  try {
    window.dispatchEvent(new CustomEvent("rt:history", { detail: history }));
  } catch {}
});

// Sayfa açılışı: odaya gir
window.addEventListener("DOMContentLoaded", () => {
  console.log("DOMContentLoaded event fired");
  
  const roomId = getQuery("room");
  
  console.log("Room ID:", roomId);

  if (!roomId) {
    showMsg("Oda kodu geçersiz.", "error");
    window.location.href = "index.html";
    return;
  }

  document.getElementById("roomId").textContent = roomId;

  // Ana sayfadan gelen mi yoksa linkle gelen mi kontrol et
  const referrer = document.referrer;
  const isFromMainPage = referrer && (referrer.includes('index.html') || referrer.includes('localhost:3001') || referrer.includes('127.0.0.1:3001'));
  
  console.log("Referrer:", referrer);
  console.log("Is from main page:", isFromMainPage);
  
  if (isFromMainPage) {
    // Ana sayfadan gelen - localStorage'daki kullanıcı adıyla direkt katıl
    const username = getUsername();
    if (username) {
      console.log("From main page, joining with username:", username);
      RT.join(roomId, username);
      
      // Chat geçmişini yükle
      setTimeout(() => {
        socket.emit("getChatHistory");
      }, 1000);
    } else {
      // Kullanıcı adı yoksa modal göster
      console.log("No username found, showing username modal");
      showUsernameModal(roomId);
    }
  } else {
    // Linkle gelen - her zaman kullanıcı adı modal'ını göster
    console.log("From link, showing username modal");
    showUsernameModal(roomId);
  }
});

// Kullanıcı adı modal'ını göster
function showUsernameModal(roomId) {
  const modal = document.getElementById("usernameModal");
  const form = document.getElementById("usernameForm");
  const input = document.getElementById("usernameInput");
  
  if (!modal || !form || !input) {
    console.error("Username modal elements not found");
    return;
  }
  
  console.log("Showing username modal for room:", roomId);
  
  // Modal'ı göster
  modal.style.display = "flex";
  
  // Oda ID'sini modal'da göster
  const modalRoomId = document.getElementById("modalRoomId");
  if (modalRoomId) {
    modalRoomId.textContent = roomId.toUpperCase();
  }
  
  // Body scroll'u engelle
  document.body.style.overflow = "hidden";
  
  // Input'a focus
  setTimeout(() => {
    input.focus();
  }, 100);
  
      // Form submit handler
    form.onsubmit = (e) => {
      e.preventDefault();
      
      const username = input.value.trim();
      if (!username) {
        input.focus();
        return;
      }
      
      // Submit butonunu devre dışı bırak
      const submitBtn = form.querySelector('button[type="submit"]');
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span class="btn-icon">⏳</span> Katılıyor...';
      }
      
      // Kullanıcı adını localStorage'a kaydet
      localStorage.setItem("username", username);
      
      // Modal'ı gizle
      hideUsernameModal();
      
      // Odaya katıl
      RT.join(roomId, username);
      
      // Chat geçmişini yükle
      setTimeout(() => {
        socket.emit("getChatHistory");
      }, 1000);
    };
  
  // Enter tuşu ile submit
  input.onkeydown = (e) => {
    if (e.key === "Enter") {
      form.dispatchEvent(new Event("submit"));
    }
  };
}

// Kullanıcı adı modal'ını gizle
function hideUsernameModal() {
  const modal = document.getElementById("usernameModal");
  if (modal) {
    modal.style.display = "none";
    // Body scroll'u geri aç
    document.body.style.overflow = "auto";
    console.log("Username modal hidden");
  }
}

// ESC tuşu ile modal'ı kapat
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    const modal = document.getElementById("usernameModal");
    if (modal && modal.style.display === "flex") {
      hideUsernameModal();
    }
  }
});

// ===== CHAT FUNCTIONS =====

// Chat mesajı gönderme
RT.sendChatMessage = function(message) {
  if (!message || !message.trim()) return;
  
  socket.emit("chatMessage", message.trim());
};

// Chat mesajı alma
socket.on("chatMessage", (chatMessage) => {
  // Custom event ile chat mesajını yayınla
  try {
    window.dispatchEvent(new CustomEvent("rt:chatMessage", { detail: chatMessage }));
  } catch {}
});

// Chat geçmişi
socket.on("chatHistory", (chatHistory) => {
  window.dispatchEvent(new CustomEvent("rt:chatHistory", { detail: chatHistory }));
});

// Tema değişikliği
socket.on("themeChanged", (data) => {
  window.dispatchEvent(new CustomEvent("rt:themeChanged", { detail: data }));
});
