function loadProfile() {
  const username = localStorage.getItem("username") || "Utilisateur";
  const role = localStorage.getItem("userRole") || "user";
  const initials = username.substring(0, 2).toUpperCase();
  document.getElementById("profileInitials").textContent = initials;
  document.getElementById("profileFullName").textContent = username;
  document.getElementById("profileRole").textContent = role.toUpperCase();
  const avatar = document.querySelector(".header-profile .profile-avatar");
  const pname = document.querySelector(".header-profile .profile-name");
  if (avatar) avatar.textContent = initials;
  if (pname) pname.textContent = username;
}
async function updateUsername() {
  const username = document.getElementById("inputUsername").value.trim();
  if (!username) return toast("Nom requis", "error");
  if (username.length < 3) return toast("Min 3 caractères", "error");
  const res = await apiPut("/auth/profile", { username });
  if (res && res.success) { toast("Mis à jour ! Reconnexion...", "success"); setTimeout(() => { localStorage.clear(); window.location.href = "../../index.html"; }, 1500); }
  else toast(res.message || "Erreur", "error");
}
async function updatePassword() {
  const password = document.getElementById("inputPassword").value;
  const confirm = document.getElementById("inputPasswordConfirm").value;
  if (!password) return toast("Mot de passe requis", "error");
  if (password.length < 4) return toast("Min 4 caractères", "error");
  if (password !== confirm) return toast("Ne correspond pas", "error");
  const res = await apiPut("/auth/profile", { password });
  if (res && res.success) { toast("Changé ! Reconnexion...", "success"); setTimeout(() => { localStorage.clear(); window.location.href = "../../index.html"; }, 1500); }
  else toast(res.message || "Erreur", "error");
}
loadProfile();