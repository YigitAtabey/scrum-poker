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
});
