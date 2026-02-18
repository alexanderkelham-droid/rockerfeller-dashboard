// Script to update global_coal_plants table in Supabase with missing records from CSV
// Usage: node scripts/update_coal_plants.cjs <csvFile> <tableName>

const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse/sync');
const { Client } = require('pg');

// --- CONFIG ---
// Using direct IPv4 address to bypass NAT64
const PG_CONNECTION_STRING = 'postgresql://postgres.nohouhstbuysnimquvtx:BlackfriarsPier25@54.247.26.119:5432/postgres';

// --- MAIN ---
async function updateCoalPlants(csvFile, tableName) {
  const csvPath = path.resolve(csvFile);
  
  console.log(`Reading CSV file: ${csvPath}`);
  let csvContent = fs.readFileSync(csvPath, 'utf8');
  
  // Parse CSV
  const records = parse(csvContent, { columns: true, skip_empty_lines: true });
  console.log(`Found ${records.length} records in CSV.`);

  // Connect to Postgres
  const dns = require('dns');
  dns.setDefaultResultOrder('ipv4first');
  
  const pg = new Client({ 
    connectionString: PG_CONNECTION_STRING,
    ssl: { rejectUnauthorized: false }
  });
  
  try {
    await pg.connect();
    console.log('Connected to Database.');

    // Fetch existing IDs
    console.log(`Fetching existing IDs from ${tableName}...`);
    const res = await pg.query(`SELECT gem_unit_phase_id FROM ${tableName}`);
    const existingIds = new Set(res.rows.map(row => row.gem_unit_phase_id));
    console.log(`Found ${existingIds.size} existing records in database.`);

    // Identify missing records
    const missingRecords = records.filter(row => {
        // Ensure accurate ID mapping from CSV to what is expected in DB
        // The CSV header is 'GEM unit/phase ID', database column is 'gem_unit_phase_id'
        const id = row['GEM unit/phase ID']; 
        return !existingIds.has(id);
    });

    console.log(`Identified ${missingRecords.length} missing records to insert.`);

    if (missingRecords.length === 0) {
        console.log('No new records to insert. Exiting.');
        await pg.end();
        return;
    }

    let inserted = 0;
    let errors = 0;

    console.log('Starting insertion of missing records...');

    for (const row of missingRecords) {
      // Build columns and values - properly quote column names with special characters
      // Use the same sanitization logic as upload_to_supabase.cjs to match schema
      const columns = Object.keys(row).map(k => {
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
        if (inserted % 100 === 0) {
            process.stdout.write(`\rInserted: ${inserted}/${missingRecords.length}`);
        }
      } catch (err) {
        errors++;
        // Log first few errors or unique errors to avoid flooding
        if (errors <= 5) {
             console.error(`\nInsert error for ID ${row['GEM unit/phase ID']}:`, err.message);
        }
      }
    }
    
    console.log(`\n\nUpdate Complete.`);
    console.log(`Successfully inserted: ${inserted}`);
    console.log(`Errors: ${errors}`);

  } catch (err) {
    console.error('Database connection or query error:', err);
  } finally {
    await pg.end();
  }
}

// --- CLI ---
if (require.main === module) {
  const [,, csvFile, tableName] = process.argv;
  if (!csvFile || !tableName) {
    console.error('Usage: node scripts/update_coal_plants.cjs <csvFile> <tableName>');
    process.exit(1);
  }
  updateCoalPlants(csvFile, tableName).catch(console.error);
}
