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

  // Kartları oluştur
  deckValues.forEach(v => {
    const btn = document.createElement("button");
    btn.className = "card";
    btn.textContent = v;
    btn.setAttribute("data-value", v);  

    // Fare ile
    btn.addEventListener("click", () => RT.vote(v));

    // Klavye erişilebilirlik
    btn.setAttribute("tabindex", "0");
    btn.setAttribute("aria-label", `Kart ${v}`);
    btn.addEventListener("keypress", (e) => {
      if (e.key === "Enter" || e.key === " ") RT.vote(v);
    });

    deckEl.appendChild(btn);
  });

  revealBtn.addEventListener("click", () => RT.reveal());
  resetBtn.addEventListener("click", () => RT.reset());
  
  // Odadan çık butonu
  const leaveBtn = document.getElementById("leaveBtn");
  if (leaveBtn) {
    leaveBtn.addEventListener("click", () => {
      if (confirm("Odadan çıkmak istediğinizden emin misiniz?")) {
        RT.leave();
      }
    });
  }
  
  if (taskSaveBtn) {
    taskSaveBtn.addEventListener("click", () => RT.setTask(taskInput.value));
  }
  if (taskInput) {
    taskInput.addEventListener("keypress", (e) => {
      if (e.key === "Enter") {
        RT.setTask(taskInput.value);
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
    const distText = Object.entries(dist).map(([k,c])=>`${k}:${c}`).join("  ");

    return `Dağılım: ${distText}
Ortalama: ${avg.toFixed(2)} | Medyan: ${median} | Mod: ${mode}`;
  }

  // UI'yi güncelle
  window.renderRoom = (state) => {
    const total = state.users.length;
    const votedIds = new Set(Array.isArray(state.voted) ? state.voted : Object.keys(state.votes || {}));
    const votedCount = typeof state.voteCount === "number" ? state.voteCount : votedIds.size;

    // Kullanıcı listesi
    userListEl.innerHTML = "";
    state.users.forEach(u => {
      const voted = state.revealed ? ` → ${state.votes[u.id] || "?"}` : (votedIds.has(u.id) ? " ✅" : " ⏳");
      const li = document.createElement("li");
      li.textContent = `${u.name} ${voted}`;
      userListEl.appendChild(li);
    });

    // Durum rozetleri
    statusEl.textContent = state.revealed ? "Gösterildi" : "Oylanıyor";
    statusEl.className = "badge " + (state.revealed ? "badge-green" : "badge-blue");
    statusEl.setAttribute("aria-label", statusEl.textContent);

    // Oy sayacı
    voteCountEl.textContent = state.revealed
      ? `Toplam katılımcı: ${total}`
      : `Oy veren: ${votedCount}/${total}`;
    voteCountEl.setAttribute("aria-live","polite");

    // Kartlarda kendi seçimimizi vurgula ve akışa göre enable/disable et
    const myVote = state.revealed ? (state.votes[RT.me.id] || null) : (RT.myVote || null);
    const disableDeck = state.revealed;
    [...deckEl.querySelectorAll(".card")].forEach(btn => {
      const sel = btn.dataset.value === myVote;
      btn.classList.toggle("selected", sel);
      btn.setAttribute("aria-pressed", sel ? "true" : "false");
      btn.disabled = disableDeck;
    });

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
      if (document.activeElement !== taskInput) {
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
    try { RT.getState && RT.getState(); } catch (e) {}
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