// Script to upload CSV data to Supabase Postgres
// Usage: node upload_to_supabase.js <csvFile> <tableName>

const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse/sync');
const { createClient } = require('@supabase/supabase-js');
const { Client } = require('pg');

// --- CONFIG ---
const SUPABASE_URL = 'https://nohouhstbuysnimquvtx.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5vaG91aHN0YnV5c25pbXF1dnR4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTc3MDAxOSwiZXhwIjoyMDg1MzQ2MDE5fQ.S8EBKUQrJy8aOhkHR3CKTYReKRjoEmB03euLtsdnpIs';
// Using direct IPv4 address to bypass NAT64
const PG_CONNECTION_STRING = 'postgresql://postgres.nohouhstbuysnimquvtx:BlackfriarsPier25@54.247.26.119:5432/postgres';

// --- MAIN ---
async function uploadCSVtoPostgres(csvFile, tableName, skipRows = 0) {
  const csvPath = path.resolve(csvFile);
  let csvContent = fs.readFileSync(csvPath, 'utf8');
  
  // Skip header rows if specified
  if (skipRows > 0) {
    const lines = csvContent.split('\n');
    csvContent = lines.slice(skipRows).join('\n');
  }
  
  const records = parse(csvContent, { columns: true, skip_empty_lines: true });

  // Connect to Postgres directly for bulk insert (force IPv4)
  const dns = require('dns');
  dns.setDefaultResultOrder('ipv4first');
  
  const pg = new Client({ 
    connectionString: PG_CONNECTION_STRING,
    ssl: { rejectUnauthorized: false }
  });
  await pg.connect();

  let inserted = 0;
  let errors = 0;

  for (const row of records) {
    // Build columns and values - properly quote column names with special characters
    const columns = Object.keys(row).map(k => {
      // Sanitize column name for Postgres: replace special chars, lowercase, use underscores
      const sanitized = k.trim()
        .replace(/\s+/g, '_')
        .replace(/[\(\)\.%\/-]/g, '_')  // Replace (, ), ., %, /, - with underscore
        .replace(/_+/g, '_')  // Collapse multiple underscores
        .replace(/^_|_$/g, '')  // Remove leading/trailing underscores
        .toLowerCase();
      return `"${sanitized}"`;  // Quote column names
    });
    const values = Object.values(row);
    const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');
    const sql = `INSERT INTO ${tableName} (${columns.join(', ')}) VALUES (${placeholders})`;
    try {
      await pg.query(sql, values);
      inserted++;
    } catch (err) {
      errors++;
      console.error('Insert error:', err.message, '\nColumn names:', columns.join(', '));
    }
  }
  console.log(`Success: ${inserted}, Errors: ${errors}`);
  await pg.end();
  console.log(`Uploaded ${records.length} rows to ${tableName}`);
}

// --- CLI ---
if (require.main === module) {
  const [,, csvFile, tableName, skipRows] = process.argv;
  if (!csvFile || !tableName) {
    console.error('Usage: node upload_to_supabase.cjs <csvFile> <tableName> [skipRows]');
    process.exit(1);
  }
  uploadCSVtoPostgres(csvFile, tableName, parseInt(skipRows) || 0).catch(console.error);
}
