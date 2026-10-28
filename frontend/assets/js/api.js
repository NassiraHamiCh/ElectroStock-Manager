const API_URL = "http://localhost:3000/api";

function getHeaders() {
  const headers = { "Content-Type": "application/json" };
  const token = localStorage.getItem("token");
  if (token) { headers["x-auth-token"] = token; }
  return headers;
}

async function apiGet(endpoint) {
  try {
    const res = await fetch(API_URL + endpoint, { method: "GET", headers: getHeaders() });
    const data = await res.json();
    // ✅ LOG : ouvre la Console (F12) pour voir ce que le backend retourne
    console.log(`[API GET] ${endpoint}`, data);
    return data;
  } catch (e) {
    console.error(`[API GET ERREUR] ${endpoint}`, e);
    return { success: false };
  }
}

async function apiPost(endpoint, body) {
  try {
    const res = await fetch(API_URL + endpoint, { method: "POST", headers: getHeaders(), body: JSON.stringify(body) });
    const data = await res.json();
    console.log(`[API POST] ${endpoint}`, data);
    return data;
  } catch (e) {
    console.error(`[API POST ERREUR] ${endpoint}`, e);
    return { success: false };
  }
}

async function apiDelete(endpoint) {
  try {
    const res = await fetch(API_URL + endpoint, { method: "DELETE", headers: getHeaders() });
    const data = await res.json();
    console.log(`[API DELETE] ${endpoint}`, data);
    return data;
  } catch (e) {
    console.error(`[API DELETE ERREUR] ${endpoint}`, e);
    return { success: false };
  }
}

async function apiPut(endpoint, body) {
  try {
    const res = await fetch(API_URL + endpoint, { method: "PUT", headers: getHeaders(), body: JSON.stringify(body) });
    if (res.status === 401) { localStorage.clear(); window.location = '../../index.html'; return { success: false }; }
    const data = await res.json();
    console.log(`[API PUT] ${endpoint}`, data);
    return data;
  } catch (e) {
    console.error(`[API PUT ERREUR] ${endpoint}`, e);
    return { success: false, message: "Erreur réseau" };
  }
}