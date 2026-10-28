// Importation du module Express pour créer le serveur HTTP
const express  = require("express");
// Importation du module CORS pour autoriser les requêtes entre domaines différents (ex: Frontend sur port 3001, Backend sur port 3000)
const cors     = require("cors");
// Importation du module dotenv pour charger les variables d'environnement depuis le fichier .env
const dotenv   = require("dotenv");
// Importation du module oracledb pour permettre la connexion à la base de données Oracle
const oracledb = require("oracledb");
// Importation du module crypto (natif à Node.js) pour générer des chaînes de caractères aléatoires sécurisées (tokens)
const crypto   = require("crypto");   
// Importation du module bcrypt pour hacher (crypter) les mots de passe de manière sécurisée
const bcrypt   = require("bcrypt");   
// Importation de notre fichier local de configuration de base de données
const db       = require("./config/db");
const { exec } = require("child_process");   // ✅ NOUVEAU (natif à Node, rien à installer)

// Exécution de la fonction pour charger les variables du fichier .env dans process.env
dotenv.config();
// Création de l'application Express
const app = express();
// Ajout du middleware CORS à l'application pour accepter toutes les requêtes externes
app.use(cors());
// Ajout du middleware pour analyser le corps des requêtes HTTP et le transformer en objet JSON utilisable
app.use(express.json());

// Définition d'une constante pour le nombre de tours de salage (complexité) du hachage bcrypt
const SALT_ROUNDS = 10;

// Déclaration d'une fonction utilitaire pour afficher les erreurs de manière standardisée dans la console du serveur
function logError(route, error) {
  // Affichage dans la console du nom de la route où l'erreur s'est produite et du message d'erreur
  console.log(`\n❌ ERREUR DANS ${route}:`, error.message || error);
}

// Déclaration d'une fonction utilitaire pour formater les données renvoyées par Oracle
function fmt(row) {
  // Si la ligne de données est vide ou nulle, on la renvoie telle quelle
  if (!row) return row;
  // Création d'un nouvel objet vide qui contiendra les données formatées
  const r = {};
  // Boucle qui parcourt chaque clé (nom de colonne) de l'objet de données Oracle
  Object.keys(row).forEach(k => {
    // Récupération de la valeur correspondante à la clé actuelle
    let v = row[k];
    // Vérification si la valeur est un objet de type Date (typique des colonnes DATE Oracle)
    if (v instanceof Date) v = v.toISOString().slice(0, 19).replace("T", " ");
    // Assignation de la valeur (formatée si c'était une date) à la clé dans notre nouvel objet
    r[k] = v;
  });
  // Retour de l'objet formaté
  return r;
}

// Déclaration d'une fonction asynchrone pour nettoyer les sessions expirées dans la base de données
async function cleanSessions() {
  // Début d'un bloc try pour capturer les éventuelles erreurs de connexion à la base
  try {
    // Ouverture d'une connexion à la base de données Oracle
    const conn = await db.getConnection();
    // Exécution de la requête SQL pour supprimer les entrées de la table SESSIONS où la date d'expiration est dépassée
    await conn.execute(`DELETE FROM SESSIONS WHERE EXPIRES_AT < SYSTIMESTAMP`, [], { autoCommit: true });
    // Fermeture explicite de la connexion pour libérer les ressources
    await conn.close();
  // Bloc catch pour attraper les erreurs sans faire planter le serveur
  } catch(e) {}
}
// Appel de la fonction setInterval pour exécuter le nettoyage automatiquement toutes les 10 minutes (600 000 millisecondes)
setInterval(cleanSessions, 600000);

