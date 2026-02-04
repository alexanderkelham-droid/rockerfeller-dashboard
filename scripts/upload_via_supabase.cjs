// Script to upload CSV data to Supabase using Supabase JS client
// Usage: node upload_via_supabase.cjs <csvFile> <tableName>

const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse/sync');
const { createClient } = require('@supabase/supabase-js');

// --- CONFIG ---
const SUPABASE_URL = 'https://nohouhstbuysnimquvtx.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5vaG91aHN0YnV5c25pbXF1dnR4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTc3MDAxOSwiZXhwIjoyMDg1MzQ2MDE5fQ.S8EBKUQrJy8aOhkHR3CKTYReKRjoEmB03euLtsdnpIs';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// --- MAIN ---
async function uploadCSVtoSupabase(csvFile, tableName, skipRows = 0) {
  const csvPath = path.resolve(csvFile);
  let csvContent = fs.readFileSync(csvPath, 'utf8');
  
  // Skip header rows if specified
  if (skipRows > 0) {
    const lines = csvContent.split('\n');
    csvContent = lines.slice(skipRows).join('\n');
  }
  
  const records = parse(csvContent, { columns: true, skip_empty_lines: true });

  // Transform column names to match Supabase table (lowercase, underscores)
  const transformedRecords = records.map(row => {
    const newRow = {};
    for (const [key, value] of Object.entries(row)) {
      const newKey = key.trim().replace(/\s+/g, '_').replace(/\(|\)/g, '').replace(/\./g, '').toLowerCase();
      newRow[newKey] = value;
    }
    return newRow;
  });

  // Insert in batches of 100
  const batchSize = 100;
  let inserted = 0;
  for (let i = 0; i < transformedRecords.length; i += batchSize) {
    const batch = transformedRecords.slice(i, i + batchSize);
    const { data, error } = await supabase
      .from(tableName)
      .insert(batch);
    
    if (error) {
      console.error(`Insert error at batch ${i / batchSize + 1}:`, error.message);
      console.error('First row of failed batch:', JSON.stringify(batch[0], null, 2));
    } else {
      inserted += batch.length;
    }
  }
  console.log(`Uploaded ${inserted} rows to ${tableName}`);
}

// --- CLI ---
if (require.main === module) {
  const [,, csvFile, tableName, skipRows] = process.argv;
  if (!csvFile || !tableName) {
    console.error('Usage: node upload_via_supabase.cjs <csvFile> <tableName> [skipRows]');
    process.exit(1);
  }
  uploadCSVtoSupabase(csvFile, tableName, parseInt(skipRows) || 0).catch(console.error);
}
