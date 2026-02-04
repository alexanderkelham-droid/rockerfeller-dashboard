// Alter tables to fix column name mismatches
const { Client } = require('pg');
const dns = require('dns');
dns.setDefaultResultOrder('ipv4first');

const PG_CONNECTION_STRING = 'postgresql://postgres.nohouhstbuysnimquvtx:BlackfriarsPier25@54.247.26.119:5432/postgres';

async function main() {
  const c = new Client({ 
    connectionString: PG_CONNECTION_STRING, 
    ssl: { rejectUnauthorized: false } 
  });
  await c.connect();
  
  const alterStatements = [
    // project_specific_data fixes
    `ALTER TABLE project_specific_data RENAME COLUMN lenders_funders_involved TO lender_s_funder_s_involved`,
  ];
  
  for (const sql of alterStatements) {
    try {
      await c.query(sql);
      console.log('Success:', sql);
    } catch (err) {
      console.log('Error:', err.message, 'SQL:', sql);
    }
  }
  
  await c.end();
}

main().catch(console.error);
