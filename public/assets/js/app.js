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

// Son odaları güncelle
function updateRecentRooms() {
  const recentRoomsEl = document.getElementById("recentRooms");
  if (!recentRoomsEl) return;
  
  const rooms = JSON.parse(localStorage.getItem("recentRooms") || "[]");
  
  if (rooms.length === 0) {
    // Hiç oda yoksa boş mesajı göster
    recentRoomsEl.innerHTML = `
      <div class="recent-empty">
        <div class="empty-icon">📋</div>
        <p>Henüz hiç odaya katılmadın</p>
        <small>İlk odaya katıldığında burada görünecek</small>
      </div>
    `;
  } else {
    // Odalar varsa listeyi göster
    recentRoomsEl.innerHTML = `
      <div class="recent-rooms-list">
        ${rooms.map(room => `
          <div class="recent-room-item">
            <div class="room-info">
              <span class="room-icon">🚪</span>
              <span class="room-code">${room.toUpperCase()}</span>
            </div>
            <a href="room.html?room=${room}" class="room-join-btn">
              <span class="btn-icon">▶️</span>
              Katıl
            </a>
          </div>
        `).join('')}
      </div>
    `;
  }
}

// Sayfa yüklenince localStorage'dan verileri yükle ve son odalar listesini doldur
window.addEventListener("DOMContentLoaded", () => {
  // Form submit event listener'ını ekle
  setupFormSubmit();
  
  // Önce localStorage'dan verileri yükle
  loadDataFromLocalStorage();
  
  // Son odaları güncelle
  updateRecentRooms();
  
  // İstatistikleri hemen sıfırla
  resetStats();
  
  // İstatistikleri güncelle
  updateStats();
  
  // Son aktiviteleri güncelle
  updateRecentActivity();
  
  // Hemen tekrar dene (bağlantı gecikmesi için)
  setTimeout(() => {
    updateStats();
    updateRecentActivity();
  }, 500);
  
  // İstatistikleri her 2 saniyede bir güncelle (daha sık)
  setInterval(updateStats, 2000);
  
  // Aktiviteleri her 15 saniyede bir güncelle
  setInterval(updateRecentActivity, 15000);
  
  // Bağlantı durumunu göster
  showConnectionStatus();
});

// LocalStorage'dan verileri yükle
function loadDataFromLocalStorage() {
  try {
    // Sadece aktiviteleri yükle, istatistikleri yükleme
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
  console.log("🔄 updateStats çağrıldı");
  
  // Socket bağlantısını kontrol et
  const socket = initSocket();
  if (!socket) {
    console.log("❌ Socket bağlantısı kurulamadı, istatistikler sıfırlanıyor");
    // Socket bağlantısı yoksa istatistikleri sıfırla
    resetStats();
    return;
  }
  
  if (socket.connected) {
    console.log("✅ Socket.IO bağlandı, istatistikler isteniyor...");
    
    // Hemen istatistik iste
    socket.emit("getStats", (stats) => {
      console.log("📊 Sunucudan gelen istatistikler:", stats);
      if (stats && typeof stats === 'object') {
        // İstatistikleri localStorage'a kaydet
        const statsToSave = {
          totalRooms: parseInt(stats.totalRooms) || 0,
          activeUsers: parseInt(stats.activeUsers) || 0,
          totalVotes: parseInt(stats.totalVotes) || 0,
          avgPoints: parseFloat(stats.avgPoints) || 0.0,
          lastUpdated: Date.now()
        };
        localStorage.setItem("scrumPokerStats", JSON.stringify(statsToSave));
        
        // UI'yi güncelle
        updateStatsUI(statsToSave);
        console.log("✅ İstatistikler güncellendi:", statsToSave);
      } else {
        console.log("❌ Geçersiz istatistik verisi, istatistikler sıfırlanıyor");
        resetStats();
      }
    });
    
    // Timeout ekle - 3 saniye içinde cevap gelmezse sıfırla
    setTimeout(() => {
      if (!localStorage.getItem("scrumPokerStats")) {
        console.log("⏰ İstatistik timeout, sıfırlanıyor");
        resetStats();
      }
    }, 3000);
    
  } else {
    console.log("⏳ Socket henüz bağlanmadı, istatistikler sıfırlanıyor");
    resetStats();
  }
}

// İstatistikleri sıfırla
function resetStats() {
  const defaultStats = {
    totalRooms: 0,
    activeUsers: 0,
    totalVotes: 0,
    avgPoints: 0.0,
    lastUpdated: Date.now()
  };
  
  localStorage.setItem("scrumPokerStats", JSON.stringify(defaultStats));
  updateStatsUI(defaultStats);
}

// İstatistik UI'ını güncelle
function updateStatsUI(stats) {
  const totalRoomsEl = document.getElementById("totalRooms");
  const activeUsersEl = document.getElementById("activeUsers");
  const totalVotesEl = document.getElementById("totalVotes");
  const avgPointsEl = document.getElementById("avgPoints");
  
  if (totalRoomsEl) totalRoomsEl.textContent = stats.totalRooms;
  if (activeUsersEl) activeUsersEl.textContent = stats.activeUsers;
  if (totalVotesEl) totalVotesEl.textContent = stats.totalVotes;
  if (avgPointsEl) avgPointsEl.textContent = stats.avgPoints.toFixed(1);
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
