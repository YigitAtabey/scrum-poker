// Ortak inline mesaj fonksiyonu
window.showMsg = (text, type = "info") => {
  const el = document.getElementById("alerts");
  if (!el) return;
  
  let alertClass = "alert-info"; // varsayılan
  if (type === "error") {
    alertClass = "alert-error";
  } else if (type === "success") {
    alertClass = "alert-info"; // success için de info kullan (CSS'de success yok)
  }
  
  el.innerHTML = `<div class="alert ${alertClass}">${text}</div>`;
  setTimeout(() => {
    el.innerHTML = "";
  }, 4000);
};

// Form submit - DOMContentLoaded içinde eklenmeli
function setupFormSubmit() {
  const joinForm = document.getElementById("joinForm");
  if (!joinForm) return;
  
  joinForm.addEventListener("submit", (e) => {
    e.preventDefault();

    const username = document.getElementById("username")?.value?.trim();
    let room = document.getElementById("room")?.value?.trim();
    const submitButton = e.target.querySelector('button[type="submit"]');

    // Kullanıcı adı boşsa hata mesajı
    if (!username) {
      showMsg("Kullanıcı adı boş olamaz!", "error");
      return;
    }

    // Butonu geçici olarak devre dışı bırak
    if (submitButton) {
      submitButton.disabled = true;
      submitButton.textContent = "Katılıyor...";
    }

    // Eğer oda boşsa random üret
    if (!room) {
      room = Math.random().toString(36).substring(2, 8);
    }

    // Oda kodunu case-insensitive yap (küçük harfe çevir)
    room = room.toLowerCase();

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
}

// Sayfa yüklenince localStorage'dan verileri yükle ve son odalar listesini doldur
window.addEventListener("DOMContentLoaded", () => {
  // Form submit event listener'ını ekle
  setupFormSubmit();
  
  // Önce localStorage'dan verileri yükle
  loadDataFromLocalStorage();
  
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
  
  // Hemen tekrar dene (bağlantı gecikmesi için)
  setTimeout(() => {
    updateStats();
    updateRecentActivity();
  }, 500);
  
  // İstatistikleri her 5 saniyede bir güncelle
  setInterval(updateStats, 5000);
  
  // Aktiviteleri her 15 saniyede bir güncelle
  setInterval(updateRecentActivity, 15000);
  
  // Bağlantı durumunu göster
  showConnectionStatus();
});

// LocalStorage'dan verileri yükle
function loadDataFromLocalStorage() {
  try {
    // İstatistikleri yükle
    const savedStats = JSON.parse(localStorage.getItem("scrumPokerStats") || "{}");
    if (savedStats.totalRooms !== undefined) {
      const totalRoomsEl = document.getElementById("totalRooms");
      const activeUsersEl = document.getElementById("activeUsers");
      const totalVotesEl = document.getElementById("totalVotes");
      const avgPointsEl = document.getElementById("avgPoints");
      
      if (totalRoomsEl) totalRoomsEl.textContent = savedStats.totalRooms || "0";
      if (activeUsersEl) activeUsersEl.textContent = savedStats.activeUsers || "0";
      if (totalVotesEl) totalVotesEl.textContent = savedStats.totalVotes || "0";
      if (avgPointsEl) avgPointsEl.textContent = savedStats.avgPoints || "0.0";
    }
    
    // Aktiviteleri yükle
    const savedActivities = JSON.parse(localStorage.getItem("scrumPokerActivities") || "[]");
    const activityList = document.getElementById("recentActivity");
    if (activityList && savedActivities.length > 0) {
      activityList.innerHTML = savedActivities
        .map(activity => `
          <div class="activity-item">
            <span class="activity-time">${activity.time}</span>
            <span class="activity-text">${activity.text}</span>
          </div>
        `)
        .join("");
    }
  } catch (error) {
    console.error("LocalStorage'dan veri yüklenirken hata:", error);
  }
}

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
  // Localhost kontrolü - hem localhost hem de 127.0.0.1'i kontrol et
  const isLocal = location.hostname === "localhost" || 
                  location.hostname === "127.0.0.1" || 
                  location.hostname.includes("127.0.0.1");
  
  const socketUrl = isLocal ? "http://localhost:3001" : window.location.origin;
  console.log("Socket.IO bağlantı URL'i:", socketUrl);
  
  globalSocket = io(socketUrl, {
    timeout: 20000, // 20 saniye timeout
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000
  });
  
  globalSocket.on("connect", () => {
    console.log("✅ Socket.IO başarıyla bağlandı!");
    
    // Bağlantı kurulur kurulmaz hemen istatistikleri al
    setTimeout(() => {
      updateStats();
      updateRecentActivity();
    }, 100);
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
  
  // Önce localStorage'dan mevcut istatistikleri yükle
  const savedStats = JSON.parse(localStorage.getItem("scrumPokerStats") || "{}");
  
  const socket = initSocket();
  if (!socket) {
    console.log("Socket bağlantısı kurulamadı, localStorage'dan yükleniyor");
    // localStorage'dan yükle
    const totalRoomsEl = document.getElementById("totalRooms");
    const activeUsersEl = document.getElementById("activeUsers");
    const totalVotesEl = document.getElementById("totalVotes");
    const avgPointsEl = document.getElementById("avgPoints");
    
    if (totalRoomsEl) totalRoomsEl.textContent = savedStats.totalRooms || "0";
    if (activeUsersEl) activeUsersEl.textContent = savedStats.activeUsers || "0";
    if (totalVotesEl) totalVotesEl.textContent = savedStats.totalVotes || "0";
    if (avgPointsEl) avgPointsEl.textContent = savedStats.avgPoints || "0.0";
    return;
  }
  
  if (socket.connected) {
    console.log("Socket.IO bağlandı, istatistikler isteniyor...");
    
    // Hemen istatistik iste
    socket.emit("getStats", (stats) => {
      console.log("Sunucudan gelen istatistikler:", stats);
      if (stats) {
        // İstatistikleri localStorage'a kaydet
        const statsToSave = {
          totalRooms: stats.totalRooms || 0,
          activeUsers: stats.activeUsers || 0,
          totalVotes: stats.totalVotes || 0,
          avgPoints: stats.avgPoints || "0.0",
          lastUpdated: Date.now()
        };
        localStorage.setItem("scrumPokerStats", JSON.stringify(statsToSave));
        
        // UI'yi güncelle
        const totalRoomsEl = document.getElementById("totalRooms");
        const activeUsersEl = document.getElementById("activeUsers");
        const totalVotesEl = document.getElementById("totalVotes");
        const avgPointsEl = document.getElementById("avgPoints");
        
        if (totalRoomsEl) totalRoomsEl.textContent = statsToSave.totalRooms;
        if (activeUsersEl) activeUsersEl.textContent = statsToSave.activeUsers;
        if (totalVotesEl) totalVotesEl.textContent = statsToSave.totalVotes;
        if (avgPointsEl) avgPointsEl.textContent = statsToSave.avgPoints;
      } else {
        // Hata durumunda localStorage'dan yükle
        const totalRoomsEl = document.getElementById("totalRooms");
        const activeUsersEl = document.getElementById("activeUsers");
        const totalVotesEl = document.getElementById("totalVotes");
        const avgPointsEl = document.getElementById("avgPoints");
        
        if (totalRoomsEl) totalRoomsEl.textContent = savedStats.totalRooms || "0";
        if (activeUsersEl) activeUsersEl.textContent = savedStats.activeUsers || "0";
        if (totalVotesEl) totalVotesEl.textContent = savedStats.totalVotes || "0";
        if (avgPointsEl) avgPointsEl.textContent = savedStats.avgPoints || "0.0";
      }
    });
  } else {
    console.log("Socket henüz bağlanmadı, localStorage'dan yükleniyor");
    // localStorage'dan yükle
    const totalRoomsEl = document.getElementById("totalRooms");
    const activeUsersEl = document.getElementById("activeUsers");
    const totalVotesEl = document.getElementById("totalVotes");
    const avgPointsEl = document.getElementById("avgPoints");
    
    if (totalRoomsEl) totalRoomsEl.textContent = savedStats.totalRooms || "0";
    if (activeUsersEl) activeUsersEl.textContent = savedStats.activeUsers || "0";
    if (totalVotesEl) totalVotesEl.textContent = savedStats.totalVotes || "0";
    if (avgPointsEl) avgPointsEl.textContent = savedStats.avgPoints || "0.0";
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
    
    // Event listener'ları temizle ve yeniden ekle
    socket.off("connect");
    socket.off("connect_error");
    
    socket.on("connect", () => {
      if (statusText) statusText.textContent = "Sunucuya bağlandı! ✅";
      if (retryBtn) retryBtn.style.display = "none";
      showMsg("Sunucuya bağlandı! ✅", "info"); // success yerine info kullan
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
  const statusDiv = document.getElementById("connectionStatus");
  if (!statusDiv) return;
  
  const statusText = statusDiv.querySelector(".status-text");
  const retryBtn = statusDiv.querySelector(".btn-retry");
  
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

  // Önce localStorage'dan mevcut aktiviteleri yükle
  const savedActivities = JSON.parse(localStorage.getItem("scrumPokerActivities") || "[]");

  // Loading durumu göster
  activityList.innerHTML = `
    <div class="activity-item">
      <span class="activity-time">⏳</span>
      <span class="activity-text">Aktiviteler yükleniyor...</span>
    </div>
  `;

  const socket = initSocket();
  if (!socket) {
    console.log("Socket bağlantısı kurulamadı, localStorage'dan yükleniyor");
    // localStorage'dan yükle
    if (savedActivities.length > 0) {
      activityList.innerHTML = savedActivities
        .map(activity => `
          <div class="activity-item">
            <span class="activity-time">${activity.time}</span>
            <span class="activity-text">${activity.text}</span>
          </div>
        `)
        .join("");
    } else {
      activityList.innerHTML = `
        <div class="activity-item">
          <span class="activity-time">🎯</span>
          <span class="activity-text">Henüz aktivite yok - İlk odayı oluştur!</span>
        </div>
      `;
    }
    return;
  }
  
  if (socket.connected) {
    socket.emit("getRecentActivities", (activities) => {
      if (activities && activities.length > 0) {
        // Aktiviteleri localStorage'a kaydet
        const activitiesToSave = activities.map(activity => ({
          time: activity.time,
          text: activity.text,
          timestamp: Date.now()
        }));
        localStorage.setItem("scrumPokerActivities", JSON.stringify(activitiesToSave));
        
        // UI'yi güncelle
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
    // Event listener'ları temizle ve yeniden ekle
    socket.off("connect");
    socket.off("connect_error");
    
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
      const statusDiv = document.getElementById("connectionStatus");
      if (statusDiv) {
        const statusText = statusDiv.querySelector(".status-text");
        const retryBtn = statusDiv.querySelector(".btn-retry");
        if (statusText) statusText.textContent = "Sunucu bağlantısı başarısız! ❌";
        if (retryBtn) retryBtn.style.display = "inline-block";
      }
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
