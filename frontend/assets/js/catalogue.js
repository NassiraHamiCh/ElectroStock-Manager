let allProducts = [], allCategories = [], allSuppliers = [];
function fmt(n) { return new Intl.NumberFormat('fr-MA').format(n || 0) + ' MAD'; }

async function loadAll() { await Promise.all([loadProducts(), loadCategories(), loadSuppliers()]); }
async function loadProducts() { const r = await apiGet('/products'); allProducts = (r && r.data) ? r.data : []; renderProducts(); }
async function loadCategories() { const r = await apiGet('/categories'); allCategories = (r && r.data) ? r.data : []; renderCategories(); }
async function loadSuppliers() { const r = await apiGet('/suppliers'); allSuppliers = (r && r.data) ? r.data : []; renderSuppliers(); }

function renderProducts() {
  const tbody = document.getElementById('tbodyProduits');
  if (!tbody) return;
  const search = (document.getElementById('searchProduit')?.value || '').toLowerCase();
  const filtered = allProducts.filter(p => (p.NAME||'').toLowerCase().includes(search) || (p.REF||'').toLowerCase().includes(search) || (p.CATEGORY_NAME||'').toLowerCase().includes(search));
  if (!filtered.length) { tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:40px;color:var(--text-muted);">Aucun produit</td></tr>'; return; }
  tbody.innerHTML = filtered.map(p => {
    const sc = (p.STOCK||0) <= 0 ? '#ef4444' : (p.STOCK||0) <= (p.SEUIL||0) ? '#f59e0b' : '#22c55e';
    return `<tr>
      <td><div style="display:flex;align-items:center;gap:10px;"><div style="width:36px;height:36px;border-radius:8px;background:linear-gradient(135deg,var(--blue-100),var(--blue-200));display:flex;align-items:center;justify-content:center;color:var(--blue-600);font-size:14px;flex-shrink:0;"><i class="fas fa-microchip"></i></div><div><strong>${p.NAME}</strong><br><small style="color:var(--text-muted)">${p.REF||'-'}</small></div></div></td>
      <td>${p.CATEGORY_NAME || '-'}</td>
      <td><span style="color:${sc};font-weight:700;">${p.STOCK||0}</span></td>
      <td>${fmt(p.PRICE)}</td>
      <td><div style="display:flex;gap:6px;">
        <button onclick="editProduct('${p.ID}')" style="width:32px;height:32px;border-radius:8px;border:1px solid var(--border);background:var(--bg-card);cursor:pointer;color:var(--blue-600);display:flex;align-items:center;justify-content:center;"><i class="fas fa-pen" style="font-size:12px;"></i></button>
        <button onclick="deleteProduct('${p.ID}')" style="width:32px;height:32px;border-radius:8px;border:1px solid var(--border);background:var(--bg-card);cursor:pointer;color:var(--red);display:flex;align-items:center;justify-content:center;"><i class="fas fa-trash" style="font-size:12px;"></i></button>
      </div></td>
    </tr>`;
  }).join('');
}
function searchProducts() { renderProducts(); }

function renderCategories() {
  const tbody = document.getElementById('tbodyCategories');
  if (!tbody) return;
  if (!allCategories.length) { tbody.innerHTML = '<tr><td colspan="3" style="text-align:center;padding:40px;color:var(--text-muted);">Aucune catégorie</td></tr>'; return; }
  tbody.innerHTML = allCategories.map(c => {
    const cnt = c.PRODUCT_COUNT || 0;
    return `<tr>
      <td><div style="display:flex;align-items:center;gap:10px;"><div style="width:36px;height:36px;border-radius:8px;background:linear-gradient(135deg,var(--blue-100),var(--blue-200));display:flex;align-items:center;justify-content:center;color:var(--blue-600);font-size:14px;"><i class="fas fa-folder"></i></div><strong>${c.NAME}</strong></div></td>
      <td><span style="padding:4px 10px;border-radius:99px;font-size:.75rem;font-weight:600;background:var(--blue-100);color:var(--blue-700);">${cnt} produit${cnt>1?'s':''}</span></td>
      <td><button onclick="deleteCategory('${c.ID}')" style="width:32px;height:32px;border-radius:8px;border:1px solid var(--border);background:var(--bg-card);cursor:pointer;color:var(--red);display:flex;align-items:center;justify-content:center;"><i class="fas fa-trash" style="font-size:12px;"></i></button></td>
    </tr>`;
  }).join('');
}

function renderSuppliers() {
  const grid = document.getElementById('supGrid');
  if (!grid) return;
  if (!allSuppliers.length) { grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:60px;color:var(--text-muted);"><i class="fas fa-truck" style="font-size:48px;margin-bottom:16px;display:block;"></i>Aucun fournisseur</div>'; return; }
  grid.innerHTML = allSuppliers.map(s => {
    const cnt = s.PRODUCT_COUNT || 0;
    return `<div class="sup-card">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;">
        <div class="sup-icon"><i class="fas fa-building"></i></div>
        <button onclick="deleteSupplier('${s.ID}')" style="width:30px;height:30px;border-radius:8px;border:1px solid var(--border);background:var(--bg-card);cursor:pointer;color:var(--red);display:flex;align-items:center;justify-content:center;font-size:11px;"><i class="fas fa-trash"></i></button>
      </div>
      <div class="sup-name">${s.NAME}</div>
      <div class="sup-detail"><i class="fas fa-envelope"></i>${s.EMAIL||'-'}</div>
      <div class="sup-detail"><i class="fas fa-phone"></i>${s.PHONE||'-'}</div>
      <div class="sup-detail"><i class="fas fa-location-dot"></i>${s.ADDRESS||'-'}</div>
      <div class="sup-count"><i class="fas fa-box"></i>${cnt} produit${cnt>1?'s':''}</div>
    </div>`;
  }).join('');
}

function populateCategorySelect(selectedId) {
  const sel = document.getElementById('prodCategory');
  if (!sel) return;
  sel.innerHTML = '<option value="">Aucune catégorie</option>';
  allCategories.forEach(c => { sel.innerHTML += `<option value="${c.ID}" ${c.ID == selectedId ? 'selected' : ''}>${c.NAME}</option>`; });
}

function openAddProductModal() {
  document.getElementById('modalProductTitle').textContent = 'Ajouter un produit';
  document.getElementById('prodId').value = '';
  document.getElementById('prodName').value = '';
  document.getElementById('prodRef').value = '';
  document.getElementById('prodPrice').value = '';
  document.getElementById('prodStock').value = '';
  document.getElementById('prodSeuil').value = '';
  populateCategorySelect('');
  openModal('modalProduit');
}

function editProduct(id) {
  const p = allProducts.find(x => x.ID === id);
  if (!p) return;
  document.getElementById('modalProductTitle').textContent = 'Modifier le produit';
  document.getElementById('prodId').value = p.ID;
  document.getElementById('prodName').value = p.NAME || '';
  document.getElementById('prodRef').value = p.REF || '';
  document.getElementById('prodPrice').value = p.PRICE || '';
  document.getElementById('prodStock').value = p.STOCK || '';
  document.getElementById('prodSeuil').value = p.SEUIL || '';
  populateCategorySelect(p.CATEGORY_ID || '');
  openModal('modalProduit');
}

async function saveProduct() {
  const id = document.getElementById('prodId').value;
  const body = {
    name: document.getElementById('prodName').value.trim(),
    ref: document.getElementById('prodRef').value.trim(),
    category_id: document.getElementById('prodCategory').value || null,
    price: parseFloat(document.getElementById('prodPrice').value) || 0,
    stock: parseInt(document.getElementById('prodStock').value) || 0,
    seuil: parseInt(document.getElementById('prodSeuil').value) || 10
  };
  if (!body.name) { toast('Nom obligatoire', 'error'); return; }
  if (!body.ref) { toast('Référence obligatoire', 'error'); return; }
  const res = id ? await apiPut('/products/' + id, body) : await apiPost('/products', body);
  if (res.success !== false) { toast(id ? 'Modifié' : 'Ajouté'); closeModal('modalProduit'); await loadProducts(); }
  else toast(res.message || 'Erreur', 'error');
}

async function deleteProduct(id) {
  const p = allProducts.find(x => x.ID === id);
  if (!p || !confirm(`Supprimer "${p.NAME}" ?`)) return;
  const res = await apiDelete('/products/' + id);
  if (res.success !== false) { toast('Supprimé'); await loadProducts(); } else toast(res.message || 'Erreur', 'error');
}
async function addCategory() {
  const name = document.getElementById('catName').value.trim();
  if (!name) { toast('Nom obligatoire', 'error'); return; }
  const res = await apiPost('/categories', { name });
  if (res.success !== false) { toast('Catégorie ajoutée'); closeModal('modalCategorie'); document.getElementById('catName').value=''; await loadCategories(); }
  else toast(res.message || 'Erreur', 'error');
}
async function deleteCategory(id) {
  if (!confirm('Supprimer cette catégorie ?')) return;
  const res = await apiDelete('/categories/' + id);
  if (res.success !== false) { toast('Supprimée'); await loadCategories(); await loadProducts(); } else toast(res.message || 'Erreur', 'error');
}
async function addSupplier() {
  const body = { name: document.getElementById('supName').value.trim(), email: document.getElementById('supEmail').value.trim(), phone: document.getElementById('supPhone').value.trim(), address: document.getElementById('supAddr').value.trim() };
  if (!body.name) { toast('Nom obligatoire', 'error'); return; }
  const res = await apiPost('/suppliers', body);
  if (res.success !== false) { toast('Fournisseur ajouté'); closeModal('modalSup'); ['supName','supEmail','supPhone','supAddr'].forEach(id => document.getElementById(id).value=''); await loadSuppliers(); }
  else toast(res.message || 'Erreur', 'error');
}
async function deleteSupplier(id) {
  if (!confirm('Supprimer ?')) return;
  const res = await apiDelete('/suppliers/' + id);
  if (res.success !== false) { toast('Supprimé'); await loadSuppliers(); } else toast(res.message || 'Erreur', 'error');
}
function exportProductsPDF() {
  if (typeof window.jspdf === 'undefined') { toast('PDF non chargé', 'error'); return; }
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  doc.setFontSize(18); doc.text('Catalogue Produits — ElectroStock', 14, 22);
  doc.setFontSize(10); doc.text('Date: ' + new Date().toLocaleDateString('fr-FR'), 14, 30);
  doc.autoTable({ startY:36, head:[['Produit','Ref','Catégorie','Stock','Prix (MAD)']], body:allProducts.map(p=>[p.NAME,p.REF||'-',p.CATEGORY_NAME||'-',p.STOCK||0,(p.PRICE||0).toFixed(2)]), theme:'grid', headStyles:{fillColor:[14,165,233],textColor:255,fontStyle:'bold'}, styles:{fontSize:9}, alternateRowStyles:{fillColor:[248,250,252]} });
  doc.save('catalogue-electrostock.pdf'); toast('PDF exporté');
}
loadAll();