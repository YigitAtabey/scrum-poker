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

  // Kartları oluştur - Poker tarzı
  deckValues.forEach(v => {
    const btn = document.createElement("button");
    btn.className = "card";
    btn.setAttribute("data-value", v);
    
    // Kart içeriğini güzel göster
    let displayText = v;
    let cardClass = "";
    
    if (v === "☕") {
      displayText = "☕";
      cardClass = "coffee-card";
    } else if (v === "?") {
      displayText = "?";
      cardClass = "question-card";
    } else if (v === "½") {
      displayText = "½";
      cardClass = "half-card";
    } else if (v === "0") {
      displayText = "0";
      cardClass = "zero-card";
    } else {
      displayText = v;
      cardClass = "number-card";
    }
    
    btn.textContent = displayText;
    btn.classList.add(cardClass);  

      // Fare ile
  btn.addEventListener("click", () => {
    if (window.RT && window.RT.vote) {
      window.RT.vote(v);
    }
  });

  // Klavye erişilebilirlik
  btn.setAttribute("tabindex", "0");
  btn.setAttribute("aria-label", `Kart ${v}`);
  btn.addEventListener("keypress", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      if (window.RT && window.RT.vote) {
        window.RT.vote(v);
      }
    }
  });

    deckEl.appendChild(btn);
  });

  revealBtn.addEventListener("click", () => {
    if (window.RT && window.RT.reveal) {
      window.RT.reveal();
    }
  });
     resetBtn.addEventListener("click", () => {
     if (window.RT && window.RT.reset) {
       // Reset sonrası kullanıcının yazdığı yazıyı da temizle
       userTypedTask = "";
       window.RT.reset();
     }
   });
  
  // Odadan çık butonu
  const leaveBtn = document.getElementById("leaveBtn");
  if (leaveBtn) {
    leaveBtn.addEventListener("click", () => {
      if (confirm("Odadan çıkmak istediğinizden emin misiniz?")) {
        if (window.RT && window.RT.leave) {
          window.RT.leave();
        }
      }
    });
  }
  
  if (taskSaveBtn) {
    taskSaveBtn.addEventListener("click", () => {
      if (window.RT && window.RT.setTask) {
        window.RT.setTask(taskInput.value);
      }
    });
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

    // Kullanıcı listesi
    userListEl.innerHTML = "";
    state.users.forEach(u => {
      const li = document.createElement("li");
      
      // Kullanıcı adı
      const nameSpan = document.createElement("span");
      nameSpan.textContent = u.name;
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
       
       // Görev adına tıklama olayı ekle
       currentTaskText.onclick = () => {
         if (taskInput) {
           taskInput.value = state.currentTask;
           // Görev giriş alanını göster
           taskInputContainer.style.display = 'flex';
           // Görev gösterimini gizle
           currentTaskDisplay.style.display = 'none';
           // Input'a odaklan
           taskInput.focus();
           // Input'ta metni seç
           taskInput.select();
         }
       };
       
       // Tooltip ekle
       currentTaskText.title = "Bu görev adını seçmek için tıklayın";
       
       // Görev giriş alanını gizle
       taskInputContainer.style.display = 'none';
     } else {
       // Aktif görev yok - giriş alanını göster
       currentTaskDisplay.style.display = 'none';
       taskInputContainer.style.display = 'flex';
       
       // Input'u temizleme - sadece gerçekten görev yoksa
       // Kart seçimi sonrası yazıyı korumak için bu kısmı kaldırıyoruz
     }

    // İstatistikler
    if (state.revealed) {
      statsEl.classList.remove("muted");
      statsEl.textContent = calcStats(state.votes);
    } else {
      statsEl.classList.add("muted");
      statsEl.textContent = "Reveal’dan sonra görünecek.";
    }

                                                                               // Görev başlığı UI'sı
        if (taskInput) {
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
})();