// Déclaration du middleware d'authentification qui protège les routes privées
async function authMiddleware(req, res, next) {
  // Récupération du token d'authentification depuis l'en-tête HTTP personnalisé "x-auth-token"
  const token = req.headers["x-auth-token"];
  // Si le token est absent, on renvoie immédiatement une réponse d'erreur 401 (Non autorisé)
  if (!token) return res.status(401).json({ success: false, message: "Non connecté" });
  // Début d'un bloc try pour vérifier la validité du token dans la base de données
  try {
    // Ouverture d'une connexion à la base de données
    const conn = await db.getConnection();
    // Exécution d'une requête SQL qui fait une jointure entre SESSIONS et USERS pour trouver à qui appartient ce token
    const r = await conn.execute(
      `SELECT s.USER_ID, s.TOKEN, u.USERNAME, u.ROLE, u.EMAIL FROM SESSIONS s JOIN USERS u ON s.USER_ID=u.ID WHERE s.TOKEN=:tok AND s.EXPIRES_AT > SYSTIMESTAMP`,
      // Passage du token en paramètre sécurisé pour éviter les injections SQL
      [token], 
      // Demande à Oracle de renvoyer les résultats sous forme d'objets JavaScript (au lieu d'un tableau de tableaux)
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    // Fermeture de la connexion à la base de données
    await conn.close();
    // Si la requête ne renvoie aucune ligne, cela signifie que le token est invalide ou a expiré
    if (r.rows.length === 0) return res.status(401).json({ success: false, message: "Session expirée" });
    // Si le token est valide, on stocke les informations de l'utilisateur extraites dans l'objet req pour les utiliser dans les routes suivantes
    req.user = fmt(r.rows[0]);
    // Appel de la fonction next() pour dire à Express de passer à la route suivante (l'utilisateur est bien authentifié)
    next();
  // Bloc catch en cas d'erreur technique lors de la requête SQL
  } catch (e) {
    // Appel de notre fonction utilitaire pour afficher l'erreur dans le terminal
    logError("authMiddleware", e);
    // Envoi d'une réponse erreur 500 (Erreur interne du serveur) au client
    res.status(500).json({ success: false, message: "Erreur serveur" });
  }
}

// ============================================
// AUTH
// ============================================
// Route POST pour l'inscription d'un nouvel utilisateur
// Route POST pour l'inscription d'un nouvel utilisateur
app.post("/api/auth/signup", async (req, res) => {
  // ✅ NOUVEAU : on récupère aussi l'email
  const { username, email, password } = req.body;

  // Validation des champs
  if (!username || !email || !password || password.length < 4)
    return res.status(400).json({ success: false, message: "Tous les champs sont requis (mot de passe min 4 caractères)" });

  // ✅ NOUVEAU : validation du format de l'email
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email))
    return res.status(400).json({ success: false, message: "Adresse e-mail invalide" });

  try {
    const conn = await db.getConnection();

    // ✅ MODIFIÉ : vérifier si le pseudo OU l'email existe déjà
    const chk = await conn.execute(
      `SELECT ID FROM USERS WHERE UPPER(USERNAME)=UPPER(:usr) OR LOWER(EMAIL)=LOWER(:eml)`,
      [username, email]
    );
    if (chk.rows.length > 0) {
      await conn.close();
      return res.status(409).json({ success: false, message: "Nom d'utilisateur ou e-mail déjà utilisé" });
    }

    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

    // ✅ MODIFIÉ : INSERT avec l'EMAIL
    await conn.execute(
      `INSERT INTO USERS (USERNAME, EMAIL, PASSWORD, ROLE) VALUES (:usr, :eml, :pwd, 'admin')`,
      [username, email, hashedPassword],
      { autoCommit: true }
    );
    await conn.close();
    res.json({ success: true, message: "Compte créé" });

  } catch (e) {
    // Si contrainte UNIQUE violée (doublon)
    if (e.errorNum === 1) return res.status(409).json({ success: false, message: "Nom ou e-mail déjà utilisé" });
    logError("/api/auth/signup", e);
    res.status(500).json({ success: false, message: "Erreur" });
  }
});

// Route POST pour la connexion d'un utilisateur existant
app.post("/api/auth/login", async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password)
    return res.status(400).json({ success: false, message: "Champs requis" });

  try {
    const conn = await db.getConnection();

    // ✅ MODIFIÉ : connexion par USERNAME **OU** EMAIL
    const r = await conn.execute(
      `SELECT ID, USERNAME, ROLE, EMAIL, PASSWORD FROM USERS WHERE UPPER(USERNAME)=UPPER(:v_user) OR LOWER(EMAIL)=LOWER(:v_user)`,
      [username],
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    await conn.close();

    if (r.rows.length === 0)
      return res.status(401).json({ success: false, message: "Identifiants incorrects" });

    const user = fmt(r.rows[0]);
    const passwordMatch = await bcrypt.compare(password, user.PASSWORD);
    if (!passwordMatch)
      return res.status(401).json({ success: false, message: "Identifiants incorrects" });

    // (rien ne change en dessous)
    const token   = crypto.randomBytes(32).toString("hex");
    const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const conn2 = await db.getConnection();
    await conn2.execute(
      `INSERT INTO SESSIONS (TOKEN, USER_ID, EXPIRES_AT) VALUES (:v_token, :v_uid, :v_exp)`,
      [token, user.ID, expires],
      { autoCommit: true }
    );
    await conn2.close();

    res.json({
      success: true,
      user: { id: user.ID, username: user.USERNAME, role: user.ROLE, email: user.EMAIL },
      token
    });

  } catch (e) {
    logError("/api/auth/login", e);
    res.status(500).json({ success: false, message: "Erreur" });
  }
});

// Route GET pour récupérer les informations de l'utilisateur actuellement connecté
app.get("/api/auth/me", authMiddleware, (req, res) => {
  // Comme le middleware authMiddleware s'est exécuté juste avant, req.user contient les infos de l'utilisateur. On les renvoie simplement.
  res.json({ success: true, user: req.user });
});

