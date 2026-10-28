// === GUARD AUTHENTIFICATION ===
(function() {
  const path = window.location.pathname;
  const isPublic = path.endsWith('/') || path.endsWith('index.html') || path.includes('register.html');
  if (!localStorage.getItem('token') && !isPublic) {
    window.location.href = '../../index.html';
    return;
  }
})();

// === SIDEBAR ===
function toggleSidebar() {
  document.getElementById("sidebar").classList.toggle("collapsed");
}

// === DROPDOWNS ===
function toggleDropdown() {
  document.getElementById("profileDropdown").classList.toggle("open");
}
function toggleNotif() {
  const n = document.getElementById("notifPanel");
  const d = document.getElementById("profileDropdown");
  if (d) d.classList.remove("open");
  if (n) n.classList.toggle("open");
}
document.addEventListener("click", e => {
  if (!e.target.closest('.header-profile') && !e.target.closest('#profileDropdown')) {
    const d = document.getElementById("profileDropdown");
    if (d) d.classList.remove("open");
  }
  if (!e.target.closest('.header-btn') && !e.target.closest('#notifPanel')) {
    const n = document.getElementById("notifPanel");
    if (n) n.classList.remove("open");
  }
});

// === THÈME ===
function setTheme(t) {
  document.documentElement.setAttribute('data-theme', t);
  localStorage.setItem('theme', t);
  const l = document.getElementById('themeLight');
  const d = document.getElementById('themeDark');
  if (l) l.classList.toggle('active', t === 'light');
  if (d) d.classList.toggle('active', t === 'dark');
}
function initTheme() {
  const current = localStorage.getItem('theme') || 'light';
  document.documentElement.setAttribute('data-theme', current);
  const l = document.getElementById('themeLight');
  const d = document.getElementById('themeDark');
  if (l) l.classList.toggle('active', current === 'light');
  if (d) d.classList.toggle('active', current === 'dark');
}
initTheme();

// === MODAL ===
function openModal(id) { document.getElementById(id).classList.add("open"); }
function closeModal(id) { document.getElementById(id).classList.remove("open"); }
document.querySelectorAll('.modal-overlay').forEach(m => {
  m.addEventListener('click', e => { if (e.target === m) m.classList.remove("open"); });
});

// === ONGLETS ===
function openTab(tabId) {
  document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(tc => tc.classList.remove('active'));
  if (event && event.currentTarget) event.currentTarget.classList.add('active');
  const tabEl = document.getElementById(tabId);
  if (tabEl) tabEl.classList.add('active');
  if (tabId === 'tabAlertes' && typeof markAlertsViewed === 'function') markAlertsViewed();
}

// === AI CHAT & TOAST ===
function toggleChat() {
  const p = document.getElementById('chatPanel');
  if (!p) return;
  p.classList.toggle("open");
  if (p.classList.contains("open")) {
    const inp = document.getElementById("chatInput");
    if (inp) inp.focus();
  }
}
const aiResponses = [
  "📊 Analyse : 3 ruptures et 9 articles sous le seuil critique.",
  "🛒 Commande suggérée : 50 ESP32 + 20 Raspberry Pi 4B en priorité.",
  "💰 Valeur totale : 94,820 MAD, +14.5% vs mois dernier.",
  "📈 Microcontrôleurs = 35% du stock. Entrées semaine : 218 unités.",
  "✅ Action enregistrée."
];
let riIdx = 0;
function sendChat() {
  const i = document.getElementById('chatInput');
  if (!i) return;
  const m = i.value.trim();
  if (!m) return;
  addMsg(m, 'user');
  i.value = '';
  setTimeout(() => { addMsg(aiResponses[riIdx % aiResponses.length], 'ai'); riIdx++; }, 800);
}
function sendSug(el) {
  if (!el) return;
  addMsg(el.textContent, 'user');
  setTimeout(() => { addMsg(aiResponses[riIdx % aiResponses.length], 'ai'); riIdx++; }, 800);
}
function addMsg(text, role) {
  const msgs = document.getElementById('chatMessages');
  if (!msgs) return;
  const d = document.createElement('div');
  d.className = `chat-msg ${role}`;
  const avatar = role === 'ai' ? '<i class="fas fa-robot"></i>' : 'Ad';
  d.innerHTML = `<div class="msg-avatar ${role}">${avatar}</div><div class="msg-bubble">${text}</div>`;
  msgs.appendChild(d);
  msgs.scrollTop = msgs.scrollHeight;
}

function toast(msg, type = 'success') {
  const t = document.createElement('div');
  t.style.cssText = `position:fixed;top:20px;right:20px;padding:12px 20px;border-radius:8px;color:#fff;z-index:99999;font-family:'DM Sans';background:${type === 'error' ? '#ef4444' : '#22c55e'};box-shadow:0 4px 12px rgba(0,0,0,0.2);transition:all 0.3s`;
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => { t.style.opacity = '0'; setTimeout(() => t.remove(), 300); }, 3000);
}

// === SIDEBAR ACTIVE ===
function detectActivePage() {
  const page = window.location.pathname.split('/').pop().replace('.html', '');
  const map = {
    dashboard: 'Dashboard', rapports: 'Rapports', stock: 'Stock',
    catalogue: 'Catalogue', utilisateurs: 'Utilisateurs', parametres: 'Paramètres'
  };
  const label = map[page];
  if (!label) return;
  document.querySelectorAll('.nav-item').forEach(n => {
    n.classList.remove('active');
    const nl = n.querySelector('.nav-label');
    if (nl && nl.textContent.trim() === label && !n.style.color) n.classList.add('active');
  });
}
detectActivePage();

// === TOGGLE THÈME (manquant) ===
function toggleTheme() {
  var current = document.documentElement.getAttribute('data-theme') || 'light';
  setTheme(current === 'light' ? 'dark' : 'light');
}