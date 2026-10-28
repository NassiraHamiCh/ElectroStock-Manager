let allProducts = [], allMovements = [], allInventory = [], alertsViewed = false;

function fmt(n) { return new Intl.NumberFormat('fr-MA').format(n || 0) + ' MAD'; }
function fmtDate(d) { return d ? new Date(d).toLocaleDateString('fr-FR', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' }) : '-'; }
function statusInfo(stock, threshold) {
  if (stock <= 0) return { label:'Rupture', color:'#ef4444', bg:'#fef2f2' };
  if (stock <= threshold) return { label:'Stock bas', color:'#f59e0b', bg:'#fffbeb' };
  return { label:'En stock', color:'#22c55e', bg:'#f0fdf4' };
}

function updateAlertBadges(count) {
  ['alertTabBadge', 'sidebarAlertBadge'].forEach(id => {
    const b = document.getElementById(id);
    if (b) { b.textContent = count; b.style.display = (count > 0 && !alertsViewed) ? 'inline' : 'none'; }
  });
}
function markAlertsViewed() { alertsViewed = true; updateAlertBadges(0); }

async function loadAll() { await Promise.all([loadProducts(), loadMovements(), loadInventory()]); }

async function loadProducts() {
  const res = await apiGet('/products');
  allProducts = (res && res.data) ? res.data : [];
  renderStockTable(); renderAlerts(); populateProductSelects();
  updateAlertBadges(allProducts.filter(p => (p.STOCK || 0) <= (p.SEUIL || 0)).length);
}

async function loadMovements() {
  const res = await apiGet('/movements');
  allMovements = (res && res.data) ? res.data : [];
  renderMovements();
}

async function loadInventory() {
  const res = await apiGet('/inventory');
  allInventory = (res && res.data) ? res.data : [];
  renderInventory();
}

function renderStockTable() {
  const tbody = document.getElementById('tbodyStock');
  if (!tbody) return;
  const search = (document.getElementById('filterSearch')?.value || '').toLowerCase();
  const status = document.getElementById('filterStatut')?.value || '';
  const filtered = allProducts.filter(p => {
    if (status === 'ok' && statusInfo(p.STOCK, p.SEUIL).label !== 'En stock') return false;
    if (status === 'low' && statusInfo(p.STOCK, p.SEUIL).label !== 'Stock bas') return false;
    if (status === 'out' && statusInfo(p.STOCK, p.SEUIL).label !== 'Rupture') return false;
    return (p.NAME || '').toLowerCase().includes(search) || (p.REF || '').toLowerCase().includes(search);
  });
  if (!filtered.length) { tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:40px;color:var(--text-muted);">Aucun produit</td></tr>'; return; }
  tbody.innerHTML = filtered.map(p => {
    const s = statusInfo(p.STOCK, p.SEUIL);
    return `<tr>
      <td><strong>${p.NAME}</strong><br><small style="color:var(--text-muted)">${p.REF || '-'}</small></td>
      <td>${p.CATEGORY_NAME || '-'}</td>
      <td><strong>${p.STOCK || 0}</strong></td>
      <td>${p.SEUIL || 0}</td>
      <td>${fmt((p.STOCK || 0) * (p.PRICE || 0))}</td>
      <td><span style="display:inline-flex;align-items:center;gap:5px;padding:4px 10px;border-radius:99px;font-size:.75rem;font-weight:600;background:${s.bg};color:${s.color};"><i class="fas fa-circle" style="font-size:6px;"></i>${s.label}</span></td>
    </tr>`;
  }).join('');
}
function filterStockTable() { renderStockTable(); }

function renderAlerts() {
  const c = document.getElementById('alertListContainer');
  if (!c) return;
  const alerts = allProducts.filter(p => (p.STOCK || 0) <= (p.SEUIL || 0));
  if (!alerts.length) { c.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:60px;color:var(--text-muted);"><i class="fas fa-check-circle" style="font-size:48px;color:#22c55e;display:block;margin-bottom:16px;"></i>Aucune alerte</div>'; return; }
  c.innerHTML = alerts.map(p => {
    const out = (p.STOCK || 0) <= 0;
    const col = out ? '#ef4444' : '#f59e0b';
    return `<div class="alert-card-stock" style="border-color:${col}30;">
      <div class="alert-icon-sm" style="background:${out?'#fef2f2':'#fffbeb'};color:${col};"><i class="fas ${out?'fa-xmark':'fa-exclamation'}"></i></div>
      <div style="flex:1;"><div style="font-weight:700;margin-bottom:2px;">${p.NAME}</div>
      <div style="font-size:.8rem;color:var(--text-muted);margin-bottom:8px;">${p.CATEGORY_NAME || '-'} · ${p.REF || '-'}</div>
      <div style="display:flex;gap:16px;font-size:.82rem;"><span style="color:${col};font-weight:600;">Stock : ${p.STOCK || 0}</span><span>Seuil : ${p.SEUIL || 0}</span></div>
      <span style="display:inline-block;margin-top:8px;padding:3px 8px;border-radius:6px;font-size:.7rem;font-weight:600;background:${out?'#fef2f2':'#fffbeb'};color:${col};">${out?'Rupture':'Stock critique'}</span></div></div>`;
  }).join('');
}

function renderMovements() {
  const tbody = document.getElementById('tbodyMouvements');
  if (!tbody) return;
  if (!allMovements.length) { tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:40px;color:var(--text-muted);">Aucun mouvement</td></tr>'; return; }
  tbody.innerHTML = allMovements.map(m => {
    const isIn = m.TYPE === 'in';
    const col = isIn ? '#22c55e' : '#ef4444';
    return `<tr>
      <td><strong>${m.PRODUCT_NAME || '-'}</strong></td>
      <td><span style="display:inline-flex;align-items:center;gap:5px;padding:4px 10px;border-radius:99px;font-size:.75rem;font-weight:600;background:${isIn?'#f0fdf4':'#fef2f2'};color:${col};"><i class="fas fa-arrow-${isIn?'down':'up'}" style="font-size:10px;"></i>${isIn?'Entrée':'Sortie'}</span></td>
      <td><strong style="color:${col};">${isIn?'+':'-'}${m.QUANTITY || 0}</strong></td>
      <td>${m.CREATED_BY || '-'}</td>
      <td style="font-size:.82rem;color:var(--text-secondary);">${fmtDate(m.CREATED_AT)}</td>
    </tr>`;
  }).join('');
}

function renderInventory() {
  const tbody = document.getElementById('tbodyInv');
  if (!tbody) return;
  if (!allInventory.length) { tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:40px;color:var(--text-muted);">Aucun comptage</td></tr>'; return; }
  tbody.innerHTML = allInventory.map(inv => {
    const diff = (inv.PHYSICAL_QTY || 0) - (inv.SYSTEM_QTY || 0);
    const ok = diff === 0;
    const col = ok ? '#22c55e' : '#ef4444';
    return `<tr>
      <td><strong>${inv.PRODUCT_NAME || '-'}</strong></td>
      <td>${inv.SYSTEM_QTY || 0}</td><td>${inv.PHYSICAL_QTY || 0}</td>
      <td><strong style="color:${col};">${diff>0?'+':''}${diff}</strong></td>
      <td><span style="display:inline-flex;align-items:center;gap:5px;padding:4px 10px;border-radius:99px;font-size:.75rem;font-weight:600;background:${ok?'#f0fdf4':'#fef2f2'};color:${col};">${ok?'Conforme':'Écart'}</span></td>
    </tr>`;
  }).join('');
}

function populateProductSelects() {
  ['mvtProduct', 'invProduct'].forEach(id => {
    const sel = document.getElementById(id);
    if (!sel) return;
    sel.innerHTML = '<option value="">Choisir un produit</option>';
    allProducts.forEach(p => { sel.innerHTML += `<option value="${p.ID}">${p.NAME} (Stock: ${p.STOCK || 0})</option>`; });
  });
}
function openProductSelect() { populateProductSelects(); }

async function saveMouvement() {
  const productId = document.getElementById('mvtProduct').value;
  const type = document.getElementById('mvtType').value;
  const quantity = parseInt(document.getElementById('mvtQty').value);
  const note = document.getElementById('mvtNote').value.trim();
  if (!productId) { toast('Choisir un produit', 'error'); return; }
  if (!quantity || quantity <= 0) { toast('Quantité invalide', 'error'); return; }
  if (type === 'out') { const p = allProducts.find(x => x.ID === productId); if (p && (p.STOCK || 0) < quantity) { toast('Stock insuffisant', 'error'); return; } }
  const res = await apiPost('/movements', { product_id: productId, type, quantity, note });
  if (res.success) { toast('Mouvement enregistré'); closeModal('modalMouvement'); document.getElementById('mvtQty').value=''; document.getElementById('mvtNote').value=''; alertsViewed=false; await loadAll(); }
  else toast(res.message || 'Erreur', 'error');
}

async function saveInventory() {
  const productId = document.getElementById('invProduct').value;
  const physicalStock = parseInt(document.getElementById('invQty').value);
  const note = document.getElementById('invNote').value.trim();
  if (!productId) { toast('Choisir un produit', 'error'); return; }
  if (isNaN(physicalStock) || physicalStock < 0) { toast('Quantité invalide', 'error'); return; }
  const p = allProducts.find(x => x.ID === productId);
  const res = await apiPost('/inventory', { product_id: productId, systemStock: p ? p.STOCK : 0, physicalStock, note });
  if (res.success) { toast('Comptage enregistré'); closeModal('modalInventaire'); document.getElementById('invQty').value=''; document.getElementById('invNote').value=''; alertsViewed=false; await loadAll(); }
  else toast(res.message || 'Erreur', 'error');
}

loadAll();