// Route PUT pour permettre à l'utilisateur de modifier son propre profil
app.put("/api/auth/profile", authMiddleware, async (req, res) => {
  // Récupération du nouveau nom d'utilisateur (soit depuis req.body.username, soit depuis req.body.name par sécurité)
  const username = req.body.username || req.body.name;
  // Récupération du nouveau mot de passe s'il est fourni
  const password = req.body.password;
  // Début du bloc try pour les mises à jour en base
  try {
    // Ouverture de la connexion
    const conn = await db.getConnection();
    // Si un nouveau nom d'utilisateur a été fourni
    if (username)
      // Mise à jour du nom dans la base pour l'utilisateur connecté (utilise req.user.USER_ID venant du middleware)
      await conn.execute(`UPDATE USERS SET USERNAME=:u WHERE ID=:id`, [username, req.user.USER_ID], { autoCommit: true });
    // Si un nouveau mot de passe a été fourni
    if (password) {
      // Hachage du nouveau mot de passe avant de le stocker (ne jamais stocker en clair)
      const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS); 
      // Mise à jour du mot de passe en base
      await conn.execute(`UPDATE USERS SET PASSWORD=:p WHERE ID=:id`, [hashedPassword, req.user.USER_ID], { autoCommit: true });
    }
    // Fermeture de la connexion
    await conn.close();
    // Renvoi d'une réponse de succès
    res.json({ success: true, message: "Profil mis à jour" });
  // Gestion des erreurs SQL
  } catch (e) {
    // Si l'erreur Oracle a le code 1, cela signifie une contrainte d'unicité violée (le pseudo est déjà pris par quelqu'un d'autre)
    if (e.errorNum === 1) return res.status(409).json({ success: false, message: "Nom déjà pris !" });
    logError("/api/auth/profile", e);
    res.status(500).json({ success: false, message: "Erreur" });
  }
});

// Remarque : La route de déconnexion a été regroupée ici avec les autres routes d'authentification pour une meilleure organisation du code
// Route POST pour déconnecter l'utilisateur (supprimer sa session active)
app.post("/api/auth/logout", authMiddleware, async (req, res) => {
  try {
    // Ouverture d'une connexion à la base de données
    const conn = await db.getConnection();
    // Requête SQL pour supprimer de la table SESSIONS la ligne correspondant au token envoyé dans l'en-tête de la requête
    await conn.execute(`DELETE FROM SESSIONS WHERE TOKEN=:tok`, [req.headers["x-auth-token"]], { autoCommit: true });
    // Fermeture de la connexion
    await conn.close();
    // Envoi de la réponse confirmant la déconnexion
    res.json({ success: true, message: "Déconnecté" });
  // Gestion des erreurs
  } catch (e) { logError("/api/auth/logout", e); res.status(500).json({ success: false, message: "Erreur" }); }
});

