

document.addEventListener("DOMContentLoaded", async () => {
  const uname = localStorage.getItem('username');
  if (uname) {
    const av = document.getElementById('dashAvatar'); const pn = document.getElementById('dashProfileName');
    if (av) av.textContent = uname.substring(0,2).toUpperCase();
    if (pn) pn.textContent = uname;
  }
  await loadRealKPIs(); await loadRecentProducts(); await loadRealCharts();
  await loadNotifications();   // <-- AJOUTER CETTE LIGNE
});

async function loadRealKPIs() {
  try { const r = await apiGet("/stats"); if (!r || !r.success) return; const d = r.data;
    document.getElementById("kpiProducts").textContent = d.products || 0;
    document.getElementById("kpiValue").textContent = (d.value || 0).toLocaleString('fr-FR') + " MAD";
    document.getElementById("kpiMovements").textContent = d.movements || 0;
    document.getElementById("kpiAlerts").textContent = d.alerts || 0;
    document.getElementById("kpiAlertsSub").textContent = `${d.alerts || 0} produits critiques`;
    const badge = document.getElementById('headerNotifCount');
    if (badge && d.alerts > 0) { badge.textContent = d.alerts; badge.style.display = 'flex'; }
  } catch(e) { console.error("Erreur KPIs:", e); }
}


async function loadRecentProducts() {
  try { const r = await apiGet("/products"); if (!r || !r.success) return; const products = r.data || [];
    const tbody = document.getElementById("tbodyRecentProducts"); if (!tbody) return;
    tbody.innerHTML = products.slice(0, 5).map(p => {
      let st = '<span class="tag green">En stock</span>';
      if (p.STOCK <= 0) st = '<span class="tag red">Rupture</span>';
      else if (p.STOCK <= p.SEUIL) st = '<span class="tag orange">Stock bas</span>';
      return `<tr>
        <td>${p.NAME}</td>
        <td>${p.CATEGORY_NAME || ''}</td>
        <td><strong>${p.STOCK}</strong></td>
        <td>${parseFloat(p.PRICE||0).toFixed(2)} MAD</td>
        <td>${st}</td>
      </tr>`;
    }).join("");
  } catch(e) { console.error("Erreur Produits:", e); }
}

async function loadRealCharts() {
  if (typeof Chart === 'undefined') return;
  Chart.defaults.font.family = "'DM Sans', sans-serif"; Chart.defaults.color = '#94a3b8';
  try {
    const prodRes = await apiGet("/products"); const mvtRes = await apiGet("/movements");
    const products = prodRes.data || []; const movements = mvtRes.data || [];

    const barCtx = document.getElementById('barChart');
    if (barCtx && movements.length > 0) {
      const last10 = movements.slice(0, 10).reverse();
      new Chart(barCtx, { type:'bar', data:{ labels:last10.map(m => m.CREATED_AT ? m.CREATED_AT.split(' ')[0] : '?'), datasets:[
        { label:'Entrées', data:last10.map(m => m.TYPE === 'in' ? m.QUANTITY : 0), backgroundColor:'rgba(14,165,233,0.8)', borderRadius:6, borderSkipped:false },
        { label:'Sorties', data:last10.map(m => m.TYPE === 'out' ? m.QUANTITY : 0), backgroundColor:'rgba(13,148,136,0.8)', borderRadius:6, borderSkipped:false }
      ]}, options:{ responsive:true, maintainAspectRatio:false, scales:{ y:{ beginAtZero:true } } } });
    } else if (barCtx) { const ctx = barCtx.getContext('2d'); ctx.font="14px DM Sans"; ctx.fillStyle="#94a3b8"; ctx.textAlign="center"; ctx.fillText("Faites des mouvements pour voir le graphique", barCtx.width/2, barCtx.height/2); }

    const donutCtx = document.getElementById('donutChart');
    if (donutCtx && products.length > 0) {
      const catMap = {}; products.forEach(p => { const c = p.CATEGORY_NAME || 'Non classé'; catMap[c] = (catMap[c]||0) + 1; });
      const colors = ['#0ea5e9','#0d9488','#6366f1','#f59e0b','#ef4444','#8b5cf6','#06b6d4'];
      new Chart(donutCtx, { type:'doughnut', data:{ labels:Object.keys(catMap), datasets:[{ data:Object.values(catMap), backgroundColor:colors.slice(0,Object.keys(catMap).length), borderWidth:0, hoverOffset:4 }] }, options:{ responsive:true, maintainAspectRatio:true, cutout:'70%', plugins:{ legend:{ position:'bottom', labels:{ padding:15, usePointStyle:true, font:{size:11,weight:'600'} } } } } });
    }

    const lineCtx = document.getElementById('lineChart');
    if (lineCtx && movements.length > 0) {
      const last7 = movements.slice(0, 7).reverse();
      new Chart(lineCtx, { type:'line', data:{ labels:last7.map(m => m.CREATED_AT ? m.CREATED_AT.split(' ')[0] : '?'), datasets:[
        { label:'Entrées', data:last7.map(m=>m.TYPE==='in'?m.QUANTITY:0), borderColor:'#0ea5e9', backgroundColor:'rgba(14,165,233,0.1)', borderWidth:2, tension:.4, fill:true },
        { label:'Sorties', data:last7.map(m=>m.TYPE==='out'?m.QUANTITY:0), borderColor:'#0d9488', backgroundColor:'rgba(13,148,136,0.1)', borderWidth:2, tension:.4, fill:true }
      ]}, options:{ responsive:true, maintainAspectRatio:false, scales:{ y:{ beginAtZero:true } } } });
    }

    const hBarCtx = document.getElementById('hBarChart');
    if (hBarCtx && products.length > 0) {
      const top5 = [...products].sort((a,b) => b.STOCK - a.STOCK).slice(0, 5);
      new Chart(hBarCtx, { type:'bar', data:{ labels:top5.map(p=>p.NAME), datasets:[{ label:'Quantité', data:top5.map(p=>p.STOCK), backgroundColor:['#0ea5e9','#0d9488','#6366f1','#f59e0b','#06b6d4'], borderRadius:6, borderSkipped:false }] }, options:{ indexAxis:'y', responsive:true, maintainAspectRatio:false, plugins:{ legend:{display:false} } } });
    }
  } catch(e) { console.error("Erreur Graphiques:", e); }
  await loadRealAlerts();
}

