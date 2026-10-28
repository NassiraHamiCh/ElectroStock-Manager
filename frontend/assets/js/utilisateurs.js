let allUsers = [];
function fmtDate(d) { return d ? new Date(d).toLocaleDateString('fr-FR', { day:'2-digit', month:'short', year:'numeric' }) : '-'; }
function roleBadge(role) {
  const m = { admin:{l:'Admin',bg:'#fef2f2',c:'#ef4444'}, manager:{l:'Manager',bg:'#fffbeb',c:'#f59e0b'}, user:{l:'Utilisateur',bg:'#f0fdf4',c:'#22c55e'} };
  const r = m[role] || m.user;
  return `<span style="display:inline-flex;align-items:center;gap:5px;padding:4px 10px;border-radius:999px;font-size:.75rem;font-weight:600;background:${r.bg};color:${r.c};">${r.l}</span>`;
}
async function loadUsers() { const r = await apiGet('/users'); allUsers = (r && r.data) ? r.data : []; renderUsers(); }
function renderUsers() {
  const tbody = document.getElementById('tbodyUsers');
  if (!tbody) return;
  if (!allUsers.length) { tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:40px;color:var(--text-muted);">Aucun utilisateur</td></tr>'; return; }
  tbody.innerHTML = allUsers.map(u => {
    const ini = (u.USERNAME||'U').substring(0,2).toUpperCase();
    const isMe = u.USERNAME === localStorage.getItem('username');
    return `<tr>
      <td><div style="display:flex;align-items:center;gap:10px;"><div style="width:36px;height:36px;border-radius:10px;background:linear-gradient(135deg,var(--blue-100),var(--blue-200));display:flex;align-items:center;justify-content:center;color:var(--blue-600);font-weight:700;font-size:.8rem;">${ini}</div><div><strong>${u.USERNAME||'-'}</strong>${isMe?'<br><small style="color:var(--blue-600);">Vous</small>':''}</div></div></td>
      <td style="font-size:.85rem;color:var(--text-secondary);">${u.EMAIL||'-'}</td>
      <td>${roleBadge(u.ROLE)}</td>
      <td><span style="display:inline-flex;align-items:center;gap:5px;font-size:.8rem;color:#22c55e;"><i class="fas fa-circle" style="font-size:6px;"></i>Actif</span></td>
      <td style="font-size:.82rem;color:var(--text-muted);">${fmtDate(u.CREATED_AT)}</td>
      <td>${!isMe ? `<div style="display:flex;gap:6px;"><button onclick="editUser('${u.ID}')" style="width:32px;height:32px;border-radius:8px;border:1px solid var(--border);background:var(--bg-card);cursor:pointer;color:var(--blue-600);display:flex;align-items:center;justify-content:center;"><i class="fas fa-pen" style="font-size:12px;"></i></button><button onclick="deleteUser('${u.ID}')" style="width:32px;height:32px;border-radius:8px;border:1px solid var(--border);background:var(--bg-card);cursor:pointer;color:var(--red);display:flex;align-items:center;justify-content:center;"><i class="fas fa-trash" style="font-size:12px;"></i></button></div>` : ''}</td>
    </tr>`;
  }).join('');
}
function openAddUserModal() {
  document.getElementById('modalUserTitle').textContent = 'Créer un utilisateur';
  document.getElementById('userId').value=''; document.getElementById('userName').value=''; document.getElementById('userEmail').value=''; document.getElementById('userPassword').value=''; document.getElementById('userRole').value='user';
  openModal('modalUser');
}
function editUser(id) {
  const u = allUsers.find(x => x.ID === id);
  if (!u) return;
  document.getElementById('modalUserTitle').textContent = "Modifier l'utilisateur";
  document.getElementById('userId').value = u.ID; document.getElementById('userName').value = u.USERNAME || ''; document.getElementById('userEmail').value = u.EMAIL || ''; document.getElementById('userPassword').value = ''; document.getElementById('userRole').value = u.ROLE || 'user';
  openModal('modalUser');
}
async function saveUser() {
  const id = document.getElementById('userId').value;
  const body = { username: document.getElementById('userName').value.trim(), password: document.getElementById('userPassword').value, role: document.getElementById('userRole').value || 'user' };
  if (!body.username) { toast('Nom obligatoire', 'error'); return; }
  if (!id && !body.password) { toast('Mot de passe obligatoire', 'error'); return; }
  const res = id ? await apiPut('/users/' + id, body) : await apiPost('/users', body);
  if (res.success !== false) { toast(id?'Modifié':'Créé'); closeModal('modalUser'); await loadUsers(); } else toast(res.message || 'Erreur', 'error');
}
async function deleteUser(id) { if (!confirm('Supprimer ?')) return; const r = await apiDelete('/users/' + id); if (r.success !== false) { toast('Supprimé'); await loadUsers(); } else toast(r.message || 'Erreur', 'error'); }
loadUsers();