// Script to upload XLSX data to Supabase Postgres
// Usage: node scripts/upload_xlsx_to_supabase.cjs <xlsxFile> <tableName>

const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');
const { Client } = require('pg');

// --- CONFIG ---
// Using direct IPv4 address to bypass NAT64
const PG_CONNECTION_STRING = 'postgresql://postgres.nohouhstbuysnimquvtx:BlackfriarsPier25@54.247.26.119:5432/postgres';

// --- MAIN ---
async function uploadXLSXtoPostgres(xlsxFile, tableName) {
  const xlsxPath = path.resolve(xlsxFile);
  const workbook = XLSX.readFile(xlsxPath);
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const records = XLSX.utils.sheet_to_json(worksheet);

  // Connect to Postgres directly for bulk insert (force IPv4)
  const dns = require('dns');
  dns.setDefaultResultOrder('ipv4first');
  
  const pg = new Client({ 
    connectionString: PG_CONNECTION_STRING,
    ssl: { rejectUnauthorized: false }
  });
  await pg.connect();

  for (const row of records) {
    const columns = Object.keys(row).map(k => k.trim().replace(/\s+/g, '_').replace(/\(|\)/g, '').replace(/\./g, '').toLowerCase());
    const values = Object.values(row);
    const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');
    const sql = `INSERT INTO ${tableName} (${columns.join(', ')}) VALUES (${placeholders})`;
    try {
      await pg.query(sql, values);
    } catch (err) {
      console.error('Insert error:', err, '\nRow:', row);
    }
  }
  await pg.end();
  console.log(`Uploaded ${records.length} rows to ${tableName}`);
}

// --- CLI ---
if (require.main === module) {
  const [,, xlsxFile, tableName] = process.argv;
  if (!xlsxFile || !tableName) {
    console.error('Usage: node scripts/upload_xlsx_to_supabase.cjs <xlsxFile> <tableName>');
    process.exit(1);
  }
  uploadXLSXtoPostgres(xlsxFile, tableName).catch(console.error);
}
