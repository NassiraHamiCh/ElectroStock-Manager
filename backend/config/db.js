const oracledb = require("oracledb");

// Initialiser le client Oracle pour Oracle XE
try {
  oracledb.initOracleClient();
} catch (err) {
  console.error("⚠ Oracle Instant Client non trouvé. Vérifiez l'installation d'Oracle Instant Client.");
}

async function getConnection() {
    try {
        const conn = await oracledb.getConnection({
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            connectString: process.env.DB_CONNECTION_STRING,
            
            // ⚠️REMARQUEE: Ne pas utiliser - SYSDBA - pour l'application web.
            // L'utilisateur Oracle a juste besoin des droits de base (CREATE TABLE, INSERT, SELECT) sur son propre schéma.
            privilege : oracledb.SYSDBA
        });
        return conn;
    } catch (err) {
        console.error("🔴 Erreur de connexion Oracle :", err.message);
        throw err;
    }
}

module.exports = { getConnection };