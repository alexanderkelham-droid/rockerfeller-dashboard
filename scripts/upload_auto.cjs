// Comprehensive upload script that auto-creates tables from CSV/XLSX structure
const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse/sync');
const XLSX = require('xlsx');
const { Client } = require('pg');
const dns = require('dns');
dns.setDefaultResultOrder('ipv4first');

const PG_CONNECTION_STRING = 'postgresql://postgres.nohouhstbuysnimquvtx:BlackfriarsPier25@54.247.26.119:5432/postgres';

// Sanitize column name for PostgreSQL
function sanitizeColumn(name) {
  return name.trim()
    .replace(/\s+/g, '_')
    .replace(/[\(\)\.%\/-]/g, '_')  // Replace special chars with underscore
    .replace(/_+/g, '_')  // Collapse multiple underscores
    .replace(/^_|_$/g, '')  // Remove leading/trailing underscores
    .toLowerCase();
}

async function uploadData(dataFile, tableName, skipRows = 0) {
  const ext = path.extname(dataFile).toLowerCase();
  let records = [];
  let columns = [];
  
  if (ext === '.csv') {
    let csvContent = fs.readFileSync(dataFile, 'utf8');
    if (skipRows > 0) {
      const lines = csvContent.split('\n');
      csvContent = lines.slice(skipRows).join('\n');
    }
    records = parse(csvContent, { columns: true, skip_empty_lines: true, relax_column_count: true });
  } else if (ext === '.xlsx' || ext === '.xls') {
    const wb = XLSX.readFile(dataFile);
    const sheet = wb.Sheets[wb.SheetNames[0]];
    records = XLSX.utils.sheet_to_json(sheet, { defval: '' });
  } else {
    throw new Error(`Unsupported file type: ${ext}`);
  }
  
  if (records.length === 0) {
    console.log('No records found!');
    return;
  }
  
  // Get columns from first record
  columns = Object.keys(records[0]).map(sanitizeColumn);
  console.log(`Found ${records.length} records with ${columns.length} columns`);
  console.log('Columns:', columns.slice(0, 5).join(', '), '...');
  
  // Connect to Postgres
  const pg = new Client({ 
    connectionString: PG_CONNECTION_STRING,
    ssl: { rejectUnauthorized: false }
  });
  await pg.connect();
  
  // Drop and recreate table
  console.log(`\nDropping table ${tableName}...`);
  await pg.query(`DROP TABLE IF EXISTS ${tableName} CASCADE`);
  
  console.log(`Creating table ${tableName} with ${columns.length} TEXT columns...`);
  const columnDefs = columns.map(c => `"${c}" TEXT`).join(', ');
  await pg.query(`CREATE TABLE ${tableName} (id SERIAL PRIMARY KEY, ${columnDefs})`);
  
  // Insert data
  console.log(`Inserting ${records.length} rows...`);
  let inserted = 0;
  let errors = 0;
  
  for (const row of records) {
    const values = Object.values(row).map(v => v === undefined || v === null ? '' : String(v));
    const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');
    const quotedCols = columns.map(c => `"${c}"`).join(', ');
    const sql = `INSERT INTO ${tableName} (${quotedCols}) VALUES (${placeholders})`;
    try {
      await pg.query(sql, values);
      inserted++;
    } catch (err) {
      errors++;
      if (errors <= 3) {
        console.error('Insert error:', err.message);
      }
    }
  }
  
  await pg.end();
  console.log(`\nDone! Inserted: ${inserted}, Errors: ${errors}`);
}

// CLI
if (require.main === module) {
  const [,, dataFile, tableName, skipRows] = process.argv;
  if (!dataFile || !tableName) {
    console.error('Usage: node upload_auto.cjs <csvOrXlsxFile> <tableName> [skipRows]');
    process.exit(1);
  }
  uploadData(dataFile, tableName, parseInt(skipRows) || 0).catch(console.error);
}

module.exports = { uploadData };
