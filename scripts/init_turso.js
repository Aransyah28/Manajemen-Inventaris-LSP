const fs = require('fs');
const path = require('path');
const { client } = require('../config/db');

async function initTursoDB() {
  console.log('🔄 Memulai proses migrasi dan inisialisasi Turso Cloud Database...');

  try {
    // 1. Membaca file skrip SQL DDL & DML
    const sqlPath = path.join(__dirname, '../docs/schema_turso.sql');
    const sqlScript = fs.readFileSync(sqlPath, 'utf8');

    // 2. Eksekusi seluruh skrip DDL/DML menggunakan executeMultiple (Direkomendasikan oleh Turso/libSQL Client)
    if (typeof client.executeMultiple === 'function') {
      await client.executeMultiple(sqlScript);
    } else {
      // Fallback batch jika executeMultiple tidak tersedia
      const statements = sqlScript
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0);

      await client.batch(
        statements.map(stmt => ({ sql: stmt, args: [] })),
        'write'
      );
    }

    console.log('✅ BERHASIL: Turso Cloud Database telah terisi dengan skema & data benih awal!');
    process.exit(0);
  } catch (error) {
    console.error('❌ GAGAL Inisialisasi Turso Database:', error);
    process.exit(1);
  }
}

initTursoDB();