// ============================================
// PRODUITS
// ============================================
// Route GET pour récupérer la liste de tous les produits
app.get("/api/products", authMiddleware, async (req, res) => {
  try {
    // Ouverture de connexion
    const conn = await db.getConnection();
    // Requête SQL complexe avec un LEFT JOIN pour récupérer les produits ET le nom de leur catégorie associée
    const r = await conn.execute(
      `SELECT p.ID, p.NAME, p.REF, p.CATEGORY_ID, p.SUPPLIER_ID, p.PRICE, p.STOCK, p.SEUIL, p.LOCATION, p.DESCRIPTION, p.CREATED_AT, c.NAME AS CATEGORY_NAME FROM PRODUCTS p LEFT JOIN CATEGORIES c ON p.CATEGORY_ID=c.ID ORDER BY p.ID`,
      [], { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    // Fermeture de connexion
    await conn.close();
    // Envoi des données au frontend en appliquant la fonction fmt sur chaque ligne pour formater les dates
    res.json({ success: true, data: r.rows.map(fmt) });
  } catch (e) { logError("/api/products GET", e); res.status(500).json({ success: false, message: "Erreur" }); }
});

// ============================================
// MOT DE PASSE OUBLIÉ (mode démo : lien dans la console)
// ============================================
app.post("/api/auth/forgot", async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ success: false, message: "Email requis" });

  // ⚠️ ADAPTE : ouvre login.html dans ton navigateur et copie l'URL SANS "login.html"
  const FRONTEND_URL = "http://localhost:5501/frontend/docs";  // ✅ TON URL

  try {
    const conn = await db.getConnection();
    const r = await conn.execute(
      `SELECT ID, USERNAME FROM USERS WHERE LOWER(EMAIL)=LOWER(:eml)`,
      [email], { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    await conn.close();

    if (r.rows.length === 0)
      return res.json({ success: true, message: "Si un compte existe, un lien a été généré." });

    const user = fmt(r.rows[0]);

    // Token valable 1 heure
    const resetToken = crypto.randomBytes(32).toString("hex");
    const expires = new Date(Date.now() + 60 * 60 * 1000);

    const conn2 = await db.getConnection();
    await conn2.execute(`DELETE FROM PASSWORD_RESETS WHERE USER_ID=:id`, [user.ID], { autoCommit: true });
    await conn2.execute(
      `INSERT INTO PASSWORD_RESETS (TOKEN, USER_ID, EXPIRES_AT) VALUES (:t, :id, :exp)`,
      [resetToken, user.ID, expires], { autoCommit: true }
    );
    await conn2.close();
    const resetLink = `${FRONTEND_URL}/reset.html?token=${resetToken}`;

    console.log(`\n📧 RESET pour ${email}`);
    console.log(`🔗 LIEN : ${resetLink}\n`);

    // 🚀 Ouvre AUTOMATIQUEMENT le navigateur (Windows)
    exec(`start "" "${resetLink}"`);
    res.json({ success: true, message: "Lien généré ! (voir la console du serveur)" });

  } catch (e) {
    logError("/api/auth/forgot", e);
    res.status(500).json({ success: false, message: "Erreur" });
  }
});

// ============================================
// RÉINITIALISATION DU MOT DE PASSE
// ============================================
app.post("/api/auth/reset", async (req, res) => {
  const { token, password } = req.body;
  if (!token || !password || password.length < 4)
    return res.status(400).json({ success: false, message: "Token et mot de passe (min 4) requis" });

  try {
    const conn = await db.getConnection();

    // 1. Vérifier le token (valide + pas expiré)
    const r = await conn.execute(
      `SELECT USER_ID FROM PASSWORD_RESETS WHERE TOKEN=:t AND EXPIRES_AT > SYSTIMESTAMP`,
      [token], { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    if (r.rows.length === 0) {
      await conn.close();
      return res.status(401).json({ success: false, message: "Lien invalide ou expiré" });
    }
    const userId = r.rows[0].USER_ID;

    // 2. Sauvegarder le nouveau mot de passe (haché)
    const hashed = await bcrypt.hash(password, SALT_ROUNDS);
    await conn.execute(`UPDATE USERS SET PASSWORD=:p WHERE ID=:id`, [hashed, userId], { autoCommit: true });

    // 3. Token à usage unique → supprimé
    await conn.execute(`DELETE FROM PASSWORD_RESETS WHERE TOKEN=:t`, [token], { autoCommit: true });

    // 4. Sécurité : déconnecter toutes les sessions de cet utilisateur
    await conn.execute(`DELETE FROM SESSIONS WHERE USER_ID=:id`, [userId], { autoCommit: true });

    await conn.close();
    res.json({ success: true, message: "Mot de passe modifié ! Connectez-vous." });

  } catch (e) {
    logError("/api/auth/reset", e);
    res.status(500).json({ success: false, message: "Erreur" });
  }
});

// Route POST pour ajouter un nouveau produit dans la base
app.post("/api/products", authMiddleware, async (req, res) => {
  // Extraction de toutes les variables possibles depuis le corps de la requête (gère les différents formats frontend possibles)
  const name        = req.body.name;
  const ref         = req.body.ref || req.body.reference;
  const category_id = req.body.category_id || req.body.categoryId;
  const price       = req.body.price;
  const stock       = req.body.stock;
  const seuil       = req.body.seuil || req.body.threshold;
  // Vérification stricte que le nom et la référence sont fournis (champs obligatoires)
  if (!name || !ref) return res.status(400).json({ success: false, message: "Nom et référence obligatoires" });
  try {
    // Ouverture de connexion
    const conn = await db.getConnection();
    // Requête d'insertion du nouveau produit, avec des valeurs par défaut (0 pour le prix et le stock, 10 pour le seuil) si elles ne sont pas fournies
    await conn.execute(
      `INSERT INTO PRODUCTS (NAME, REF, CATEGORY_ID, PRICE, STOCK, SEUIL) VALUES (:n,:r,:c,:p,:st,:se)`,
      [name, ref, category_id, price || 0, stock || 0, seuil || 10], { autoCommit: true }
    );
    // Fermeture de connexion
    await conn.close();
    // Confirmation de l'ajout
    res.json({ success: true, message: "Produit ajouté" });
  } catch (e) {
    // Gestion de l'erreur si la référence fournie est déjà attribuée à un autre produit (erreur d'unicité Oracle)
    if (e.errorNum === 1) return res.status(409).json({ success: false, message: "Référence déjà existante !" });
    logError("/api/products POST", e); res.status(500).json({ success: false, message: "Erreur" });
  }
});

// Route PUT pour modifier un produit existant identifié par son ID dans l'URL
app.put("/api/products/:id", authMiddleware, async (req, res) => {
  // Extraction des données à mettre à jour
  const name        = req.body.name;
  const ref         = req.body.ref || req.body.reference;
  const category_id = req.body.category_id || req.body.categoryId;
  const price       = req.body.price;
  const stock       = req.body.stock;
  const seuil       = req.body.seuil || req.body.threshold;
  try {
    // Ouverture de connexion
    const conn = await db.getConnection();
    // Requête de mise à jour (UPDATE) des informations du produit ciblé par son ID (req.params.id)
    await conn.execute(
      `UPDATE PRODUCTS SET NAME=:n, REF=:r, CATEGORY_ID=:c, PRICE=:p, STOCK=:st, SEUIL=:se WHERE ID=:id`,
      [name, ref, category_id, price, stock, seuil, req.params.id], { autoCommit: true }
    );
    // Fermeture de connexion
    await conn.close();
    // Confirmation de la modification
    res.json({ success: true, message: "Produit modifié" });
  } catch (e) {
    // Vérification si la modification a causé un doublon sur la référence
    if (e.errorNum === 1) return res.status(409).json({ success: false, message: "Référence déjà existante !" });
    logError("/api/products PUT", e); res.status(500).json({ success: false, message: "Erreur" });
  }
});

// Route DELETE pour supprimer un produit précis via son ID
app.delete("/api/products/:id", authMiddleware, async (req, res) => {
  try {
    // Ouverture de connexion
    const conn = await db.getConnection();
    // Requête SQL pour supprimer la ligne correspondant à l'ID dans la table PRODUCTS
    await conn.execute(`DELETE FROM PRODUCTS WHERE ID=:id`, [req.params.id], { autoCommit: true });
    // Fermeture de connexion
    await conn.close();
    // Confirmation de la suppression
    res.json({ success: true, message: "Produit supprimé" });
  } catch (e) { logError("/api/products DELETE", e); res.status(500).json({ success: false, message: "Erreur" }); }
});

// ============================================
// CATÉGORIES
// ============================================
// Route GET pour récupérer la liste des catégories avec le nombre de produits associés à chacune
app.get("/api/categories", authMiddleware, async (req, res) => {
  try {
    // Ouverture de connexion
    const conn = await db.getConnection();
    // Requête SQL utilisant une sous-requête (SELECT COUNT) pour calculer PRODUCT_COUNT pour chaque catégorie
    const r = await conn.execute(
      `SELECT c.ID, c.NAME, c.ICON, c.DESCRIPTION, (SELECT COUNT(*) FROM PRODUCTS WHERE CATEGORY_ID=c.ID) AS PRODUCT_COUNT FROM CATEGORIES c ORDER BY c.ID`,
      [], { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    // Fermeture de connexion
    await conn.close();
    // Envoi des données formatées
    res.json({ success: true, data: r.rows.map(fmt) });
  } catch (e) { logError("/api/categories GET", e); res.status(500).json({ success: false, message: "Erreur" }); }
});

// Route POST pour créer une nouvelle catégorie
app.post("/api/categories", authMiddleware, async (req, res) => {
  // Récupération du nom de la catégorie
  const name = req.body.name;
  // Vérification que le nom n'est pas vide
  if (!name) return res.status(400).json({ success: false, message: "Nom obligatoire" });
  try {
    // Ouverture de connexion
    const conn = await db.getConnection();
    // Insertion de la catégorie, avec l'icône fournie ou 'fa-tag' par défaut si aucune n'est choisie
    await conn.execute(`INSERT INTO CATEGORIES (NAME, ICON) VALUES (:n, :i)`, [name, req.body.icon || 'fa-tag'], { autoCommit: true });
    // Fermeture de connexion
    await conn.close();
    // Confirmation
    res.json({ success: true, message: "Catégorie ajoutée" });
  } catch (e) { logError("/api/categories POST", e); res.status(500).json({ success: false, message: "Erreur" }); }
});

// Route DELETE pour supprimer une catégorie
app.delete("/api/categories/:id", authMiddleware, async (req, res) => {
  try {
    // Ouverture de connexion
    const conn = await db.getConnection();
    // Suppression de la catégorie via son ID
    await conn.execute(`DELETE FROM CATEGORIES WHERE ID=:id`, [req.params.id], { autoCommit: true });
    // Fermeture de connexion
    await conn.close();
    // Confirmation
    res.json({ success: true, message: "Catégorie supprimée" });
  } catch (e) { logError("/api/categories DELETE", e); res.status(500).json({ success: false, message: "Erreur" }); }
});

// ============================================
// FOURNISSEURS
// ============================================
// Route GET pour la liste des fournisseurs avec le nombre de produits qu'ils fournissent
app.get("/api/suppliers", authMiddleware, async (req, res) => {
  try {
    // Ouverture de connexion
    const conn = await db.getConnection();
    // Requête avec sous-requête pour compter les produits liés au fournisseur
    const r = await conn.execute(
      `SELECT s.ID, s.NAME, s.EMAIL, s.PHONE, s.ADDRESS, (SELECT COUNT(*) FROM PRODUCTS WHERE SUPPLIER_ID=s.ID) AS PRODUCT_COUNT FROM SUPPLIERS s ORDER BY s.ID`,
      [], { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    // Fermeture de connexion
    await conn.close();
    // Envoi des données
    res.json({ success: true, data: r.rows.map(fmt) });
  } catch (e) { logError("/api/suppliers GET", e); res.status(500).json({ success: false, message: "Erreur" }); }
});

// Route POST pour ajouter un fournisseur
app.post("/api/suppliers", authMiddleware, async (req, res) => {
  // Récupération du nom
  const name = req.body.name;
  // Vérification du nom
  if (!name) return res.status(400).json({ success: false, message: "Nom obligatoire" });
  try {
    // Ouverture de connexion
    const conn = await db.getConnection();
    // Insertion des informations du fournisseur
    await conn.execute(
      `INSERT INTO SUPPLIERS (NAME, EMAIL, PHONE, ADDRESS) VALUES (:n,:e,:p,:a)`,
      [name, req.body.email, req.body.phone, req.body.address], { autoCommit: true }
    );
    // Fermeture de connexion
    await conn.close();
    // Confirmation
    res.json({ success: true, message: "Fournisseur ajouté" });
  } catch (e) { logError("/api/suppliers POST", e); res.status(500).json({ success: false, message: "Erreur" }); }
});

// Route DELETE pour supprimer un fournisseur
app.delete("/api/suppliers/:id", authMiddleware, async (req, res) => {
  try {
    // Ouverture de connexion
    const conn = await db.getConnection();
    // Requête de suppression
    await conn.execute(`DELETE FROM SUPPLIERS WHERE ID=:id`, [req.params.id], { autoCommit: true });
    // Fermeture de connexion
    await conn.close();
    // Confirmation
    res.json({ success: true, message: "Fournisseur supprimé" });
  } catch (e) { logError("/api/suppliers DELETE", e); res.status(500).json({ success: false, message: "Erreur" }); }
});

// ============================================
// MOUVEMENTS
// ============================================
// Route GET pour récupérer l'historique des mouvements de stock
app.get("/api/movements", authMiddleware, async (req, res) => {
  try {
    // Ouverture de connexion
    const conn = await db.getConnection();
    // Requête avec jointure pour afficher le nom du produit lié à chaque mouvement, triés du plus récent au plus ancien
    const r = await conn.execute(
      `SELECT m.ID, m.PRODUCT_ID, m.TYPE, m.QUANTITY, m.NOTE, m.CREATED_BY, m.CREATED_AT, p.NAME AS PRODUCT_NAME FROM MOVEMENTS m JOIN PRODUCTS p ON m.PRODUCT_ID=p.ID ORDER BY m.CREATED_AT DESC`,
      [], { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    // Fermeture de connexion
    await conn.close();
    // Envoi des données formatées
    res.json({ success: true, data: r.rows.map(fmt) });
  } catch (e) { logError("/api/movements GET", e); res.status(500).json({ success: false, message: "Erreur" }); }
});

// Route POST pour enregistrer un nouveau mouvement de stock (entrée ou sortie)
app.post("/api/movements", authMiddleware, async (req, res) => {
  // Récupération de l'ID du produit concerné
  const product_id = req.body.product_id || req.body.productId;
  // Récupération du type de mouvement ('in' pour entrée, 'out' pour sortie)
  const type       = req.body.type;
  // Récupération de la quantité mue
  const quantity   = req.body.quantity;
  // Récupération d'une note éventuelle
  const note       = req.body.note;
  // Vérification que les champs obligatoires sont remplis
  if (!product_id || !quantity || !type)
    return res.status(400).json({ success: false, message: "Champs requis" });
  try {
    // Ouverture de connexion
    const conn = await db.getConnection();
    // Si c'est une entrée de stock ('in'), on ajoute la quantité au stock actuel
    if (type === "in")
      await conn.execute(`UPDATE PRODUCTS SET STOCK=STOCK+:q WHERE ID=:p`, [quantity, product_id], { autoCommit: true });
    // Si c'est une sortie de stock ('out'), on soustrait la quantité. GREATEST empêche le stock de passer en dessous de 0
    else
      await conn.execute(`UPDATE PRODUCTS SET STOCK=GREATEST(STOCK-:q,0) WHERE ID=:p`, [quantity, product_id], { autoCommit: true });
    // Une fois le stock mis à jour, on enregistre l'historique de ce mouvement dans la table MOVEMENTS
    await conn.execute(
      `INSERT INTO MOVEMENTS (PRODUCT_ID, TYPE, QUANTITY, NOTE, CREATED_BY) VALUES (:p,:t,:q,:n,:u)`,
      // Récupération du nom de l'utilisateur qui fait l'action via le middleware, ou "system" par défaut
      [product_id, type, quantity, note, req.user ? req.user.USERNAME : "system"], { autoCommit: true }
    );
    // Fermeture de connexion
    await conn.close();
    // Confirmation
    res.json({ success: true, message: "Mouvement enregistré" });
  } catch (e) { logError("/api/movements POST", e); res.status(500).json({ success: false, message: "Erreur" }); }
});

// ============================================
// INVENTAIRE
// ============================================
// Route GET pour afficher les états des inventaires passés
app.get("/api/inventory", authMiddleware, async (req, res) => {
  try {
    // Ouverture de connexion
    const conn = await db.getConnection();
    // Requête avec jointure pour récupérer les inventaires avec le nom du produit associé
    const r = await conn.execute(
      `SELECT i.ID, i.PRODUCT_ID, i.SYSTEM_QTY, i.PHYSICAL_QTY, i.STATUS, i.NOTE, i.CREATED_AT, p.NAME AS PRODUCT_NAME FROM INVENTORY i JOIN PRODUCTS p ON i.PRODUCT_ID=p.ID ORDER BY i.CREATED_AT DESC`,
      [], { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    // Fermeture de connexion
    await conn.close();
    // Envoi des données
    res.json({ success: true, data: r.rows.map(fmt) });
  } catch (e) { logError("/api/inventory GET", e); res.status(500).json({ success: false, message: "Erreur" }); }
});

// Route POST pour soumettre un nouveau comptage d'inventaire physique
app.post("/api/inventory", authMiddleware, async (req, res) => {
  // Récupération de l'ID du produit compté
  const product_id  = req.body.product_id || req.body.productId;
  // Récupération du stock system (celui affiché sur l'ordinateur), avec plusieurs fallbacks selon le format envoyé par le frontend
  const system_qty  = req.body.systemStock || req.body.systemQty || req.body.system_qty || 0;
  // Récupération du stock physique réel compté en entrepôt
  const physical_qty = req.body.physicalStock || req.body.physicalQty || req.body.physical_qty;
  // Récupération d'un commentaire
  const note        = req.body.note;
  // Vérification que l'ID produit et la quantité physique sont bien fournis
  if (!product_id || physical_qty === null || physical_qty === undefined)
    return res.status(400).json({ success: false, message: "Champs requis" });
  // Calcul de la différence entre le stock physique et le stock système
  const diff   = physical_qty - system_qty;
  // Détermination du statut : "conforme" s'il n'y a pas de différence, sinon "ecart"
  const status = diff === 0 ? 'conforme' : 'ecart';
  try {
    // Ouverture de connexion
    const conn = await db.getConnection();
    // Insertion de l'état de ce comptage dans la table INVENTORY
    await conn.execute(
      `INSERT INTO INVENTORY (PRODUCT_ID, SYSTEM_QTY, PHYSICAL_QTY, STATUS, NOTE) VALUES (:p,:s,:ph,:st,:n)`,
      [product_id, system_qty, physical_qty, status, note], { autoCommit: true }
    );
    // Fermeture de connexion
    await conn.close();
    // Confirmation
    res.json({ success: true, message: "Comptage enregistré" });
  } catch (e) { logError("/api/inventory POST", e); res.status(500).json({ success: false, message: "Erreur" }); }
});

// ============================================
// UTILISATEURS
// ============================================
// Route GET pour lister tous les utilisateurs (sans afficher leurs mots de passe pour des raisons de sécurité)
app.get("/api/users", authMiddleware, async (req, res) => {
  try {
    // Ouverture de connexion
    const conn = await db.getConnection();
    // Requête sélectionnant uniquement les colonnes publiques
    const r = await conn.execute(
      `SELECT ID, USERNAME, EMAIL, ROLE, CREATED_AT FROM USERS ORDER BY ID`,
      [], { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    // Fermeture de connexion
    await conn.close();
    // Envoi des données
    res.json({ success: true, data: r.rows.map(fmt) });
  } catch (e) { logError("/api/users GET", e); res.status(500).json({ success: false, message: "Erreur" }); }
});

// Route POST pour qu'un administrateur puisse créer un nouvel utilisateur directement
app.post("/api/users", authMiddleware, async (req, res) => {
  // Récupération du nom d'utilisateur
  const username = req.body.username || req.body.name;
  // Récupération du mot de passe
  const password = req.body.password;
  // Récupération du rôle, par défaut 'user' si rien n'est précisé
  const role     = req.body.role || 'user';
  // Vérification des champs
  if (!username || !password)
    return res.status(400).json({ success: false, message: "Champs requis" });
  try {
    // Hachage du mot de passe avant stockage
    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS); 
    // Ouverture de connexion
    const conn = await db.getConnection();
    // Insertion du nouvel utilisateur avec son rôle
    await conn.execute(
      `INSERT INTO USERS (USERNAME, PASSWORD, ROLE) VALUES (:u, :p, :r)`,
      [username, hashedPassword, role], { autoCommit: true }
    );
    // Fermeture de connexion
    await conn.close();
    // Confirmation
    res.json({ success: true, message: "Utilisateur créé" });
  } catch (e) {
    // Gestion du doublon sur le pseudo
    if (e.errorNum === 1) return res.status(409).json({ success: false, message: "Nom déjà pris !" });
    logError("/api/users POST", e); res.status(500).json({ success: false, message: "Erreur" });
  }
});

// Route PUT pour qu'un administrateur modifie un utilisateur
app.put("/api/users/:id", authMiddleware, async (req, res) => {
  // Récupération des potentielles nouvelles valeurs
  const username = req.body.username || req.body.name;
  const password = req.body.password;
  const role     = req.body.role;
  try {
    // Ouverture de connexion
    const conn = await db.getConnection();
    // Si un nouveau nom est fourni, mise à jour du nom
    if (username) await conn.execute(`UPDATE USERS SET USERNAME=:u WHERE ID=:id`, [username, req.params.id], { autoCommit: true });
    // Si un nouveau mot de passe est fourni, hachage puis mise à jour
    if (password) {
      const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS); 
      await conn.execute(`UPDATE USERS SET PASSWORD=:p WHERE ID=:id`, [hashedPassword, req.params.id], { autoCommit: true });
    }
    // Si un nouveau rôle est fourni, mise à jour du rôle
    if (role) await conn.execute(`UPDATE USERS SET ROLE=:r WHERE ID=:id`, [role, req.params.id], { autoCommit: true });
    // Fermeture de connexion
    await conn.close();
    // Confirmation
    res.json({ success: true, message: "Utilisateur modifié" });
  } catch (e) { logError("/api/users PUT", e); res.status(500).json({ success: false, message: "Erreur" }); }
});

// Route DELETE pour supprimer un utilisateur
app.delete("/api/users/:id", authMiddleware, async (req, res) => {
  try {
    // Ouverture de connexion
    const conn = await db.getConnection();
    // Suppression d'abord de toutes les sessions actives liées à cet utilisateur pour éviter les fantômes connectés
    await conn.execute(`DELETE FROM SESSIONS WHERE USER_ID=:id`, [req.params.id], { autoCommit: true });
    // Puis suppression de l'utilisateur lui-même
    await conn.execute(`DELETE FROM USERS WHERE ID=:id`, [req.params.id], { autoCommit: true });
    // Fermeture de connexion
    await conn.close();
    // Confirmation
    res.json({ success: true, message: "Utilisateur supprimé" });
  } catch (e) { logError("/api/users DELETE", e); res.status(500).json({ success: false, message: "Erreur" }); }
});

// ============================================
// STATS
// ============================================
// Route GET pour calculer et envoyer les statistiques principales du tableau de bord (Dashboard)
app.get("/api/stats", authMiddleware, async (req, res) => {
  try {
    // Ouverture de connexion
    const conn = await db.getConnection();
    // Requête pour compter le nombre total de produits
    const p = await conn.execute(`SELECT COUNT(*) FROM PRODUCTS`);
    // Requête pour calculer la valeur financière totale du stock (Prix * Quantité pour chaque produit). NVL gère le cas où la somme serait NULL
    const v = await conn.execute(`SELECT NVL(SUM(PRICE*STOCK),0) FROM PRODUCTS`);
    // Requête pour compter le nombre de mouvements de stock effectués au cours des 30 derniers jours
    const m = await conn.execute(`SELECT COUNT(*) FROM MOVEMENTS WHERE CREATED_AT >= TRUNC(SYSDATE-30)`);
    // Requête pour compter le nombre de produits en alerte (stock inférieur au seuil minimum OU stock à 0)
    const a = await conn.execute(`SELECT COUNT(*) FROM PRODUCTS WHERE STOCK < SEUIL OR STOCK = 0`);
    // Fermeture de connexion
    await conn.close();
    // Envoi d'un objet contenant les 4 statistiques calculées au frontend
    res.json({ success: true, data: {
      // Récupération de la première valeur du premier résultat (Index 0 de la ligne 0)
      products:  p.rows[0][0],
      value:     v.rows[0][0],
      movements: m.rows[0][0],
      alerts:    a.rows[0][0]
    }});
  // Gestion des erreurs
  } catch (e) { logError("/api/stats", e); res.status(500).json({ success: false, message: "Erreur" }); }
});

// ============================================
// START
// ============================================
// Définition du port d'écoute du serveur, en utilisant la variable d'environnement PORT ou 3000 par défaut
const PORT = process.env.PORT || 3000;
// Démarrage effectif du serveur Express, qui écoute les requêtes entrantes sur le port défini
app.listen(PORT, () => console.log(`✅ Serveur sur http://localhost:${PORT}`));