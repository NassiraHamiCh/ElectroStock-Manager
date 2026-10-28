(function () {
  'use strict';

  const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
  const GROQ_MODEL = 'openai/gpt-oss-20b';
  const LS_KEY = 'groq_api_key';

  let apiKey = localStorage.getItem(LS_KEY) || '';
  let chatHistory = [];
  let isBusy = false;

  function init() {
    updateStatusBadge();
    if (!apiKey) setTimeout(openApiModal, 1500);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // ═══════════ MODAL ═══════════

  window.openApiModal = function () {
    const m = document.getElementById('apiModal');
    if (!m) return;
    m.style.display = 'flex';
    const inp = document.getElementById('groqKeyInput');
    if (inp) { inp.value = apiKey; setTimeout(() => inp.focus(), 80); }
    hideError();
  };

  window.closeApiModal = function () {
    const m = document.getElementById('apiModal');
    if (m) m.style.display = 'none';
  };

  window.saveGroqKey = async function () {
    const inp = document.getElementById('groqKeyInput');
    const key = (inp ? inp.value : '').trim();

    if (!key) return showError('Veuillez entrer une clé API.');
    if (!key.startsWith('gsk_')) return showError('La clé Groq doit commencer par "gsk_".');

    try {
      const res = await fetch(GROQ_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + key },
        body: JSON.stringify({ model: GROQ_MODEL, messages: [{ role: 'user', content: 'Dis OK' }], max_tokens: 5 }),
      });
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error?.message || 'Erreur ' + res.status); }
      apiKey = key;
      localStorage.setItem(LS_KEY, key);
      closeApiModal();
      updateStatusBadge();
      chatHistory = [];
      appendAi('Connecté à Groq avec succès ! Je suis prête à analyser votre stock.');
    } catch (e) { showError(e.message); }

    function showError(msg) { const el = document.getElementById('apiModalError'); if (el) { el.textContent = msg; el.style.display = 'block'; } }
    function hideError() { const el = document.getElementById('apiModalError'); if (el) el.style.display = 'none'; }
  };

  document.addEventListener('click', e => { if (e.target.id === 'apiModal') closeApiModal(); });

  // ═══════════ CONTEXTE ═══════════

  function buildSystemPrompt() {
    const txt = sel => { const el = document.querySelector(sel); return el ? el.textContent.trim() : '?'; };
    const kpiProducts = txt('#kpiProducts');
    const kpiValue = txt('#kpiValue');
    const kpiMovements = txt('#kpiMovements');
    const kpiAlerts = txt('#kpiAlerts');

    const rows = document.querySelectorAll('#tbodyRecentProducts tr');
    let produits = '';
    rows.forEach(r => { const c = r.querySelectorAll('td'); if (c.length >= 5) produits += '- ' + c[0].textContent.trim() + ' | Cat: ' + c[1].textContent.trim() + ' | Stock: ' + c[2].textContent.trim() + ' | Prix: ' + c[3].textContent.trim() + ' | Statut: ' + c[4].textContent.trim() + '\n'; });

    const alertDivs = document.querySelectorAll('#alertList > div');
    let alertes = '';
    alertDivs.forEach(d => { alertes += '- ' + d.textContent.trim().replace(/\s+/g, ' ') + '\n'; });

    return 'Tu es l\'assistante IA d\'ElectroStock, système de gestion de stock de matériel électrique au Maroc (base Oracle). Tu réponds TOUJOURS en français, de façon concise et professionnelle.\n\nDONNÉES EN TEMPS RÉEL :\n- Produits actifs : ' + kpiProducts + '\n- Valeur totale du stock : ' + kpiValue + ' MAD\n- Mouvements (30 jours) : ' + kpiMovements + '\n- Alertes actives : ' + kpiAlerts + '\n\nPRODUITS RÉCENTS :\n' + (produits || 'Aucun produit chargé.') + '\n\nALERTES ACTIVES :\n' + (alertes || 'Aucune alerte.') + '\n\nRègles :\n- Utilise les données ci-dessus pour répondre précisément.\n- Si une question est hors contexte, dis-le poliment.\n- Formate avec du **gras** et des listes à puces.\n- Si des alertes critiques existent, signale-les si pertinent.\n- Pour les montants, précise toujours "MAD".';
  }

  // ═══════════ APPEL GROQ ═══════════

  async function callGroq(userMessage) {
    const messages = [
      { role: 'system', content: buildSystemPrompt() },
      ...chatHistory,
      { role: 'user', content: userMessage },
    ];
    const res = await fetch(GROQ_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + apiKey },
      body: JSON.stringify({ model: GROQ_MODEL, messages, temperature: 0.7, max_tokens: 1024, top_p: 0.9 }),
    });
    if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error?.message || 'Erreur API ' + res.status); }
    const data = await res.json();
    return data.choices?.[0]?.message?.content || 'Désolé, pas de réponse générée.';
  }

  // ═══════════ UI CHAT ═══════════

  function appendAi(html) {
    const box = document.getElementById('chatMessages');
    if (!box) return;
    const d = document.createElement('div');
    d.className = 'chat-msg ai';
    d.innerHTML = '<div class="msg-avatar ai"><i class="fas fa-robot"></i></div><div class="msg-bubble">' + html + '</div>';
    box.appendChild(d);
    box.scrollTop = box.scrollHeight;
  }

  function appendUser(text) {
    const box = document.getElementById('chatMessages');
    if (!box) return;
    const d = document.createElement('div');
    d.className = 'chat-msg user';
    const safe = document.createElement('span');
    safe.textContent = text;
    d.innerHTML = '<div class="msg-bubble">' + safe.innerHTML + '</div>';
    box.appendChild(d);
    box.scrollTop = box.scrollHeight;
  }

  function showTyping() {
    const box = document.getElementById('chatMessages');
    if (!box) return null;
    const d = document.createElement('div');
    d.className = 'chat-msg ai';
    d.id = 'groq-typing';
    d.innerHTML = '<div class="msg-avatar ai"><i class="fas fa-robot"></i></div><div class="msg-bubble typing-bubble"><span class="t-dot"></span><span class="t-dot"></span><span class="t-dot"></span></div>';
    box.appendChild(d);
    box.scrollTop = box.scrollHeight;
    return d;
  }

  function removeTyping(el) { if (el && el.parentNode) el.parentNode.removeChild(el); }

  function updateStatusBadge() {
    const b = document.querySelector('.chat-ai-status');
    if (b) { b.textContent = apiKey ? 'En ligne — Groq connecté' : 'Hors ligne — Clé requise'; b.style.color = apiKey ? 'var(--green)' : 'var(--text-muted)'; }
  }

  if (!document.getElementById('groq-chat-styles')) {
    const s = document.createElement('style');
    s.id = 'groq-chat-styles';
    s.textContent = '.typing-bubble{display:flex;gap:5px;padding:14px 18px!important;align-items:center;}.t-dot{width:7px;height:7px;border-radius:50%;background:var(--blue-500);animation:tB 1.2s infinite;}.t-dot:nth-child(2){animation-delay:.15s;}.t-dot:nth-child(3){animation-delay:.3s;}@keyframes tB{0%,60%,100%{opacity:.25;transform:translateY(0)}30%{opacity:1;transform:translateY(-5px)}}.msg-bubble strong{color:var(--text);}.msg-bubble ul,.msg-bubble ol{padding-left:18px;margin:6px 0;}.msg-bubble li{margin:3px 0;}';
    document.head.appendChild(s);
  }

  function fmt(text) {
    return text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\*(.*?)\*/g, '<em>$1</em>').replace(/^- (.+)$/gm, '<li>$1</li>').replace(/^(\d+)\. (.+)$/gm, '<li>$2</li>').replace(/(<li>[\s\S]*?<\/li>)/g, '<ul>$1</ul>').replace(/<\/ul>\s*<ul>/g, '').replace(/\n\n/g, '<br><br>').replace(/\n/g, '<br>');
  }

  // ═══════════ FONCTIONS RÉELLES ═══════════

  async function realSendChat() {
    if (isBusy) return;
    const inp = document.getElementById('chatInput');
    const text = (inp ? inp.value : '').trim();
    if (!text) return;
    if (!apiKey) { openApiModal(); return; }

    isBusy = true;
    if (inp) inp.value = '';
    const sug = document.querySelector('.chat-suggestions');
    if (sug) sug.style.display = 'none';

    appendUser(text);
    const typing = showTyping();

    try {
      const reply = await callGroq(text);
      removeTyping(typing);
      chatHistory.push({ role: 'user', content: text });
      chatHistory.push({ role: 'assistant', content: reply });
      appendAi(fmt(reply));
    } catch (err) {
      removeTyping(typing);
      let msg = 'Erreur : ';
      if (err.message.includes('invalid_api_key') || err.message.includes('Incorrect API')) msg += 'Clé API invalide, vérifiez sur console.groq.com/keys';
      else if (err.message.includes('rate_limit') || err.message.includes('Rate')) msg += 'Trop de requêtes, attendez quelques secondes.';
      else if (err.message.includes('token') || err.message.includes('context')) { msg += 'Historique trop long, conversation réinitialisée.'; chatHistory = []; }
      else msg += err.message;
      appendAi(msg);
    }
    isBusy = false;
  }

  function realSendSug(el) {
    if (!el) return;
    const text = el.textContent.replace(/^[^\w]+/, '').trim();
    const inp = document.getElementById('chatInput');
    if (inp) inp.value = text;
    realSendChat();
  }

  // ═══════════ PLEIN ÉCRAN ═══════════
  window.toggleChatFullscreen = function () {
    const panel = document.getElementById('chatPanel');
    const content = document.querySelector('.main-area > .content');
    if (!panel || !content) return;

    if (!document.body.classList.contains('chat-fullscreen')) {
      panel._origParent = panel.parentNode;
      panel._origNext = panel.nextSibling;
      content.appendChild(panel);
      document.body.classList.add('chat-fullscreen');
      panel.classList.add('open');
      document.getElementById('expandIcon').className = 'fas fa-compress';
    } else {
      if (panel._origParent) {
        if (panel._origNext) panel._origParent.insertBefore(panel, panel._origNext);
        else panel._origParent.appendChild(panel);
        delete panel._origParent;
        delete panel._origNext;
      }
      document.body.classList.remove('chat-fullscreen');
      document.getElementById('expandIcon').className = 'fas fa-expand';
    }
  };

  // ═══════════ UN SEUL OVERRIDE FINAL ═══════════
  setTimeout(function () {
    window.sendChat = realSendChat;
    window.sendSug = realSendSug;

    // Intercepter le X : en plein écran = réduire, sinon = fermer normalement
    var _origToggleChat = window.toggleChat;
    window.toggleChat = function () {
      if (document.body.classList.contains('chat-fullscreen')) {
        toggleChatFullscreen();
        return;
      }
      if (_origToggleChat) _origToggleChat();
    };
  }, 0);

})();