async function loadRealAlerts() {
  try { const r = await apiGet("/products"); if (!r || !r.success) return; const products = r.data || [];
    const c = document.getElementById("alertList"); if (!c) return;
    const alerts = products.filter(p => (p.STOCK||0) <= (p.SEUIL||0));
    if (!alerts.length) { c.innerHTML = '<div style="text-align:center;padding:30px;color:#22c55e;"><i class="fas fa-check-circle" style="font-size:24px;margin-bottom:10px;display:block;"></i>Aucune alerte</div>'; document.getElementById("alertCountSubtitle").textContent = "Tout est parfait"; return; }
    document.getElementById("alertCountSubtitle").textContent = `${alerts.length} nécessitent une action`;
    c.innerHTML = alerts.map(p => { const out = (p.STOCK||0) <= 0;
      return `<div class="alert-item" style="cursor:pointer;" onclick="window.location='stock.html'"><div class="alert-dot" style="background:${out?'var(--red)':'var(--amber)'}"></div><div class="alert-body"><div class="alert-title">${out?'Rupture':'Stock critique'}</div><div class="alert-desc">${p.NAME} — Stock : ${p.STOCK||0} / Seuil : ${p.SEUIL||0}</div></div></div>`;
    }).join("");
  } catch(e) { console.error("Erreur Alertes:", e); }
}


async function loadNotifications() {
  try {
    const r = await apiGet("/products"); if (!r || !r.success) return;
    const products = r.data || [];
    const alerts = products.filter(p => (p.STOCK || 0) <= (p.SEUIL || 0));

    // ── AJOUTER CES LIGNES ──
    const lastRead = parseInt(localStorage.getItem('last_notif_read') || '0');
    const newAlerts = alerts.filter(p => {
      const ts = p.UPDATED_AT ? new Date(p.UPDATED_AT).getTime() : 0;
      return ts > lastRead;
    });
    const toShow = newAlerts.length > 0 ? newAlerts : alerts;
    // ── FIN AJOUT ──

    const list = document.getElementById("notifList"); if (!list) return;

    if (toShow.length === 0) {
      list.innerHTML = '<div style="text-align:center;padding:20px;color:var(--text-muted);"><i class="fas fa-check-circle" style="font-size:20px;display:block;margin-bottom:8px;color:var(--green);"></i>Aucune nouvelle notification</div>';
      return;
    }

    list.innerHTML = toShow.slice(0, 10).map(p => {
      const out = (p.STOCK || 0) <= 0;
      const icon = out ? 'fa-circle-xmark' : 'fa-triangle-exclamation';
      const color = out ? 'var(--red)' : 'var(--amber)';
      const label = out ? 'Rupture de stock' : 'Stock critique';
      return `<div style="padding:12px 16px;border-bottom:1px solid var(--border);cursor:pointer;transition:background 0.15s;display:flex;gap:12px;align-items:flex-start;" onmouseover="this.style.background='var(--bg-2)'" onmouseout="this.style.background='transparent'" onclick="window.location='stock.html?tab=alertes'">
        <i class="fas ${icon}" style="color:${color};margin-top:3px;font-size:14px;flex-shrink:0;"></i>
        <div>
          <div style="font-size:0.82rem;font-weight:600;color:var(--text);margin-bottom:2px;">${label}</div>
          <div style="font-size:0.75rem;color:var(--text-muted);">${p.NAME} — Stock : ${p.STOCK || 0} / Seuil : ${p.SEUIL || 0}</div>
        </div>
      </div>`;
    }).join("");
  } catch (e) {
    console.error("Erreur Notifications:", e);
    const list = document.getElementById("notifList");
    if (list) list.innerHTML = '<div style="text-align:center;padding:20px;color:var(--red);">Erreur de chargement</div>';
  }
}

function markAllNotifRead() {
  // Cacher le compteur
  const badge = document.getElementById('headerNotifCount');
  if (badge) badge.style.display = 'none';
  const sidebarBadge = document.getElementById('sidebarAlertBadge');
  if (sidebarBadge) sidebarBadge.style.display = 'none';

  // Marquer les notifs comme lues visuellement
  document.querySelectorAll('#notifList > div').forEach(item => {
    item.style.opacity = '0.5';
    item.style.pointerEvents = 'none';
  });

  // Changer l'icône du bouton
  const btn = document.getElementById('markAllReadBtn');
  if (btn) {
    btn.classList.add('read-done');
    btn.innerHTML = '<i class="fas fa-check"></i>';
  }

  // Sauvegarder l'état dans localStorage
  localStorage.setItem('last_notif_read', Date.now().toString());
}