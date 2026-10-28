function addMsg(text, role) {
  const msgs = document.getElementById("mainChatMessages"); if (!msgs) return;
  const d = document.createElement("div"); d.className = `chat-msg ${role}`;
  d.innerHTML = `<div class="msg-avatar ${role}">${role === 'ai' ? '<i class="fas fa-robot"></i>' : 'Ad'}</div><div class="msg-bubble">${text}</div>`;
  msgs.appendChild(d); msgs.scrollTop = msgs.scrollHeight;
}
async function sendMainAi() {
  const input = document.getElementById("mainAiInput"); if (!input) return;
  const q = input.value.trim(); if (!q) return; addMsg(q, "user"); input.value = ""; setTimeout(() => { askAI(q); }, 500);
}
async function askAI(question) {
  addMsg("Analyse en cours...", "ai");
  try {
    const statsRes = await apiGet("/stats"); const prodRes = await apiGet("/products");
    if (!statsRes || !statsRes.success) { removeLoad(); addMsg("❌ Erreur de connexion.", "ai"); return; }
    const stats = statsRes.data; const products = prodRes.data || [];
    let answer = ""; const q = question.toLowerCase();
    if (q.includes("rupture") || q.includes("alerte")) {
      const rupt = products.filter(p => p.STOCK <= 0); const low = products.filter(p => p.STOCK > 0 && p.STOCK <= p.SEUIL);
      answer = `📊 <strong>Rapport :</strong><br>• ${rupt.length} rupture(s)<br>• ${low.length} stock(s) critique(s)<br><strong>Ruptures :</strong> ${rupt.map(p=>p.NAME).join(', ') || 'Aucune'}`;
    } else if (q.includes("command") || q.includes("urgent")) {
      const alerts = products.filter(p => p.STOCK <= p.SEUIL);
      answer = `🛒 <strong>Commander :</strong><br>${alerts.map(p => `- ${p.NAME} (Stock: ${p.STOCK}, Seuil: ${p.SEUIL})`).join('<br>') || 'Aucun produit critique'}`;
    } else if (q.includes("valeur") || q.includes("mad")) {
      answer = `💰 <strong>Valeur :</strong> ${(stats.value||0).toLocaleString('fr-FR')} MAD sur ${stats.products} produits.`;
    } else if (q.includes("top") || q.includes("meilleur")) {
      const top5 = [...products].sort((a,b) => b.STOCK - a.STOCK).slice(0, 5);
      answer = `🏆 <strong>Top 5 :</strong><br>${top5.map((p,i) => `${i+1}. ${p.NAME} (${p.STOCK} unités)`).join('<br>')}`;
    } else { answer = `Connecté : ${stats.products} produits, ${stats.alerts} alertes, ${(stats.value||0).toLocaleString('fr-FR')} MAD.`; }
    removeLoad(); addMsg(answer, "ai");
  } catch(e) { removeLoad(); addMsg("Erreur serveur.", "ai"); }
}
function removeLoad() { const el = document.getElementById("aiLoadMsg"); if (el) el.remove(); }

async function exportAlertsPDF() {
  const r = await apiGet("/products"); if (!r || !r.success) return toast("Erreur", "error");
  const alerts = r.data.filter(p => p.STOCK <= p.SEUIL);
  const { jsPDF } = window.jspdf; const doc = new jsPDF();
  doc.setFontSize(18); doc.text("Rapport des Alertes", 14, 22); doc.setFontSize(10); doc.text("Date: " + new Date().toLocaleDateString('fr-FR'), 14, 30);
  doc.autoTable({ head:[["Produit","Réf","Statut","Stock","Seuil"]], body:alerts.map(p=>[p.NAME,p.REF,p.STOCK===0?'RUPTURE':'BAS',p.STOCK,p.SEUIL]), startY:35, styles:{fontSize:9}, headStyles:{fillColor:[239,68,68],textColor:255} });
  doc.save("Rapport_Alertes.pdf"); toast("PDF exporté");
}
async function exportValuePDF() {
  const r = await apiGet("/products"); if (!r || !r.success) return toast("Erreur", "error");
  const { jsPDF } = window.jspdf; const doc = new jsPDF();
  doc.setFontSize(18); doc.text("Valeur du Stock", 14, 22); doc.setFontSize(10); doc.text("Date: " + new Date().toLocaleDateString('fr-FR'), 14, 30);
  const valid = r.data.filter(p => p.PRICE != null && p.STOCK != null);
  const total = valid.reduce((s,p) => s + (p.STOCK * p.PRICE), 0);
  doc.autoTable({ head:[["Produit","Qté","Prix","Valeur"]], body:valid.map(p=>[p.NAME,p.STOCK,p.PRICE.toFixed(2)+" MAD",(p.STOCK*p.PRICE).toFixed(2)+" MAD"]), startY:35, styles:{fontSize:9}, headStyles:{fillColor:[34,197,94],textColor:255}, foot:[["TOTAL","","",total.toFixed(2)+" MAD"]] });
  doc.save("Valeur_Stock.pdf"); toast("PDF exporté");
}
async function exportMovementsPDF() {
  const r = await apiGet("/movements"); if (!r || !r.success) return toast("Erreur", "error");
  const { jsPDF } = window.jspdf; const doc = new jsPDF();
  doc.setFontSize(18); doc.text("Historique Mouvements", 14, 22); doc.setFontSize(10); doc.text("Date: " + new Date().toLocaleDateString('fr-FR'), 14, 30);
  doc.autoTable({ head:[["Produit","Type","Quantité","Date"]], body:r.data.map(m=>[m.PRODUCT_NAME,m.TYPE==='in'?'Entrée':'Sortie',m.QUANTITY,m.CREATED_AT?m.CREATED_AT.split(' ')[0]:'-']), startY:35, styles:{fontSize:9}, headStyles:{fillColor:[14,165,233],textColor:255} });
  doc.save("Historique_Mouvements.pdf"); toast("PDF exporté");
}