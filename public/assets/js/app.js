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
  const submitButton = e.target.querySelector('button[type="submit"]');

  // Kullanıcı adı boşsa hata mesajı
  if (!username) {
    showMsg("Kullanıcı adı boş olamaz!", "error");
    return;
  }

  // Butonu geçici olarak devre dışı bırak
  submitButton.disabled = true;
  submitButton.textContent = "Katılıyor...";

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

  // Kısa bir gecikme ile odaya yönlendir (buton durumunu görmek için)
  setTimeout(() => {
    window.location.href = `room.html?room=${room}`;
  }, 500);
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
  
  // Aktiviteleri her 15 saniyede bir güncelle
  setInterval(updateRecentActivity, 15000);
  
  // Bağlantı durumunu göster
  showConnectionStatus();
});

// Global socket bağlantısı
let globalSocket = null;

// Socket bağlantısını başlat
function initSocket() {
  if (!window.io) {
    console.error("Socket.IO bulunamadı!");
    return null;
  }
  
  if (globalSocket && globalSocket.connected) {
    console.log("Mevcut socket bağlantısı kullanılıyor");
    return globalSocket;
  }
  
  console.log("Yeni Socket.IO bağlantısı kuruluyor...");
  globalSocket = io("http://localhost:3001", {
    timeout: 20000, // 20 saniye timeout
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000
  });
  
  globalSocket.on("connect", () => {
    console.log("✅ Socket.IO başarıyla bağlandı!");
  });
  
  globalSocket.on("connect_error", (error) => {
    console.error("❌ Socket.IO bağlantı hatası:", error);
  });
  
  globalSocket.on("disconnect", (reason) => {
    console.log("🔌 Socket.IO bağlantısı kesildi:", reason);
  });
  
  globalSocket.on("reconnect", (attemptNumber) => {
    console.log("🔄 Socket.IO yeniden bağlandı, deneme:", attemptNumber);
  });
  
  globalSocket.on("reconnect_error", (error) => {
    console.error("🔄 Socket.IO yeniden bağlantı hatası:", error);
  });
  
  return globalSocket;
}

// İstatistikleri güncelle
function updateStats() {
  console.log("updateStats çağrıldı");
  
  const socket = initSocket();
  if (!socket) {
    console.log("Socket bağlantısı kurulamadı, varsayılan değerler gösteriliyor");
    // Socket.IO yoksa varsayılan değerler
    document.getElementById("totalRooms").textContent = "0";
    document.getElementById("activeUsers").textContent = "0";
    document.getElementById("totalVotes").textContent = "0";
    document.getElementById("avgPoints").textContent = "0.0";
    return;
  }
  
  if (socket.connected) {
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
  } else {
    console.log("Socket henüz bağlanmadı, varsayılan değerler gösteriliyor");
    // Bağlantı yoksa varsayılan değerler
    document.getElementById("totalRooms").textContent = "0";
    document.getElementById("activeUsers").textContent = "0";
    document.getElementById("totalVotes").textContent = "0";
    document.getElementById("avgPoints").textContent = "0.0";
  }
}

// Bağlantı durumunu göster
function showConnectionStatus() {
  const statusDiv = document.getElementById("connectionStatus");
  const statusText = statusDiv?.querySelector(".status-text");
  const retryBtn = statusDiv?.querySelector(".btn-retry");
  
  if (!statusDiv) return;
  
  statusDiv.style.display = "block";
  
  const socket = initSocket();
  if (!socket) {
    if (statusText) statusText.textContent = "Socket.IO bulunamadı! ❌";
    if (retryBtn) retryBtn.style.display = "inline-block";
    return;
  }
  
  if (socket.connected) {
    if (statusText) statusText.textContent = "Sunucuya bağlandı! ✅";
    if (retryBtn) retryBtn.style.display = "none";
  } else {
    if (statusText) statusText.textContent = "Sunucuya bağlanıyor... ⏳";
    if (retryBtn) retryBtn.style.display = "none";
    
    socket.on("connect", () => {
      if (statusText) statusText.textContent = "Sunucuya bağlandı! ✅";
      if (retryBtn) retryBtn.style.display = "none";
      showMsg("Sunucuya bağlandı! ✅", "success");
    });
    
    socket.on("connect_error", (error) => {
      if (statusText) statusText.textContent = "Sunucu bağlantısı başarısız! ❌";
      if (retryBtn) retryBtn.style.display = "inline-block";
      showMsg("Sunucu bağlantısı başarısız! ❌", "error");
    });
  }
}

