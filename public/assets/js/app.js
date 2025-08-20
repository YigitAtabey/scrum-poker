// Ortak inline mesaj fonksiyonu
window.showMsg = (text, type = "info") => {
  const el = document.getElementById("alerts");
  if (!el) return;
  el.innerHTML = `<div class="alert ${type === "error" ? "alert-error" : "alert-info"}">${text}</div>`;
  setTimeout(() => {
    el.innerHTML = "";
  }, 4000);
};

// Form submit
document.getElementById("joinForm").addEventListener("submit", (e) => {
  e.preventDefault();

  const username = document.getElementById("username").value.trim();
  let room = document.getElementById("room").value.trim();

  // Kullanıcı adı boşsa hata mesajı
  if (!username) {
    showMsg("Kullanıcı adı boş olamaz!", "error");
    return;
  }

  // Eğer oda boşsa random üret
  if (!room) {
    room = Math.random().toString(36).substring(2, 8);
  }

  // LocalStorage'a kullanıcı adını kaydet
  localStorage.setItem("username", username);

  // Son odaları listeye ekle (en fazla 5 tane)
  let rooms = JSON.parse(localStorage.getItem("recentRooms") || "[]");
  if (!rooms.includes(room)) {
    rooms.unshift(room);
    if (rooms.length > 5) rooms = rooms.slice(0, 5);
    localStorage.setItem("recentRooms", JSON.stringify(rooms));
  }

  // Odaya yönlendir
  window.location.href = `room.html?room=${room}`;
});

// Sayfa yüklenince son odalar listesini doldur
window.addEventListener("DOMContentLoaded", () => {
  const ul = document.getElementById("recentRooms");
  if (!ul) return;
  const rooms = JSON.parse(localStorage.getItem("recentRooms") || "[]");
  rooms.forEach((r) => {
    const li = document.createElement("li");
    const a = document.createElement("a");
    a.href = `room.html?room=${r}`;
    a.textContent = r;
    li.appendChild(a);
    ul.appendChild(li);
  });

  // İstatistikleri güncelle
  updateStats();
  
  // Son aktiviteleri güncelle
  updateRecentActivity();
  
  // İstatistikleri her 30 saniyede bir güncelle
  setInterval(updateStats, 30000);
});

// İstatistikleri güncelle
function updateStats() {
  console.log("updateStats çağrıldı");
  console.log("window.io mevcut mu?", !!window.io);
  
  // Socket.IO ile sunucudan canlı verileri çek
  if (window.io) {
    console.log("Socket.IO bağlantısı kuruluyor...");
    const socket = io("http://localhost:3001");
    
    socket.on("connect", () => {
      console.log("Socket.IO bağlandı, istatistikler isteniyor...");
      socket.emit("getStats", (stats) => {
        console.log("Sunucudan gelen istatistikler:", stats);
        if (stats) {
          document.getElementById("totalRooms").textContent = stats.totalRooms || 0;
          document.getElementById("activeUsers").textContent = stats.activeUsers || 0;
          document.getElementById("totalVotes").textContent = stats.totalVotes || 0;
          document.getElementById("avgPoints").textContent = stats.avgPoints || "0.0";
        } else {
          // Hata durumunda varsayılan değerler
          document.getElementById("totalRooms").textContent = "0";
          document.getElementById("activeUsers").textContent = "0";
          document.getElementById("totalVotes").textContent = "0";
          document.getElementById("avgPoints").textContent = "0.0";
        }
      });
    });
    
    socket.on("connect_error", (error) => {
      console.error("Socket.IO bağlantı hatası:", error);
      // Hata durumunda varsayılan değerler
      document.getElementById("totalRooms").textContent = "0";
      document.getElementById("activeUsers").textContent = "0";
      document.getElementById("totalVotes").textContent = "0";
      document.getElementById("avgPoints").textContent = "0.0";
    });
  } else {
    console.log("Socket.IO bulunamadı, varsayılan değerler gösteriliyor");
    // Socket.IO yoksa varsayılan değerler
    document.getElementById("totalRooms").textContent = "0";
    document.getElementById("activeUsers").textContent = "0";
    document.getElementById("totalVotes").textContent = "0";
    document.getElementById("avgPoints").textContent = "0.0";
  }
}

// Son aktiviteleri güncelle
function updateRecentActivity() {
  const activities = [
    { time: "Şimdi", text: "Yeni oda oluşturuldu" },
    { time: "2 dk önce", text: "ABC123 odasında oylama tamamlandı" },
    { time: "5 dk önce", text: "Yeni kullanıcı katıldı" },
    { time: "10 dk önce", text: "Sprint planning başladı" }
  ];
  
  const activityList = document.getElementById("recentActivity");
  if (activityList) {
    activityList.innerHTML = activities
      .map(activity => `
        <div class="activity-item">
          <span class="activity-time">${activity.time}</span>
          <span class="activity-text">${activity.text}</span>
        </div>
      `)
      .join("");
  }
}
