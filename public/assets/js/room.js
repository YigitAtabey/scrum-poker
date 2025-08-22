// room.js – UI mantığı
(function () {
  const deckValues = ["0","½","1","2","3","5","8","13","21","?","☕"];
  const deckEl = document.getElementById("deck");
  const userListEl = document.getElementById("userList");
  const statusEl = document.getElementById("status");
  const voteCountEl = document.getElementById("voteCount");
  const statsEl = document.getElementById("stats");
  const revealBtn = document.getElementById("revealBtn");
  const resetBtn = document.getElementById("resetBtn");
  const taskInput = document.getElementById("taskInput");
  const taskSaveBtn = document.getElementById("taskSaveBtn");
  const historyEl = document.getElementById("history");
  
  // Kullanıcının yazdığı görev yazısını korumak için
  let userTypedTask = "";
  
  // Oda sahibi bilgisi
  let isRoomOwner = false;
  let currentUserId = null;
  
  // Hazır sistemi için değişkenler
  let selectedCard = null; // Seçilen kart (henüz oy verilmemiş)
  let isReady = false; // Kullanıcı hazır mı?
  let readyVote = null; // Kaydedilen oy (hazır olduktan sonra)

  // Kartları oluştur - Poker tarzı
  deckValues.forEach(v => {
    const btn = document.createElement("button");
    btn.className = "card";
    btn.setAttribute("data-value", v);
    
    // Kart içeriğini poker kartı gibi göster
    let displayText = v;
    let cardClass = "";
    let suit = "";
    
    if (v === "☕") {
      displayText = "☕";
      cardClass = "coffee-card";
      suit = "coffee";
    } else if (v === "?") {
      displayText = "?";
      cardClass = "question-card";
      suit = "question";
    } else if (v === "½") {
      displayText = "½";
      cardClass = "half-card";
      suit = "half";
    } else if (v === "0") {
      displayText = "0";
      cardClass = "zero-card";
      suit = "zero";
    } else {
      // Sayısal değerler için poker kartı sembolleri
      const suits = ["hearts", "diamonds", "clubs", "spades"];
      const suitSymbols = ["♥", "♦", "♣", "♠"];
      const randomSuitIndex = Math.floor(Math.random() * suits.length);
      suit = suits[randomSuitIndex];
      
      // Kart içeriğini temizle
      btn.innerHTML = "";
      
      // Sembol ekle
      const suitElement = document.createElement("div");
      suitElement.className = "card-suit";
      suitElement.textContent = suitSymbols[randomSuitIndex];
      suitElement.setAttribute("data-suit", suit);
      btn.appendChild(suitElement);
      
      // Değer ekle
      const valueElement = document.createElement("div");
      valueElement.className = "card-value";
      valueElement.textContent = v;
      valueElement.setAttribute("data-suit", suit);
      btn.appendChild(valueElement);
      
      // Suit bilgisini kart elementine ekle
      btn.setAttribute("data-suit", suit);
    }
    
    // Özel kartlar için normal text
    if (cardClass) {
      btn.textContent = displayText;
      btn.classList.add(cardClass);
    }
    
    // Event listener'ları ekle
    btn.addEventListener("click", () => {
      selectCard(v, btn);
    });
    
    // Klavye erişilebilirlik
    btn.setAttribute("tabindex", "0");
    btn.setAttribute("aria-label", `Kart ${v}`);
    btn.addEventListener("keypress", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        selectCard(v, btn);
      }
    });
    
    // Kartı deck'e ekle
    deckEl.appendChild(btn);
  });

  // Event listener'ları ekle
  if (revealBtn) {
    revealBtn.addEventListener("click", () => {
      showRevealConfirmDialog();
    });
  }
  
  if (resetBtn) {
    resetBtn.addEventListener("click", () => {
      showResetConfirmDialog();
    });
  }

  // Oda sahibi kontrolü
  function updateOwnerControls() {
    const taskInputContainer = document.querySelector('.task-input-container');
    
    if (isRoomOwner) {
      // Oda sahibi ise tüm butonları göster
      if (revealBtn) revealBtn.style.display = "inline-block";
      if (resetBtn) resetBtn.style.display = "inline-block";
      if (taskInput) taskInput.style.display = "inline-block";
      if (taskSaveBtn) taskSaveBtn.style.display = "inline-block";
      if (taskInputContainer) taskInputContainer.style.display = "flex";
    } else {
      // Oda sahibi değilse sadece oy verme butonlarını göster
      if (revealBtn) revealBtn.style.display = "none";
      if (resetBtn) resetBtn.style.display = "none";
      if (taskInput) taskInput.style.display = "none";
      if (taskSaveBtn) taskSaveBtn.style.display = "none";
      if (taskInputContainer) taskInputContainer.style.display = "none";
    }
    
    // Hazır butonu herkes için görünür olsun
    const readyBtn = document.getElementById('readyBtn');
    if (readyBtn) {
      readyBtn.style.display = 'block';
    }
  }
  
  // Kart seçim fonksiyonu
  function selectCard(value, cardElement) {
    // Eğer zaten hazırsa ve oy verilmişse, değiştirmeye izin verme
    if (isReady && readyVote !== null) {
      showInfoMessage("Oyunuzu değiştirmek için önce 'Hazır' durumunu iptal edin.");
      return;
    }
    
    // Görev aktif değilse kart seçimine izin verme
    if (window.RT && window.RT.state && (!window.RT.state.currentTask || !window.RT.state.currentTask.trim())) {
      showInfoMessage("Önce görev adını ayarlamalısınız.");
      return;
    }
    
    // Önceki seçimi temizle
    document.querySelectorAll('.card').forEach(card => {
      card.classList.remove('selected');
    });
    
    // Yeni kartı seç
    selectedCard = value;
    cardElement.classList.add('selected');
    
    // Hazır butonunu göster/güncelle
    updateReadyButton();
  }
  
  // Hazır buton durumunu güncelle
  function updateReadyButton() {
    let readyBtn = document.getElementById('readyBtn');
    
    // Hazır butonu yoksa oluştur
    if (!readyBtn) {
      readyBtn = document.createElement('button');
      readyBtn.id = 'readyBtn';
      readyBtn.className = 'btn btn-success';
      
      // Hazır butonu için özel alana ekle
      const readyButtonContainer = document.getElementById('readyButtonContainer');
      if (readyButtonContainer) {
        readyButtonContainer.appendChild(readyBtn);
      } else {
        // Fallback: Görev bilgisinin altına ekle
        const currentTaskDisplay = document.getElementById('currentTaskDisplay');
        if (currentTaskDisplay && currentTaskDisplay.nextSibling) {
          currentTaskDisplay.parentNode.insertBefore(readyBtn, currentTaskDisplay.nextSibling);
        }
      }
      
      // Click event
      readyBtn.addEventListener('click', toggleReady);
    }
    
    // Görev aktif değilse butonu devre dışı bırak
    const hasActiveTask = window.RT && window.RT.state && window.RT.state.currentTask && window.RT.state.currentTask.trim();
    
    // Buton metnini ve durumunu güncelle
    if (isReady && readyVote !== null) {
      readyBtn.textContent = '✓ Hazır (İptal Et)';
      readyBtn.className = 'btn btn-warning';
      readyBtn.disabled = false;
    } else if (selectedCard && hasActiveTask) {
      readyBtn.textContent = `${selectedCard} ile Hazır`;
      readyBtn.className = 'btn btn-success';
      readyBtn.disabled = false;
    } else if (selectedCard && !hasActiveTask) {
      readyBtn.textContent = 'Görev Bekleniyor...';
      readyBtn.className = 'btn btn-secondary';
      readyBtn.disabled = true;
    } else {
      readyBtn.textContent = 'Önce Kart Seç';
      readyBtn.className = 'btn btn-secondary';
      readyBtn.disabled = true;
    }
    
    // Buton görünürlüğünü ayarla
    readyBtn.style.display = 'block';
  }
  
  // Hazır durumunu değiştir
  function toggleReady() {
    if (isReady && readyVote !== null) {
      // Hazır durumunu iptal et
      isReady = false;
      readyVote = null;
      
      // Local myVote değerini de temizle
      if (window.RT && window.RT.myVote !== undefined) {
        window.RT.myVote = null;
      }
      
      // Kartları yeniden aktif et
      document.querySelectorAll('.card').forEach(card => {
        card.classList.remove('selected');
        card.style.opacity = '1';
        card.style.pointerEvents = 'auto';
      });
      
      showSuccessMessage('Hazır durumu iptal edildi. Yeni kart seçebilirsiniz.');
      
      // UI'yi hemen güncelle
      if (window.RT && window.RT.state) {
        window.renderRoom(window.RT.state);
      }
      
      // Progress bar'ı hemen güncelle
      updateTaskProgress();
    } else if (selectedCard) {
      // Görev aktif değilse hazır olmaya izin verme
      if (window.RT && window.RT.state && (!window.RT.state.currentTask || !window.RT.state.currentTask.trim())) {
        showInfoMessage("Önce görev adını ayarlamalısınız.");
        return;
      }
      
      // Hazır ol - oy ver
      isReady = true;
      readyVote = selectedCard;
      
      console.log("🔍 Debug: Hazır durumu set edildi:", {
        isReady: true,
        readyVote: selectedCard,
        selectedCard,
        myId: window.RT?.me?.id
      });
      
      // Kartları pasif et
      document.querySelectorAll('.card').forEach(card => {
        if (!card.classList.contains('selected')) {
          card.style.opacity = '0.5';
          card.style.pointerEvents = 'none';
        }
      });
      
      // Oy ver
      if (window.RT && window.RT.vote) {
        console.log("🔍 Debug: Oy veriliyor:", selectedCard);
        window.RT.vote(selectedCard);
        // Local myVote değerini de set et
        if (window.RT.myVote !== undefined) {
          window.RT.myVote = selectedCard;
          console.log("🔍 Debug: myVote set edildi:", selectedCard);
        }
        
        // Local state'i hemen güncelle
        if (window.RT.state) {
          // Eğer state.votes yoksa oluştur
          if (!window.RT.state.votes) {
            window.RT.state.votes = {};
          }
          // Mevcut kullanıcının oyunu ekle
          window.RT.state.votes[window.RT.me.id] = selectedCard;
          console.log("�� Debug: Local state güncellendi:", window.RT.state.votes);
        }
      }
      
      showSuccessMessage(`${selectedCard} oyunuz kaydedildi!`);
      
      console.log("🔍 Debug: UI güncelleniyor...");
      // UI'yi hemen güncelle
      if (window.RT && window.RT.state) {
        console.log("🔍 Debug: renderRoom çağrılıyor");
        window.renderRoom(window.RT.state);
      } else {
        console.log("🔍 Debug: RT.state bulunamadı!");
      }
      
      // Progress bar'ı hemen güncelle
      console.log("🔍 Debug: updateTaskProgress çağrılıyor");
      updateTaskProgress();
    }
    
    updateReadyButton();
  }
  
  // Oda sahibi event'ini dinle
  window.addEventListener("rt:owner", (event) => {
    isRoomOwner = event.detail.isOwner;
    currentUserId = window.RT?.me?.id;
    updateOwnerControls();
    console.log("Oda sahibi durumu:", isRoomOwner ? "Evet" : "Hayır");
  });
  
  // Sayfa yüklendiğinde hazır butonunu başlat
  document.addEventListener("DOMContentLoaded", () => {
    updateReadyButton();
  });
  
  // Odadan çık butonu
  const leaveBtn = document.getElementById("leaveBtn");
  if (leaveBtn) {
    leaveBtn.addEventListener("click", () => {
      showLeaveConfirmDialog();
    });
  }

  if (taskSaveBtn) {
    taskSaveBtn.addEventListener("click", () => {
      showTaskInputDialog();
    });
  }
  
  // Sayfa yüklendiğinde oda sahibi kontrolünü yap
  updateOwnerControls();
  
  // Oda ID'sini URL'den al ve göster
  const urlParams = new URLSearchParams(window.location.search);
  const roomId = urlParams.get('room');
  if (roomId) {
    const roomIdElement = document.getElementById('roomId');
    if (roomIdElement) {
      roomIdElement.textContent = roomId.toUpperCase();
    }
  }
  
  if (taskInput) {
    // Input'a yazılan her karakteri kaydet
    taskInput.addEventListener("input", (e) => {
      userTypedTask = e.target.value;
      // Debug için konsola yazdır
      console.log("Görev yazısı kaydedildi:", userTypedTask);
    });
    
    taskInput.addEventListener("keypress", (e) => {
      if (e.key === "Enter") {
        if (window.RT && window.RT.setTask) {
          window.RT.setTask(taskInput.value);
        }
      }
    });
    
    // Focus olayında da yazıyı koru
    taskInput.addEventListener("focus", () => {
      if (userTypedTask && userTypedTask.trim()) {
        if (taskInput.value !== userTypedTask) {
          taskInput.value = userTypedTask;
        }
      }
    });

    // Görev input alanına tıklayınca pop-up aç
    taskInput.addEventListener("click", () => {
      showTaskInputDialog();
    });

    // Görev input wrapper'ına da tıklama olayı ekle
    const taskInputWrapper = document.querySelector('.task-input-wrapper');
    if (taskInputWrapper) {
      taskInputWrapper.addEventListener("click", (e) => {
        // Eğer butona tıklanmadıysa pop-up aç
        if (!e.target.closest('.task-save-btn')) {
          showTaskInputDialog();
        }
      });
    }
  }

  // Basit istatistikler
  function calcStats(votes) {
    const map = { "0":0, "½":0.5, "1":1, "2":2, "3":3, "5":5, "8":8, "13":13, "21":21 };
    const nums = Object.values(votes).map(v => map[v]).filter(v => typeof v === "number");
    if (nums.length === 0) return "Geçerli oy yok.";

    nums.sort((a,b)=>a-b);
    const sum = nums.reduce((a,b)=>a+b,0);
    const avg = sum / nums.length;
    const mid = Math.floor(nums.length/2);
    const median = nums.length % 2 ? nums[mid] : (nums[mid-1]+nums[mid])/2;

    const freq = {};
    nums.forEach(n => freq[n]=(freq[n]||0)+1);
    const maxF = Math.max(...Object.values(freq));
    const mode = Object.keys(freq).filter(k => freq[k]==maxF).join(", ");

    const dist = {};
    Object.values(votes).forEach(v => dist[v]=(dist[v]||0)+1);
    
    // Dağılımı daha anlaşılır hale getir
    const distText = Object.entries(dist).map(([k,c]) => {
      if (k === "☕") return `${c} kişi mola istedi`;
      if (k === "☕") return `${c} kişi mola istedi`;
      if (k === "?") return `${c} kişi belirsiz`;
      if (k === "½") return `${c} kişi 0.5 puan`;
      return `${c} kişi ${k} puan`;
    }).join("\n");

    return `${distText}

📊 Özet: Ortalama ${avg.toFixed(1)} | Medyan ${median} | En çok ${mode}`;
  }
  
  // Detaylı istatistikler (pop-up için)
  function calculateDetailedStats(votes) {
    const map = { "0":0, "½":0.5, "1":1, "2":2, "3":3, "5":5, "8":8, "13":13, "21":21 };
    const nums = Object.values(votes).map(v => map[v]).filter(v => typeof v === "number");
    
    if (nums.length === 0) {
      return {
        average: null,
        median: null,
        mode: [],
        count: 0
      };
    }

    nums.sort((a,b)=>a-b);
    const sum = nums.reduce((a,b)=>a+b,0);
    const avg = sum / nums.length;
    const mid = Math.floor(nums.length/2);
    const median = nums.length % 2 ? nums[mid] : (nums[mid-1]+nums[mid])/2;

    const freq = {};
    nums.forEach(n => freq[n]=(freq[n]||0)+1);
    const maxF = Math.max(...Object.values(freq));
    const mode = Object.keys(freq).filter(k => freq[k]==maxF);

    return {
      average: avg,
      median: median,
      mode: mode,
      count: nums.length
    };
  }

  // UI'yi güncelle
  window.renderRoom = (state) => {
    const total = state.users.length;
    
    // Oy veren kullanıcıları tespit et
    const votedIds = new Set();
    
    // 1. State'den gelen oyları ekle
    if (Array.isArray(state.voted)) {
      state.voted.forEach(id => votedIds.add(id));
    } else if (state.votes) {
      Object.keys(state.votes).forEach(id => votedIds.add(id));
    }
    
    // 2. Mevcut kullanıcının oyunu da ekle (eğer hazır ise)
    if (isReady && readyVote !== null && window.RT?.me?.id) {
      votedIds.add(window.RT?.me?.id);
      console.log("🔍 Debug: Mevcut kullanıcı oy verdi, ID eklendi:", window.RT.me.id);
    }
    
    // Ek güvenlik kontrolü - eğer hala eklenmemişse zorla ekle
    if (isReady && readyVote !== null && window.RT?.me?.id && !votedIds.has(window.RT?.me?.id)) {
      votedIds.add(window.RT?.me?.id);
      console.log("🔍 Debug: Zorla ID eklendi:", window.RT.me.id);
    }
    
    const votedCount = votedIds.size;
    
    // Debug için console.log
    console.log("🔍 Debug: Oy durumu:", {
      isReady,
      readyVote,
      myVote: window.RT?.myVote,
      votedIds: Array.from(votedIds),
      votedCount,
      stateVotes: state.votes,
      stateVoted: state.voted
    });
    
    // Oda sahibi kontrolünü güncelle (state'den owner bilgisi gelince)
    if (state.owner && window.RT?.me?.id) {
      isRoomOwner = (state.owner === window.RT.me.id);
      updateOwnerControls();
    }
    
    // Reset sonrası hazır sistemini sıfırla
    // Sadece oy sayısı 0 değil, görev de temizlenmiş olmalı
    if (!state.revealed && 
        votedCount === 0 && 
        Object.keys(state.votes || {}).length === 0 &&
        (!state.currentTask || !state.currentTask.trim())) {
      console.log("🔍 Debug: Reset sonrası hazır sistem sıfırlanıyor");
      isReady = false;
      readyVote = null;
      selectedCard = null;
      
      // window.RT.myVote'u da sıfırla
      if (window.RT && window.RT.myVote !== undefined) {
        window.RT.myVote = null;
        console.log("🔍 Debug: window.RT.myVote sıfırlandı");
      }
      
      // Kartları aktif et
      document.querySelectorAll('.card').forEach(card => {
        card.classList.remove('selected');
        card.style.opacity = '1';
        card.style.pointerEvents = 'auto';
      });
      
      // Hazır butonunu güncelle
      updateReadyButton();
      
      console.log("🔍 Debug: Hazır sistem sıfırlandı:", {
        isReady,
        readyVote,
        selectedCard,
        myVote: window.RT?.myVote,
        currentTask: state.currentTask
      });
    }

    // Kullanıcı listesi ve sayacı güncelle
    userListEl.innerHTML = "";
    
    // Katılımcı sayısını güncelle
    const participantCountEl = document.getElementById('participantCount');
    if (participantCountEl) {
      participantCountEl.textContent = state.users.length;
    }
    
    // En yüksek ve en düşük oyları hesapla (reveal sonrası)
    let highestVote = null;
    let lowestVote = null;
    let highestUsers = [];
    let lowestUsers = [];
    
    if (state.revealed && state.votes) {
      const map = { "0":0, "½":0.5, "1":1, "2":2, "3":3, "5":5, "8":8, "13":13, "21":21 };
      const numericVotes = {};
      
      // Sadece sayısal oyları al
      Object.entries(state.votes).forEach(([userId, vote]) => {
        if (map[vote] !== undefined) {
          numericVotes[userId] = map[vote];
        }
      });
      
      if (Object.keys(numericVotes).length > 0) {
        const values = Object.values(numericVotes);
        highestVote = Math.max(...values);
        lowestVote = Math.min(...values);
        
        // En yüksek ve en düşük oy veren kullanıcıları bul
        Object.entries(numericVotes).forEach(([userId, value]) => {
          if (value === highestVote) {
            highestUsers.push(userId);
          }
          if (value === lowestVote) {
            lowestUsers.push(userId);
          }
        });
      }
    }
    
    state.users.forEach(u => {
      const li = document.createElement("li");
      
      // Kullanıcı adı container
      const nameSpan = document.createElement("span");
      nameSpan.className = "participant-name";
      nameSpan.textContent = u.name;
      
      // Oda sahibi simgesi ekle
      if (state.owner && u.id === state.owner) {
        const adminIcon = document.createElement("span");
        adminIcon.textContent = " ⚙️"; // Ayar simgesi (admin/yönetici)
        adminIcon.style.marginLeft = "5px";
        adminIcon.style.color = "#fbbf24"; // Altın sarısı
        adminIcon.title = "Oda Yöneticisi";
        nameSpan.appendChild(adminIcon);
      }
      
      // En yüksek/en düşük oy işaretleri ekle (reveal sonrası)
      if (state.revealed && state.votes) {
        if (highestUsers.includes(u.id) && lowestUsers.includes(u.id)) {
          // Aynı kişi hem en yüksek hem en düşük oy verdiyse (tek kişi varsa)
          if (highestUsers.length === 1 && lowestUsers.length === 1) {
            const singleIcon = document.createElement("span");
            singleIcon.textContent = " 🎯"; // Hedef simgesi
            singleIcon.style.marginLeft = "5px";
            singleIcon.style.color = "#8b5cf6"; // Mor renk
            singleIcon.title = "Tek oycu";
            nameSpan.appendChild(singleIcon);
          }
        } else {
          // En yüksek oy işareti
          if (highestUsers.includes(u.id) && highestUsers.length > 0) {
            const highIcon = document.createElement("span");
            highIcon.textContent = " 🔥"; // Ateş simgesi (en yüksek)
            highIcon.style.marginLeft = "5px";
            highIcon.style.color = "#ef4444"; // Kırmızı renk
            highIcon.title = `En yüksek oy: ${state.votes[u.id]}`;
            nameSpan.appendChild(highIcon);
          }
          
          // En düşük oy işareti
          if (lowestUsers.includes(u.id) && lowestUsers.length > 0) {
            const lowIcon = document.createElement("span");
            lowIcon.textContent = " ❄️"; // Kar tanesi simgesi (en düşük)
            lowIcon.style.marginLeft = "5px";
            lowIcon.style.color = "#3b82f6"; // Mavi renk
            lowIcon.title = `En düşük oy: ${state.votes[u.id]}`;
            nameSpan.appendChild(lowIcon);
          }
        }
      }
      
      li.appendChild(nameSpan);
      
      // Oy durumu
      const statusSpan = document.createElement("span");
      statusSpan.className = "vote-status";
      
      if (state.revealed) {
        // Reveal sonrası oy göster
        const vote = state.votes[u.id] || "?";
        statusSpan.textContent = vote;
        statusSpan.className = "vote-status voted";
        
        // En yüksek/en düşük oy verenlere özel stil
        if (highestUsers.includes(u.id) && !lowestUsers.includes(u.id)) {
          statusSpan.className = "vote-status voted highest";
        } else if (lowestUsers.includes(u.id) && !highestUsers.includes(u.id)) {
          statusSpan.className = "vote-status voted lowest";
        }
      } else if (votedIds.has(u.id) && state.currentTask && state.currentTask.trim()) {
        // Oy verdi VE görev kaydedildi
        statusSpan.textContent = "✅";
        statusSpan.className = "vote-status voted";
      } else if (votedIds.has(u.id) && (!state.currentTask || !state.currentTask.trim())) {
        // Oy verdi ama görev henüz kaydedilmedi
        statusSpan.textContent = "⏳";
        statusSpan.className = "vote-status waiting";
      } else {
        // Henüz oy vermedi
        statusSpan.textContent = "⏳";
        statusSpan.className = "vote-status waiting";
      }
      
      // Mevcut kullanıcının oy durumunu özel olarak kontrol et
      if (!state.revealed && u.id === window.RT?.me?.id && isReady && readyVote !== null) {
        statusSpan.textContent = "✅";
        statusSpan.className = "vote-status voted";
        console.log("🔍 Debug: Mevcut kullanıcı oy durumu güncellendi:", u.name);
      }
      
      // Ek güvenlik kontrolü - mevcut kullanıcı için her zaman kontrol et
      if (u.id === window.RT?.me?.id) {
        console.log("🔍 Debug: Mevcut kullanıcı bulundu:", {
          name: u.name,
          isReady,
          readyVote,
          revealed: state.revealed,
          currentStatus: statusSpan.textContent,
          actualVote: state.votes?.[u.id]
        });
      }
      
      li.appendChild(statusSpan);
      userListEl.appendChild(li);
    });

    // Durum rozetleri
    statusEl.textContent = state.revealed ? "Gösterildi" : "Oylanıyor";
    statusEl.className = "badge " + (state.revealed ? "badge-green" : "badge-blue");
    statusEl.setAttribute("aria-label", statusEl.textContent);

    // Oy sayacı
    if (state.revealed) {
      voteCountEl.textContent = `Toplam katılımcı: ${total}`;
    } else if (state.currentTask && state.currentTask.trim()) {
      // Görev kaydedildi, oy verenleri say (mevcut kullanıcı dahil)
      let actualVotedCount = votedIds.size;
      
      // Eğer mevcut kullanıcı hazır ama henüz state'e yansımamışsa ekle
      if (isReady && readyVote !== null && !votedIds.has(window.RT?.me?.id)) {
        actualVotedCount++;
      }
      
      voteCountEl.textContent = `Oy veren: ${actualVotedCount}/${total}`;
    } else {
      // Görev henüz kaydedilmedi, oy sayısını gösterme
      voteCountEl.textContent = `Görev bekleniyor...`;
    }
    voteCountEl.setAttribute("aria-live","polite");

    // Kartlarda kendi seçimimizi vurgula ve akışa göre enable/disable et
    const myVote = state.revealed ? (state.votes[window.RT?.me?.id] || null) : (window.RT?.myVote || null);
    const disableDeck = state.revealed;
    [...deckEl.querySelectorAll(".card")].forEach(btn => {
      const sel = btn.dataset.value === myVote;
      btn.classList.toggle("selected", sel);
      btn.setAttribute("aria-pressed", sel ? "true" : "false");
      btn.disabled = disableDeck;
    });

    // Görev gösterimi
    const currentTaskDisplay = document.getElementById('currentTaskDisplay');
    const currentTaskText = document.getElementById('currentTaskText');
    const taskInputContainer = document.querySelector('.task-input-container');
    
    if (state.currentTask && state.currentTask.trim()) {
      // Aktif görev var - göster
      currentTaskDisplay.style.display = 'block';
      currentTaskText.textContent = state.currentTask;
      
      // Görev meta bilgilerini güncelle
      updateTaskMeta();
      
      // Progress bar'ı göster ve güncelle
      const taskProgress = document.getElementById('taskProgress');
      if (taskProgress) {
        taskProgress.style.display = 'block';
        updateTaskProgress();
      }
      
      // Sadece oda sahibi görev adına tıklayabilsin
      if (isRoomOwner) {
        // Görev adına tıklama olayı ekle
        currentTaskText.onclick = () => {
          showTaskEditDialog(state.currentTask);
        };
       
        // Tooltip ekle (sadece oda sahibi için)
        currentTaskText.title = "Bu görev adını değiştirmek için tıklayın";
        currentTaskText.style.cursor = "pointer";
        
        // Düzenle ve kopyala butonlarını göster
        const editBtn = document.getElementById('taskEditBtn');
        const copyBtn = document.getElementById('taskCopyBtn');
        if (editBtn) editBtn.style.display = 'flex';
        if (copyBtn) copyBtn.style.display = 'flex';
        
        // "Değiştirebilirsiniz" yazısını göster
        const taskChangeHint = currentTaskDisplay.querySelector('.task-change-hint');
        if (taskChangeHint) {
          taskChangeHint.style.display = "block";
        }
      } else {
        // Oda sahibi değilse tıklama olayını kaldır
        currentTaskText.onclick = null;
        currentTaskText.title = "";
        currentTaskText.style.cursor = "default";
        
        // Düzenle ve kopyala butonlarını gizle
        const editBtn = document.getElementById('taskEditBtn');
        const copyBtn = document.getElementById('taskCopyBtn');
        if (editBtn) editBtn.style.display = 'none';
        if (copyBtn) copyBtn.style.display = 'none';
        
        // "Değiştirebilirsiniz" yazısını gizle
        const taskChangeHint = currentTaskDisplay.querySelector('.task-change-hint');
        if (taskChangeHint) {
          taskChangeHint.style.display = "none";
        }
      }
      
      // Görev giriş alanını gizle
      taskInputContainer.style.display = 'none';
    } else {
      // Aktif görev yok - sadece oda sahibi giriş alanını görebilsin
      if (isRoomOwner) {
        currentTaskDisplay.style.display = 'none';
        taskInputContainer.style.display = 'flex';
        
        // Progress bar'ı gizle
        const taskProgress = document.getElementById('taskProgress');
        if (taskProgress) {
          taskProgress.style.display = 'none';
        }
      } else {
        // Oda sahibi değilse görev bekleniyor mesajı göster
        currentTaskDisplay.style.display = 'block';
        currentTaskText.textContent = "Görev bekleniyor...";
        currentTaskText.onclick = null;
        currentTaskText.title = "";
        currentTaskText.style.cursor = "default";
        taskInputContainer.style.display = 'none';
        
        // Progress bar'ı gizle
        const taskProgress = document.getElementById('taskProgress');
        if (taskProgress) {
          taskProgress.style.display = 'none';
        }
        
        // "Değiştirebilirsiniz" yazısını gizle
        const taskChangeHint = currentTaskDisplay.querySelector('.task-change-hint');
        if (taskChangeHint) {
          taskChangeHint.style.display = "none";
        }
      }
    }

    // İstatistikler
    if (state.revealed) {
      statsEl.classList.remove("muted");
      statsEl.textContent = calcStats(state.votes);
      
      // Reveal sonrası pop-up göster
      if (state.currentTask && state.votes && Object.keys(state.votes).length > 0) {
        // İstatistikleri hesapla
        const stats = calculateDetailedStats(state.votes);
        
        // Pop-up'ı göster
        setTimeout(() => {
          showRevealResultPopup(state.currentTask, state.votes, stats);
        }, 500); // 500ms gecikme ile göster
      }
    } else {
      statsEl.classList.add("muted");
      statsEl.textContent = "Reveal'dan sonra görünecek.";
    }

    // Görev başlığı UI'sı
    if (taskInput) {
      // Sadece oda sahibi görev yazabilsin
      if (isRoomOwner) {
        // Kullanıcının yazdığı yazıyı KESİNLİKLE koru
        if (userTypedTask && userTypedTask.trim()) {
          // Eğer kullanıcı bir şey yazdıysa, onu koru
          if (taskInput.value !== userTypedTask) {
            taskInput.value = userTypedTask;
          }
        } else if (state.currentTask && state.currentTask.trim() && document.activeElement !== taskInput) {
          // Eğer kullanıcı yazmadıysa ama görev kaydedildiyse, görev adını göster
          if (taskInput.value !== state.currentTask) {
            taskInput.value = state.currentTask;
          }
        }
        
        // Kart seçimi sonrası yazıyı korumak için ek kontrol
        if (userTypedTask && userTypedTask.trim() && !state.currentTask) {
          // Eğer kullanıcı yazdıysa ama görev henüz kaydedilmediyse, yazıyı koru
          if (taskInput.value !== userTypedTask) {
            taskInput.value = userTypedTask;
          }
        }
        
                 // Input'u aktif et
         taskInput.disabled = false;
         taskInput.placeholder = "Görev adını yazın veya tıklayın...";
      } else {
                 // Oda sahibi değilse input'u devre dışı bırak
         taskInput.disabled = true;
         taskInput.placeholder = "🔒 Sadece oda sahibi görev ekleyebilir";
        taskInput.value = state.currentTask || "";
      }
    }
    // Geri Al özelliği kaldırıldı; reveal'e kadar istediğin kadar Kaydet edebilirsin

    // Reveal butonunu akışa göre pasif/aktif yap
    if (revealBtn) {
      const hasTask = (state.currentTask || "").trim().length > 0;
      const hasAnyVote = votedCount > 0;
      const canReveal = hasTask && !state.revealed && hasAnyVote;
      
      // Debug için console.log ekle
      console.log("Reveal Button Debug:", {
        hasTask,
        hasAnyVote,
        votedCount,
        currentTask: state.currentTask,
        revealed: state.revealed,
        votes: state.votes,
        voted: state.voted,
        voteCount: state.voteCount,
        "state.voted.length": state.voted ? state.voted.length : "undefined",
        "state.voteCount": state.voteCount
      });
      
      revealBtn.disabled = !canReveal;
      revealBtn.title = canReveal ? "Reveal" : "Önce görev ve en az bir oy gerekli.";
    }

      // Geçmiş listesi - hem eski liste hem de tablo için
  if (historyEl) {
    historyEl.innerHTML = "";
    const list = Array.isArray(state.history) ? state.history : [];
    if (list.length === 0) {
      const li = document.createElement("li");
      li.textContent = "Henüz geçmiş yok.";
      historyEl.appendChild(li);
    } else {
      list.forEach(item => {
        const li = document.createElement("li");
        const date = new Date(item.revealedAt || Date.now());
        const title = item.task && item.task.length ? item.task : "(Görev adı yok)";
        const summary = item.stats && item.stats.summary ? item.stats.summary : "";
        li.textContent = `${date.toLocaleString()} — ${title}\n${summary}`;
        historyEl.appendChild(li);
      });
    }
  }
  
  // Geçmiş tablosunu da güncelle
  if (window.renderHistoryTable) {
    const history = Array.isArray(state.history) ? state.history : [];
    window.renderHistoryTable(history);
  }
  
  // Progress bar'ı güncelle
  updateTaskProgress();
  };

  // İlk yüklemede RT.state varsa hemen çiz (script yüklenme sırası yarışı için)
  if (window.RT && window.RT.state) {
    try { window.renderRoom(window.RT.state); } catch (e) {}
    // İlk anda history'yi de talep et
    try { window.RT.getState && window.RT.getState(); } catch (e) {}
  }

  // Realtime katmanından gelen özel olayı da dinle (yarış durumlarına karşı)
  window.addEventListener("rt:state", (ev) => {
    if (ev && ev.detail) {
      // Reset sonrası hazır sistemini kontrol et
      const state = ev.detail;
      if (!state.revealed && 
          (!state.votes || Object.keys(state.votes).length === 0) &&
          (!state.currentTask || !state.currentTask.trim())) {
        console.log("🔍 Debug: rt:state'de reset tespit edildi, hazır sistem sıfırlanıyor");
        isReady = false;
        readyVote = null;
        selectedCard = null;
        
        // window.RT.myVote'u da sıfırla
        if (window.RT && window.RT.myVote !== undefined) {
          window.RT.myVote = null;
        }
        
        // Kartları aktif et
        document.querySelectorAll('.card').forEach(card => {
          card.classList.remove('selected');
          card.style.opacity = '1';
          card.style.pointerEvents = 'auto';
        });
        
        // Hazır butonunu güncelle
        updateReadyButton();
      }
      
      try { window.renderRoom(ev.detail); } catch (e) {}
    }
  });
  window.addEventListener("rt:history", (ev) => {
    if (!historyEl) return;
    const history = Array.isArray(ev.detail) ? ev.detail : [];
    historyEl.innerHTML = "";
    history.forEach(item => {
      const li = document.createElement("li");
      const date = new Date(item.revealedAt || Date.now());
      const title = item.task && item.task.length ? item.task : "(Görev adı yok)";
      const summary = item.stats && item.stats.summary ? item.stats.summary : "";
      li.textContent = `${date.toLocaleString()} — ${title}\n${summary}`;
      historyEl.appendChild(li);
    });
  });

  // ===== SWEET ALERT FONKSİYONLARI =====
  
  // Görev ekleme dialog'u
  function showTaskInputDialog() {
    Swal.fire({
      title: 'Görev Ekle',
      input: 'text',
      inputLabel: 'Görev adını girin',
      inputPlaceholder: 'Örn: US-123: Login sayfası tasarımı',
      inputValue: userTypedTask || '',
      showCancelButton: true,
      confirmButtonText: 'Kaydet',
      cancelButtonText: 'İptal',
      background: '#1e1b4b', // Koyu mavi arka plan
      color: '#ffffff', // Beyaz yazı
      confirmButtonColor: '#6366f1', // İndigo buton
      cancelButtonColor: '#6b7280', // Gri buton
      inputValidator: (value) => {
        if (!value || !value.trim()) {
          return 'Görev adı boş olamaz!';
        }
        if (value.trim().length < 3) {
          return 'Görev adı en az 3 karakter olmalı!';
        }
      },
      preConfirm: (taskName) => {
        const trimmedTask = taskName.trim();
        userTypedTask = trimmedTask; // Kullanıcının yazısını kaydet
        return trimmedTask;
      }
    }).then((result) => {
      if (result.isConfirmed && result.value) {
        if (window.RT && window.RT.setTask) {
          window.RT.setTask(result.value);
          showSuccessMessage('Görev başarıyla kaydedildi!');
        }
      }
    });
  }
  
  // Görev düzenleme dialog'u
  function showTaskEditDialog(currentTask) {
    Swal.fire({
      title: 'Görev Düzenle',
      input: 'text',
      inputLabel: 'Görev adını güncelleyin',
      inputPlaceholder: 'Örn: US-123: Login sayfası tasarımı',
      inputValue: currentTask || '',
      showCancelButton: true,
      confirmButtonText: 'Güncelle',
      cancelButtonText: 'İptal',
      background: '#1e1b4b', // Koyu mavi arka plan
      color: '#ffffff', // Beyaz yazı
      confirmButtonColor: '#6366f1', // İndigo buton
      cancelButtonColor: '#6b7280', // Gri buton
      inputValidator: (value) => {
        if (!value || !value.trim()) {
          return 'Görev adı boş olamaz!';
        }
        if (value.trim().length < 3) {
          return 'Görev adı en az 3 karakter olmalı!';
        }
      },
      preConfirm: (taskName) => {
        const trimmedTask = taskName.trim();
        userTypedTask = trimmedTask; // Kullanıcının yazısını kaydet
        return trimmedTask;
      }
    }).then((result) => {
      if (result.isConfirmed && result.value) {
        if (window.RT && window.RT.setTask) {
          window.RT.setTask(result.value);
          showSuccessMessage('Görev başarıyla güncellendi!');
        }
      }
    });
  }
  
  // Reveal onay dialog'u
  function showRevealConfirmDialog() {
    Swal.fire({
      title: 'Oyları Göster?',
      text: 'Tüm oylar görünür hale gelecek. Devam etmek istiyor musunuz?',
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Evet, Göster',
      cancelButtonText: 'İptal',
      background: '#1e1b4b', // Koyu mavi arka plan
      color: '#ffffff', // Beyaz yazı
      confirmButtonColor: '#3085d6',
      cancelButtonColor: '#d33'
    }).then((result) => {
      if (result.isConfirmed) {
        if (window.RT && window.RT.reveal) {
          window.RT.reveal();
          showSuccessMessage('Oylar gösteriliyor...');
        }
      }
    });
  }
  
  // Reveal sonrası sonuç pop-up'ı
  function showRevealResultPopup(taskName, votes, stats) {
    // Önceki pop-up'ı kapat
    if (window.currentRevealPopup) {
      window.currentRevealPopup.close();
    }
    
    // Yeni pop-up oluştur
    window.currentRevealPopup = Swal.fire({
      title: '🎯 Görev Sonucu',
      html: `
        <div class="reveal-result-container">
          <div class="task-info">
            <h4>📋 ${taskName}</h4>
          </div>
          
          <div class="vote-summary">
            <h5>🗳️ Oy Dağılımı</h5>
            <div class="vote-distribution">
              ${generateVoteDistributionHTML(votes)}
            </div>
          </div>
          
          <div class="stats-summary">
            <h5>📊 İstatistikler</h5>
            <div class="stats-grid">
              <div class="stat-item">
                <span class="stat-label">Ortalama:</span>
                <span class="stat-value">${stats.average ? stats.average.toFixed(1) : 'N/A'}</span>
              </div>
              <div class="stat-item">
                <span class="stat-label">Medyan:</span>
                <span class="stat-value">${stats.median || 'N/A'}</span>
              </div>
              <div class="stat-item">
                <span class="stat-label">En Çok:</span>
                <span class="stat-value">${stats.mode ? stats.mode.join(', ') : 'N/A'}</span>
              </div>
              <div class="stat-item">
                <span class="stat-label">Toplam Oy:</span>
                <span class="stat-value">${stats.count || Object.keys(votes).length}</span>
              </div>
            </div>
          </div>
        </div>
      `,
      icon: 'success',
      confirmButtonText: 'Kapat',
      background: '#1e1b4b',
      color: '#ffffff',
      confirmButtonColor: '#6366f1',
      width: '600px',
      customClass: {
        container: 'reveal-result-popup'
      }
    });
  }
  
  // Oy dağılımı HTML'i oluştur
  function generateVoteDistributionHTML(votes) {
    const voteCounts = {};
    Object.values(votes).forEach(vote => {
      voteCounts[vote] = (voteCounts[vote] || 0) + 1;
    });
    
    let html = '<div class="vote-bars">';
    Object.entries(voteCounts).forEach(([vote, count]) => {
      const percentage = ((count / Object.keys(votes).length) * 100).toFixed(1);
      const barWidth = Math.max(20, percentage * 2); // Minimum 20px genişlik
      
      html += `
        <div class="vote-bar-item">
          <div class="vote-label">${vote}</div>
          <div class="vote-bar">
            <div class="vote-bar-fill" style="width: ${barWidth}px"></div>
          </div>
          <div class="vote-count">${count}</div>
        </div>
      `;
    });
    html += '</div>';
    
    return html;
  }
  
  // Reset onay dialog'u
  function showResetConfirmDialog() {
    Swal.fire({
      title: 'Sıfırla?',
      text: 'Tüm oylar ve görev temizlenecek. Bu işlem geri alınamaz!',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Evet, Sıfırla',
      cancelButtonText: 'İptal',
      background: '#1e1b4b', // Koyu mavi arka plan
      color: '#ffffff', // Beyaz yazı
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6'
    }).then((result) => {
      if (result.isConfirmed) {
        if (window.RT && window.RT.reset) {
          userTypedTask = ""; // Kullanıcının yazısını da temizle
          window.RT.reset();
          showSuccessMessage('Oda sıfırlandı!');
        }
      }
    });
  }
  
  // Başarı mesajı
  function showSuccessMessage(message) {
    Swal.fire({
      title: 'Başarılı!',
      text: message,
      icon: 'success',
      timer: 2000,
      timerProgressBar: true,
      showConfirmButton: false,
      background: '#1e1b4b', // Koyu mavi arka plan
      color: '#ffffff' // Beyaz yazı
    });
  }
  
  // Hata mesajı
  function showErrorMessage(message) {
    Swal.fire({
      title: 'Hata!',
      text: message,
      icon: 'error',
      confirmButtonText: 'Tamam',
      background: '#1e1b4b', // Koyu mavi arka plan
      color: '#ffffff', // Beyaz yazı
      confirmButtonColor: '#6366f1' // İndigo buton
    });
  }
  
  // Bilgi mesajı
  function showInfoMessage(message) {
    Swal.fire({
      title: 'Bilgi',
      text: message,
      icon: 'info',
      confirmButtonText: 'Tamam',
      background: '#1e1b4b', // Koyu mavi arka plan
      color: '#ffffff', // Beyaz yazı
      confirmButtonColor: '#6366f1' // İndigo buton
    });
  }
  
  // Odadan çıkma onay dialog'u
  function showLeaveConfirmDialog() {
    Swal.fire({
      title: 'Odadan Çık?',
      text: 'Odadan çıkmak istediğinizden emin misiniz?',
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Evet, Çık',
      cancelButtonText: 'İptal',
      background: '#1e1b4b', // Koyu mavi arka plan
      color: '#ffffff', // Beyaz yazı
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6'
    }).then((result) => {
      if (result.isConfirmed) {
        if (window.RT && window.RT.leave) {
          window.RT.leave();
        }
      }
    });
  }

  // ===== CHAT FUNCTIONS =====
  
  // Chat elementleri
  const chatMessagesEl = document.getElementById("chatMessages");
  const chatInputEl = document.getElementById("chatInput");
  const chatSendBtn = document.getElementById("chatSendBtn");
  
  // Chat mesajı gönderme
  function sendChatMessage() {
    const message = chatInputEl.value.trim();
    if (!message) return;
    
         // Mesaj uzunluğu kontrolü (200 karakter sınırı)
     if (message.length > 200) {
       showInfoMessage("Mesaj çok uzun! Maksimum 200 karakter kullanabilirsiniz.");
       return;
     }
    
    if (window.RT && window.RT.sendChatMessage) {
      window.RT.sendChatMessage(message);
      chatInputEl.value = "";
      chatInputEl.focus();
      
      // Gönder butonunu geçici olarak devre dışı bırak
      if (chatSendBtn) {
        chatSendBtn.disabled = true;
        chatSendBtn.textContent = "Gönderiliyor...";
        setTimeout(() => {
          chatSendBtn.disabled = false;
          chatSendBtn.textContent = "Gönder";
        }, 1000);
      }
    }
  }
  
    // Chat mesajı ekleme
  function addChatMessage(chatMessage) {
    if (!chatMessagesEl) return;
    
    const messageEl = document.createElement("div");
    messageEl.className = "chat-message";
    messageEl.setAttribute("data-message-id", chatMessage.id);
    
    const time = new Date(chatMessage.timestamp);
    const timeString = time.toLocaleTimeString('tr-TR', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
    
    // Mesaj içeriğini güvenli hale getir (XSS koruması)
    const safeMessage = chatMessage.message
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
    
    // Kullanıcı adını da güvenli hale getir
    const safeUser = chatMessage.user
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
    
    messageEl.innerHTML = `
      <div class="chat-message-header">
        <span class="chat-message-user" title="${safeUser}">${safeUser}</span>
        <span class="chat-message-time">${timeString}</span>
      </div>
      <div class="chat-message-content">${safeMessage.replace(/\n/g, '<br>')}</div>
    `;
    
    chatMessagesEl.appendChild(messageEl);
    
         // Tüm mesajları göster (scroll ile erişilebilir)
    
         // Otomatik scroll (smooth) - sadece ana chat'te
     setTimeout(() => {
       chatMessagesEl.scrollTo({
         top: chatMessagesEl.scrollHeight,
         behavior: 'smooth'
       });
     }, 100);
    
    // Modal'ı da güncelle (eğer açıksa)
    updateModalMessages();
  }
  
  // Chat geçmişini yükle
  function loadChatHistory(chatHistory) {
    if (!chatMessagesEl) return;
    
    chatMessagesEl.innerHTML = "";
    
         // Tüm mesajları göster (scroll ile erişilebilir)
     const lastMessages = chatHistory;
    lastMessages.forEach(message => {
      addChatMessage(message);
    });
  }
  
  // Chat event listener'ları
  if (chatSendBtn) {
    chatSendBtn.addEventListener("click", sendChatMessage);
  }
  
  if (chatInputEl) {
    chatInputEl.addEventListener("keypress", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        sendChatMessage();
      }
    });
    
         // Input focus'ta scroll - sadece ana chat'te
     chatInputEl.addEventListener("focus", () => {
       setTimeout(() => {
         chatMessagesEl.scrollTo({
           top: chatMessagesEl.scrollHeight,
           behavior: 'smooth'
         });
       }, 100);
     });
    
    // Karakter sayacı ekle
    const charCounter = document.createElement("div");
    charCounter.className = "char-counter";
    charCounter.style.cssText = `
      font-size: 0.75rem;
      color: var(--text-muted);
      text-align: right;
      margin-top: 0.25rem;
      font-style: italic;
    `;
    
    if (chatInputEl.parentNode) {
      chatInputEl.parentNode.appendChild(charCounter);
    }
    
         // Karakter sayısını güncelle
     function updateCharCounter() {
       const length = chatInputEl.value.length;
       const maxLength = 200;
       const remaining = maxLength - length;
       
       if (length > maxLength * 0.8) {
         charCounter.style.color = length > maxLength * 0.9 ? 'var(--danger-color)' : 'var(--warning-color)';
       } else {
         charCounter.style.color = 'var(--text-muted)';
       }
       
       charCounter.textContent = `${length}/${maxLength} karakter`;
     }
    
    chatInputEl.addEventListener("input", updateCharCounter);
    updateCharCounter(); // İlk yükleme
  }
  
  // Chat mesajlarını dinle
  window.addEventListener("rt:chatMessage", (e) => {
    addChatMessage(e.detail);
  });
  
  window.addEventListener("rt:chatHistory", (e) => {
    loadChatHistory(e.detail);
  });
  
  // Görev meta bilgilerini güncelle
  function updateTaskMeta() {
    const taskStartTime = document.getElementById('taskStartTime');
    const taskParticipantCount = document.getElementById('taskParticipantCount');
    
    if (taskStartTime) {
      const now = new Date();
      taskStartTime.textContent = now.toLocaleTimeString('tr-TR', {
        hour: '2-digit',
        minute: '2-digit'
      });
    }
    
    if (taskParticipantCount) {
      const participantCount = window.RT?.state?.users?.length || 0;
      taskParticipantCount.textContent = participantCount;
    }
  }
  
  // Görev progress'ini güncelle
  function updateTaskProgress() {
    const progressFill = document.getElementById('progressFill');
    const progressPercentage = document.getElementById('progressPercentage');
    const votedCount = document.getElementById('votedCount');
    const waitingCount = document.getElementById('waitingCount');
    
    if (!progressFill || !progressPercentage || !votedCount || !waitingCount) return;
    
    const state = window.RT?.state;
    if (!state || !state.users) return;
    
    // Reset sonrası hazır sistemini kontrol et
    if (!state.revealed && 
        (!state.votes || Object.keys(state.votes).length === 0) &&
        (!state.currentTask || !state.currentTask.trim())) {
      console.log("🔍 Debug: updateTaskProgress'de reset tespit edildi, hazır sistem sıfırlanıyor");
      isReady = false;
      readyVote = null;
      selectedCard = null;
      
      // window.RT.myVote'u da sıfırla
      if (window.RT && window.RT.myVote !== undefined) {
        window.RT.myVote = null;
      }
      
      // Kartları aktif et
      document.querySelectorAll('.card').forEach(card => {
        card.classList.remove('selected');
        card.style.opacity = '1';
        card.style.pointerEvents = 'auto';
      });
      
      // Hazır butonunu güncelle
      updateReadyButton();
    }
    
    const totalUsers = state.users.length;
    
    // Local state'den oy veren sayısını al
    let votedUsers = 0;
    
    // 1. State'den gelen oyları say - hem votes hem de voted kullan
    if (state.votes && Object.keys(state.votes).length > 0) {
      votedUsers = Object.keys(state.votes).length;
    } else if (state.voted && Array.isArray(state.voted)) {
      votedUsers = state.voted.length;
    }
    
    // 2. Mevcut kullanıcının oyunu da ekle (eğer hazır ise ama henüz state'e yansımamışsa)
    if (isReady && readyVote !== null && window.RT?.me?.id) {
      // Eğer mevcut kullanıcının oyu state'de yoksa ekle
      const hasVoted = (state.votes && state.votes[window.RT.me.id]) || 
                       (state.voted && state.voted.includes(window.RT.me.id));
      if (!hasVoted) {
        votedUsers++;
        console.log("🔍 Debug: Mevcut kullanıcı oy verdi, sayıya eklendi");
      }
    }
    
    const waitingUsers = totalUsers - votedUsers;
    const percentage = totalUsers > 0 ? Math.round((votedUsers / totalUsers) * 100) : 0;
    
    // Progress bar'ı güncelle
    progressFill.style.width = `${percentage}%`;
    progressPercentage.textContent = `${percentage}%`;
    
    // Sayıları güncelle
    votedCount.textContent = votedUsers;
    waitingCount.textContent = waitingUsers;
    
    // Progress bar rengini ayarla
    if (percentage === 100) {
      progressFill.style.background = 'linear-gradient(90deg, var(--success-color), #059669)';
    } else if (percentage >= 50) {
      progressFill.style.background = 'linear-gradient(90deg, var(--warning-color), var(--success-color))';
    } else {
      progressFill.style.background = 'linear-gradient(90deg, var(--primary-color), var(--warning-color))';
    }
    
    console.log("🔍 Debug: Progress güncellendi:", {
      totalUsers,
      votedUsers,
      waitingUsers,
      percentage,
      isReady,
      readyVote,
      localVote: state.votes?.[window.RT?.me?.id],
      stateVotes: state.votes,
      stateVoted: state.voted,
      hasVoted: (state.votes && state.votes[window.RT?.me?.id]) || 
                (state.voted && state.voted.includes(window.RT?.me?.id))
    });
  }
  
  // Görev kopyalama fonksiyonu
  function copyTaskToClipboard() {
    const currentTask = window.RT?.state?.currentTask;
    if (currentTask) {
      navigator.clipboard.writeText(currentTask).then(() => {
        // Başarılı kopyalama mesajı
        Swal.fire({
          icon: 'success',
          title: 'Kopyalandı!',
          text: 'Görev adı panoya kopyalandı',
          toast: true,
          position: 'top-end',
          showConfirmButton: false,
          timer: 2000,
          timerProgressBar: true,
          background: 'var(--bg-secondary)',
          color: 'var(--text-primary)'
        });
      }).catch(() => {
        // Hata durumunda fallback
        const textArea = document.createElement('textarea');
        textArea.value = currentTask;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        
        Swal.fire({
          icon: 'success',
          title: 'Kopyalandı!',
          text: 'Görev adı panoya kopyalandı',
          toast: true,
          position: 'top-end',
          showConfirmButton: false,
          timer: 2000,
          timerProgressBar: true,
          background: 'var(--bg-secondary)',
          color: 'var(--text-primary)'
        });
      });
    }
  }
  
    // Chat Modal Functions
  function openChatModal() {
    const chatModal = document.getElementById('chatModal');
    if (chatModal) {
      chatModal.style.display = 'flex';
      
      // Modal input'a focus ol
      const modalInput = document.getElementById('chatModalInput');
      if (modalInput) {
        setTimeout(() => modalInput.focus(), 100);
      }
      
      // Modal mesajlarını güncelle (otomatik scroll yok)
      updateModalMessages();
      
      // Katılımcı sayısını güncelle
      updateModalParticipants();
      
      // Modal sürükleme özelliğini etkinleştir
      enableModalDragging();
      
      // Body scroll'u engelle
      document.body.style.overflow = 'hidden';
    }
  }
  
       function closeChatModal() {
    const chatModal = document.getElementById('chatModal');
    if (chatModal) {
      chatModal.style.display = 'none';
      
      // Body scroll'u geri aç
      document.body.style.overflow = 'auto';
      
      // Modal pozisyonunu sıfırla
      const modalContent = document.querySelector('.chat-modal-content');
      if (modalContent) {
        modalContent.style.transform = 'translate(0px, 0px)';
      }
      
      // Modal scroll durumunu sıfırla (bir sonraki açılışta tekrar en alta scroll yapabilsin)
      const modalMessages = document.getElementById('chatModalMessages');
      if (modalMessages) {
        modalMessages.dataset.initialized = '';
      }
      
      // Ana chat input'a focus ol
      const mainChatInput = document.getElementById('chatInput');
      if (mainChatInput) {
        mainChatInput.focus();
      }
    }
  }
  
       function updateModalMessages() {
    const modalMessages = document.getElementById('chatModalMessages');
    const mainMessages = document.getElementById('chatMessages');
    
    if (modalMessages && mainMessages) {
      // Kullanıcının mevcut scroll pozisyonunu kaydet
      const currentScrollTop = modalMessages.scrollTop;
      const isAtBottom = modalMessages.scrollTop + modalMessages.clientHeight >= modalMessages.scrollHeight - 10;
      
      // Ana chat'teki tüm mesajları modal'a kopyala
      modalMessages.innerHTML = mainMessages.innerHTML;
      
      // Sadece ilk açılışta veya kullanıcı en alttaysa scroll yap
      if (!modalMessages.dataset.initialized) {
        // İlk açılışta en alta scroll yap
        setTimeout(() => {
          modalMessages.scrollTop = modalMessages.scrollHeight;
          modalMessages.dataset.initialized = 'true';
        }, 100);
      } else if (isAtBottom) {
        // Kullanıcı en alttaysa yeni mesajla birlikte scroll yap
        setTimeout(() => {
          modalMessages.scrollTop = modalMessages.scrollHeight;
        }, 100);
      } else {
        // Kullanıcı yukarıda scroll yapmışsa pozisyonu koru
        modalMessages.scrollTop = currentScrollTop;
      }
    }
  }
  
  function updateModalParticipants() {
    const modalParticipants = document.getElementById('chatModalParticipants');
    const state = window.RT?.state;
    
    if (modalParticipants && state && state.users) {
      const count = state.users.length;
      modalParticipants.textContent = `${count} katılımcı`;
    }
  }
  
  function sendModalMessage() {
    const modalInput = document.getElementById('chatModalInput');
    const message = modalInput?.value?.trim();
    
    if (!message) return;
    
    if (window.RT && window.RT.sendChatMessage) {
      window.RT.sendChatMessage(message);
      modalInput.value = '';
      modalInput.focus();
      
           // Modal mesajlarını güncelle (tüm mesajlar gözüksün, scroll ile erişilebilir)
     setTimeout(updateModalMessages, 100);
    }
  }
  
  function updateModalCharCounter() {
    const modalInput = document.getElementById('chatModalInput');
    const charCounter = document.getElementById('chatModalCharCounter');
    
    if (modalInput && charCounter) {
      const length = modalInput.value.length;
      const maxLength = 200;
      
      charCounter.textContent = `${length}/${maxLength}`;
      
      // Renk değişimi
      if (length > maxLength * 0.9) {
        charCounter.style.color = length > maxLength * 0.95 ? 'var(--danger-color)' : 'var(--warning-color)';
      } else {
        charCounter.style.color = 'var(--text-muted)';
      }
    }
  }
  
  // Modal sürükleme fonksiyonları
  let isDragging = false;
  let dragStartX = 0;
  let dragStartY = 0;
  let modalStartX = 0;
  let modalStartY = 0;
  
  function enableModalDragging() {
    const modalHeader = document.querySelector('.chat-modal-header');
    const modalContent = document.querySelector('.chat-modal-content');
    
    if (!modalHeader || !modalContent) return;
    
    // Mouse down event
    modalHeader.addEventListener('mousedown', (e) => {
      isDragging = true;
      dragStartX = e.clientX;
      dragStartY = e.clientY;
      
      // Modal'ın mevcut pozisyonunu al
      const rect = modalContent.getBoundingClientRect();
      modalStartX = rect.left;
      modalStartY = rect.top;
      
      // Cursor'ı değiştir
      document.body.style.cursor = 'grabbing';
      
      // Event listener'ları ekle
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      
      // Text seçimini engelle
      e.preventDefault();
    });
  }
  
  function handleMouseMove(e) {
    if (!isDragging) return;
    
    const modalContent = document.querySelector('.chat-modal-content');
    if (!modalContent) return;
    
    // Yeni pozisyonu hesapla
    const deltaX = e.clientX - dragStartX;
    const deltaY = e.clientY - dragStartY;
    
    const newX = modalStartX + deltaX;
    const newY = modalStartY + deltaY;
    
    // Modal'ı taşı
    modalContent.style.transform = `translate(${deltaX}px, ${deltaY}px)`;
  }
  
  function handleMouseUp() {
    if (!isDragging) return;
    
    isDragging = false;
    
    // Cursor'ı geri al
    document.body.style.cursor = 'default';
    
    // Event listener'ları kaldır
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
    
    // Modal'ın pozisyonunu kalıcı hale getir
    const modalContent = document.querySelector('.chat-modal-content');
    if (modalContent) {
      const transform = modalContent.style.transform;
      if (transform && transform !== 'translate(0px, 0px)') {
        // Pozisyonu CSS transform ile kaydet
        modalContent.style.transform = transform;
      }
    }
  }
  
  // Event listener'ları ekle
  document.addEventListener('DOMContentLoaded', function() {
    // Kopyala butonu
    const copyBtn = document.getElementById('taskCopyBtn');
    if (copyBtn) {
      copyBtn.addEventListener('click', copyTaskToClipboard);
    }
    
    // Düzenle butonu
    const editBtn = document.getElementById('taskEditBtn');
    if (editBtn) {
      editBtn.addEventListener('click', () => {
        const currentTask = window.RT?.state?.currentTask;
        if (currentTask) {
          showTaskEditDialog(currentTask);
        }
      });
    }
    
    // Chat Modal Event Listeners
    const chatOpenBtn = document.getElementById('chatOpenBtn');
    if (chatOpenBtn) {
      chatOpenBtn.addEventListener('click', openChatModal);
    }
    
    const chatModalClose = document.getElementById('chatModalClose');
    if (chatModalClose) {
      chatModalClose.addEventListener('click', closeChatModal);
    }
    
    // Modal overlay'e tıklayınca kapat
    const chatModalOverlay = document.querySelector('.chat-modal-overlay');
    if (chatModalOverlay) {
      chatModalOverlay.addEventListener('click', closeChatModal);
    }
    
    // Modal input event listener'ları
    const chatModalInput = document.getElementById('chatModalInput');
    if (chatModalInput) {
      // Enter tuşu ile gönder
      chatModalInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          sendModalMessage();
        }
      });
      
      // Karakter sayacı
      chatModalInput.addEventListener('input', updateModalCharCounter);
    }
    
    // Modal gönder butonu
    const chatModalSendBtn = document.getElementById('chatModalSendBtn');
    if (chatModalSendBtn) {
      chatModalSendBtn.addEventListener('click', sendModalMessage);
    }
    
    // ESC tuşu ile modal'ı kapat
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        const chatModal = document.getElementById('chatModal');
        if (chatModal && chatModal.style.display === 'flex') {
          closeChatModal();
        }
      }
    });
    
    // Help butonu
    const helpBtn = document.querySelector('.task-help-btn');
    if (helpBtn) {
      helpBtn.addEventListener('click', () => {
        Swal.fire({
          title: 'Görev Nasıl Kullanılır?',
          html: `
            <div style="text-align: left; color: var(--text-primary);">
              <h4 style="color: var(--primary-light); margin-bottom: 1rem;">📋 Görev Yönetimi Rehberi</h4>
              
              <div style="margin-bottom: 1rem;">
                <strong>1. Görev Ekleme:</strong><br>
                • Görev adını yazın (örn: US-123: Login sayfası tasarımı)<br>
                • Kaydet butonuna tıklayın
              </div>
              
              <div style="margin-bottom: 1rem;">
                <strong>2. Oy Verme:</strong><br>
                • Görev kaydedildikten sonra kartlardan birini seçin<br>
                • Hazır butonuna tıklayın
              </div>
              
              <div style="margin-bottom: 1rem;">
                <strong>3. Sonuç:</strong><br>
                • Tüm oylar verildikten sonra Reveal butonuna tıklayın<br>
                • Sonuçları görün ve tartışın
              </div>
              
              <div>
                <strong>4. Yeni Görev:</strong><br>
                • Reset butonuna tıklayarak yeni göreve geçin
              </div>
            </div>
          `,
          icon: 'info',
          confirmButtonText: 'Anladım',
          background: 'var(--bg-secondary)',
          color: 'var(--text-primary)',
          confirmButtonColor: 'var(--primary-color)'
        });
      });
    }
  });

  // Geçmiş listesini render et (yeni tasarım)
  window.renderHistoryTable = function(history) {
    const historyList = document.getElementById('historyList');
    const historyEmpty = document.getElementById('historyEmpty');
    
    if (!historyList) return;
    
    historyList.innerHTML = "";
    
    if (!history || history.length === 0) {
      if (historyEmpty) {
        historyEmpty.style.display = 'flex';
      }
      return;
    }
    
    if (historyEmpty) {
      historyEmpty.style.display = 'none';
    }
    
    history.forEach((item, index) => {
      const historyItem = document.createElement('div');
      historyItem.className = 'history-item';
      
      // Header
      const header = document.createElement('div');
      header.className = 'history-header';
      
      // Görev adı
      const taskDiv = document.createElement('div');
      taskDiv.className = 'history-task';
      taskDiv.textContent = item.task || '(Görev adı yok)';
      
      // Skor
      const scoreDiv = document.createElement('div');
      if (item.stats && item.stats.average !== null) {
        scoreDiv.className = 'history-score';
        scoreDiv.textContent = item.stats.average.toFixed(1);
      } else {
        scoreDiv.className = 'history-score';
        scoreDiv.textContent = '-';
        scoreDiv.style.background = 'var(--bg-tertiary)';
      }
      
      header.appendChild(taskDiv);
      header.appendChild(scoreDiv);
      
      // Tarih
      const dateDiv = document.createElement('div');
      dateDiv.className = 'history-date';
      const date = new Date(item.revealedAt || Date.now());
      dateDiv.textContent = date.toLocaleDateString('tr-TR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
      
      // İstatistikler
      const statsDiv = document.createElement('div');
      statsDiv.className = 'history-stats';
      
      if (item.stats) {
        // Oy sayısı
        if (item.stats.count) {
          const statDiv = document.createElement('div');
          statDiv.className = 'history-stat';
          statDiv.innerHTML = `
            <span class="history-stat-label">Oy Sayısı</span>
            <span class="history-stat-value">${item.stats.count}</span>
          `;
          statsDiv.appendChild(statDiv);
        }
        
        // Medyan
        if (item.stats.median !== null && item.stats.median !== undefined) {
          const statDiv = document.createElement('div');
          statDiv.className = 'history-stat';
          statDiv.innerHTML = `
            <span class="history-stat-label">Medyan</span>
            <span class="history-stat-value">${item.stats.median}</span>
          `;
          statsDiv.appendChild(statDiv);
        }
        
        // En çok oy
        if (item.stats.mode && item.stats.mode.length > 0) {
          const statDiv = document.createElement('div');
          statDiv.className = 'history-stat';
          statDiv.innerHTML = `
            <span class="history-stat-label">En Çok</span>
            <span class="history-stat-value">${item.stats.mode.join(', ')}</span>
          `;
          statsDiv.appendChild(statDiv);
        }
        
        // Toplam katılımcı
        if (item.stats.total) {
          const statDiv = document.createElement('div');
          statDiv.className = 'history-stat';
          statDiv.innerHTML = `
            <span class="history-stat-label">Toplam</span>
            <span class="history-stat-value">${item.stats.total}</span>
          `;
          statsDiv.appendChild(statDiv);
        }
      }
      
      // Eğer hiç istatistik yoksa
      if (statsDiv.children.length === 0) {
        const noStatsDiv = document.createElement('div');
        noStatsDiv.style.textAlign = 'center';
        noStatsDiv.style.color = 'var(--text-muted)';
        noStatsDiv.style.fontStyle = 'italic';
        noStatsDiv.textContent = 'İstatistik yok';
        statsDiv.appendChild(noStatsDiv);
      }
      
      // Elemanları birleştir
      historyItem.appendChild(header);
      historyItem.appendChild(dateDiv);
      historyItem.appendChild(statsDiv);
      
      historyList.appendChild(historyItem);
    });
  }
  
  // Geçmiş event listener'ını güncelle
  window.addEventListener("rt:history", (ev) => {
    const history = Array.isArray(ev.detail) ? ev.detail : [];
    renderHistoryTable(history);
  });

  // Chat mesajlarını güncelle
  updateChatMessages();
  
  // Progress bar'ı güncelle
  updateTaskProgress();
})();