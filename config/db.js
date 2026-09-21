const { createClient } = require('@libsql/client');
require('dotenv').config();

// Membaca kredensial Turso dari file .env
const dbUrl = process.env.TURSO_DATABASE_URL || 'file:inventaris.db';
const authToken = process.env.TURSO_AUTH_TOKEN || undefined;

// Inisialisasi Client Turso Cloud Database
const client = createClient({
  url: dbUrl,
  authToken: authToken
});

/**
 * Helper Async Query Kompatibel Turso Cloud API
 */
async function query(sql, params = []) {
  try {
    const result = await client.execute({ sql, args: params });

    const rows = (result.rows || []).map(row => {
      const obj = {};
      for (const key of Object.keys(row)) {
        obj[key] = row[key];
      }
      return obj;
    });

    return [rows];
  } catch (error) {
    console.error('Turso DB Query Error:', error.message || error);
    throw error;
  }
}

module.exports = {
  client,
  query
};
