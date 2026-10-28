const API_URL = "http://localhost:3000/api";

function showMessage(divId, text, isSuccess) {
  const div = document.getElementById(divId);
  if (!div) return;
  div.textContent = text;
  div.className = "auth-message " + (isSuccess ? "success" : "error");
  div.style.display = "block";
}

// ==========================================
// INSCRIPTION (avec EMAIL)
// ==========================================
const signupForm = document.getElementById("signupForm");
if (signupForm) {
  signupForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const username = document.getElementById("newUsername").value.trim();
    const email    = document.getElementById("newEmail").value.trim();   // ✅ NOUVEAU
    const password = document.getElementById("newPassword").value;
    const confirm  = document.getElementById("confirmPassword").value;

    // Validation email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) return showMessage("signupMsg", "Adresse e-mail invalide.", false);
    if (password.length < 4)     return showMessage("signupMsg", "Mot de passe trop court (4 caractères min).", false);
    if (password !== confirm)    return showMessage("signupMsg", "Les mots de passe ne correspondent pas.", false);

    try {
      const res = await fetch(`${API_URL}/auth/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, email, password })   // ✅ email envoyé au backend
      });
      const data = await res.json();
      if (data.success) {
        showMessage("signupMsg", "Compte créé avec succès !", true);
        signupForm.reset();
        setTimeout(() => switchTab('login'), 800);   // ✅ utilise switchTab du HTML
      } else {
        showMessage("signupMsg", data.message, false);
      }
    } catch (e) {
      showMessage("signupMsg", "Serveur injoignable", false);
    }
  });
}

// ==========================================
// CONNEXION (username OU email)
// ==========================================
const loginForm = document.getElementById("loginForm");
if (loginForm) {
  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const identifier = document.getElementById("username").value.trim(); // username OU email
    const password   = document.getElementById("password").value;

    if (!identifier || !password) return showMessage("loginMsg", "Veuillez remplir tous les champs.", false);

    try {
      const res = await fetch(`${API_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: identifier, password })
        // Le backend devra chercher : WHERE username = ? OR email = ?
      });
      const data = await res.json();
      if (data.success) {
        localStorage.setItem("token", data.token);
        localStorage.setItem("username", data.user.username);
        localStorage.setItem("userRole", data.user.role);
        showMessage("loginMsg", "Connexion réussie !", true);
        loginForm.reset();
        setTimeout(() => { window.location.href = "dashboard.html"; }, 1200);
      } else {
        showMessage("loginMsg", data.message, false);
      }
    } catch (e) {
      showMessage("loginMsg", "Serveur injoignable", false);
    }
  });
}