// Bağlantıyı yeniden dene
function retryConnection() {
  const statusText = document.getElementById("connectionStatus")?.querySelector(".status-text");
  const retryBtn = document.getElementById("connectionStatus")?.querySelector(".btn-retry");
  
  if (statusText) statusText.textContent = "Yeniden bağlanılıyor... ⏳";
  if (retryBtn) retryBtn.style.display = "none";
  
  // Mevcut socket'i kapat
  if (globalSocket) {
    globalSocket.disconnect();
    globalSocket = null;
  }
  
  // Yeni bağlantı kur
  setTimeout(() => {
    showConnectionStatus();
    updateRecentActivity();
    updateStats();
  }, 1000);
}

// Son aktiviteleri güncelle
function updateRecentActivity() {
  const activityList = document.getElementById("recentActivity");
  if (!activityList) return;

  // Loading durumu göster
  activityList.innerHTML = `
    <div class="activity-item">
      <span class="activity-time">⏳</span>
      <span class="activity-text">Aktiviteler yükleniyor...</span>
    </div>
  `;

  const socket = initSocket();
  if (!socket) {
    activityList.innerHTML = `
      <div class="activity-item">
        <span class="activity-time">❌</span>
        <span class="activity-text">Socket.IO bağlantısı kurulamadı</span>
      </div>
    `;
    return;
  }
  
  if (socket.connected) {
    socket.emit("getRecentActivities", (activities) => {
      if (activities && activities.length > 0) {
        activityList.innerHTML = activities
          .map(activity => `
            <div class="activity-item">
              <span class="activity-time">${activity.time}</span>
              <span class="activity-text">${activity.text}</span>
            </div>
          `)
          .join("");
      } else {
        // Henüz aktivite yoksa
        activityList.innerHTML = `
          <div class="activity-item">
            <span class="activity-time">🎯</span>
            <span class="activity-text">Henüz aktivite yok - İlk odayı oluştur!</span>
          </div>
        `;
      }
    });
  } else {
    // Socket henüz bağlanmadıysa, bağlantı bekleyelim
    socket.on("connect", () => {
      socket.emit("getRecentActivities", (activities) => {
        if (activities && activities.length > 0) {
          activityList.innerHTML = activities
            .map(activity => `
              <div class="activity-item">
                <span class="activity-time">${activity.time}</span>
                <span class="activity-text">${activity.text}</span>
              </div>
            `)
            .join("");
        } else {
          // Henüz aktivite yoksa
          activityList.innerHTML = `
            <div class="activity-item">
              <span class="activity-time">🎯</span>
              <span class="activity-text">Henüz aktivite yok - İlk odayı oluştur!</span>
            </div>
          `;
        }
      });
    });
    
    // Bağlantı hatası durumunda
    socket.on("connect_error", (error) => {
      console.error("Aktivite bağlantı hatası:", error);
      activityList.innerHTML = `
        <div class="activity-item">
          <span class="activity-time">⚠️</span>
          <span class="activity-text">Sunucu bağlantısı kurulamadı</span>
        </div>
      `;
      
      // Bağlantı durumunu güncelle
      const statusText = document.getElementById("connectionStatus")?.querySelector(".status-text");
      const retryBtn = document.getElementById("connectionStatus")?.querySelector(".btn-retry");
      if (statusText) statusText.textContent = "Sunucu bağlantısı başarısız! ❌";
      if (retryBtn) retryBtn.style.display = "inline-block";
    });
    
    // Daha uzun timeout (30 saniye)
    setTimeout(() => {
      if (activityList.innerHTML.includes("yükleniyor")) {
        activityList.innerHTML = `
          <div class="activity-item">
            <span class="activity-time">⏰</span>
            <span class="activity-text">Bağlantı zaman aşımı - Sunucu çalışıyor mu?</span>
          </div>
        `;
      }
    }, 30000); // 30 saniye timeout
  }
}
