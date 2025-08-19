// realtime.js — Socket.io istemci katmanı (RT burada)
const SOCKET_URL =
  (location.hostname === "localhost" || location.hostname === "127.0.0.1")
    ? "http://localhost:3000"
    : window.location.origin; // deploy'da aynı origin

const socket = io(SOCKET_URL, { transports: ["websocket", "polling"] });

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

  join(roomId, name) {
    ROOM_ID = roomId;
    socket.emit("join", { roomId, name });
    // Katılır katılmaz state talep et (yarışları engellemek için)
    socket.emit("getState");
  },
  vote(card) {
    this.myVote = card;        // reveal öncesi highlight için
    socket.emit("vote", card, (res) => {
      // Başarılı oy için mesaj göstermiyoruz (spam'ı önlemek için)
      if (!res || res.ok) return;
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
      if (res && res.ok) showMsg("Yeni tura geçildi.", "info");
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
        // UI'yi tetikle
        try { window.dispatchEvent(new CustomEvent("rt:state", { detail: RT.state })); } catch {}
        showMsg("Görev kaydedildi.", "info");
        // Sunucudan taze state+history de isteyelim
        socket.emit("getState");
      } else {
        showMsg(res?.reason || "Görev kaydedilemedi.", "error");
      }
    });
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
    voteCount: typeof incoming.voteCount === "number" ? incoming.voteCount : Object.keys(incoming.votes || {}).length
  };

  RT.state = state;
  // UI'yi çiz
  if (typeof window.renderRoom === "function") {
    window.renderRoom(state);
  }
  // Ek olarak bir custom event yayınla; UI hazır değilse dinleyenler sonra render edebilir
  try {
    window.dispatchEvent(new CustomEvent("rt:state", { detail: state }));
  } catch {}
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
  const roomId = getQuery("room");
  const name = getUsername();

  if (!name) {
    showMsg("Kullanıcı adı bulunamadı. Ana sayfadan giriş yap.", "error");
    window.location.href = "index.html";
    return;
  }
  if (!roomId) {
    showMsg("Oda kodu geçersiz.", "error");
    window.location.href = "index.html";
    return;
  }

  document.getElementById("roomId").textContent = roomId;
  RT.join(roomId, name);
});
