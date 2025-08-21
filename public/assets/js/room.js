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
      
      // Kartları yeniden aktif et
      document.querySelectorAll('.card').forEach(card => {
        card.style.opacity = '1';
        card.style.pointerEvents = 'auto';
      });
      
      showSuccessMessage('Hazır durumu iptal edildi. Yeni kart seçebilirsiniz.');
    } else if (selectedCard) {
      // Görev aktif değilse hazır olmaya izin verme
      if (window.RT && window.RT.state && (!window.RT.state.currentTask || !window.RT.state.currentTask.trim())) {
        showInfoMessage("Önce görev adını ayarlamalısınız.");
        return;
      }
      
      // Hazır ol - oy ver
      isReady = true;
      readyVote = selectedCard;
      
      // Kartları pasif et
      document.querySelectorAll('.card').forEach(card => {
        if (!card.classList.contains('selected')) {
          card.style.opacity = '0.5';
          card.style.pointerEvents = 'none';
        }
      });
      
      // Oy ver
      if (window.RT && window.RT.vote) {
        window.RT.vote(selectedCard);
      }
      
      showSuccessMessage(`${selectedCard} oyunuz kaydedildi!`);
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
      if (k === "?") return `${c} kişi belirsiz`;
      if (k === "½") return `${c} kişi 0.5 puan`;
      return `${c} kişi ${k} puan`;
    }).join("\n");

    return `${distText}

📊 Özet: Ortalama ${avg.toFixed(1)} | Medyan ${median} | En çok ${mode}`;
  }

  // UI'yi güncelle
  window.renderRoom = (state) => {
    const total = state.users.length;
    const votedIds = new Set(Array.isArray(state.voted) ? state.voted : Object.keys(state.votes || {}));
    const votedCount = typeof state.voteCount === "number" ? state.voteCount : votedIds.size;
    
    // Oda sahibi kontrolünü güncelle (state'den owner bilgisi gelince)
    if (state.owner && window.RT?.me?.id) {
      isRoomOwner = (state.owner === window.RT.me.id);
      updateOwnerControls();
    }
    
    // Reset sonrası hazır sistemini sıfırla
    if (!state.revealed && votedCount === 0 && Object.keys(state.votes || {}).length === 0) {
      isReady = false;
      readyVote = null;
      selectedCard = null;
      
      // Kartları aktif et
      document.querySelectorAll('.card').forEach(card => {
        card.classList.remove('selected');
        card.style.opacity = '1';
        card.style.pointerEvents = 'auto';
      });
      
      // Hazır butonunu güncelle
      updateReadyButton();
    }

    // Kullanıcı listesi
    userListEl.innerHTML = "";
    state.users.forEach(u => {
      const li = document.createElement("li");
      
      // Kullanıcı adı
      const nameSpan = document.createElement("span");
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
      
      li.appendChild(nameSpan);
      
      // Oy durumu
      const statusSpan = document.createElement("span");
      statusSpan.className = "vote-status";
      
      if (state.revealed) {
        // Reveal sonrası oy göster
        const vote = state.votes[u.id] || "?";
        statusSpan.textContent = ` → ${vote}`;
        statusSpan.className = "vote-status voted";
      } else if (votedIds.has(u.id) && state.currentTask && state.currentTask.trim()) {
        // Oy verdi VE görev kaydedildi
        statusSpan.textContent = " ✅";
        statusSpan.className = "vote-status voted";
      } else if (votedIds.has(u.id) && (!state.currentTask || !state.currentTask.trim())) {
        // Oy verdi ama görev henüz kaydedilmedi
        statusSpan.textContent = " ⏳";
        statusSpan.className = "vote-status waiting";
      } else {
        // Henüz oy vermedi
        statusSpan.textContent = " ⏳";
        statusSpan.className = "vote-status waiting";
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
      // Görev kaydedildi, sadece oy verenleri say
      const actualVotedCount = votedIds.size;
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
      currentTaskDisplay.style.display = 'flex';
      currentTaskText.textContent = state.currentTask;
      
      // "Değiştirebilirsiniz" yazısını bul ve güncelle
      const taskChangeHint = currentTaskDisplay.querySelector('.task-change-hint');
      
      // Sadece oda sahibi görev adına tıklayabilsin
      if (isRoomOwner) {
        // Görev adına tıklama olayı ekle
        currentTaskText.onclick = () => {
          showTaskEditDialog(state.currentTask);
        };
       
        // Tooltip ekle (sadece oda sahibi için)
        currentTaskText.title = "Bu görev adını değiştirmek için tıklayın";
        currentTaskText.style.cursor = "pointer";
        currentTaskText.style.textDecoration = "underline";
        
        // "Değiştirebilirsiniz" yazısını göster
        if (taskChangeHint) {
          taskChangeHint.textContent = "Aktif görevi butona basarak değiştirebilirsiniz";
          taskChangeHint.style.display = "block";
        }
      } else {
        // Oda sahibi değilse tıklama olayını kaldır
        currentTaskText.onclick = null;
        currentTaskText.title = "";
        currentTaskText.style.cursor = "default";
        currentTaskText.style.textDecoration = "none";
        
        // "Değiştirebilirsiniz" yazısını gizle
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
      } else {
        // Oda sahibi değilse görev bekleniyor mesajı göster
        currentTaskDisplay.style.display = 'flex';
        currentTaskText.textContent = "Görev bekleniyor...";
        currentTaskText.onclick = null;
        currentTaskText.title = "";
        currentTaskText.style.cursor = "default";
        currentTaskText.style.textDecoration = "none";
        taskInputContainer.style.display = 'none';
        
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

    // Geçmiş listesi
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
})();