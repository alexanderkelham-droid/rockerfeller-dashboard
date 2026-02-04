// Check table columns
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
  
  const tables = ['impact_results_v0', 'impact_results_v1_annual', 'project_specific_data', 'global_coal_plants'];
  
  for (const table of tables) {
    const result = await c.query(
      `SELECT column_name FROM information_schema.columns WHERE table_name = $1 ORDER BY ordinal_position`,
      [table]
    );
    console.log(`\n${table} columns:`);
    if (result.rows.length === 0) {
      console.log('  (no columns found - table may not exist)');
    } else {
      result.rows.forEach(row => console.log(`  - ${row.column_name}`));
    }
    
    // Count rows
    try {
      const count = await c.query(`SELECT COUNT(*) FROM ${table}`);
      console.log(`  Row count: ${count.rows[0].count}`);
    } catch (err) {
      console.log(`  (error counting rows: ${err.message})`);
    }
  }
  
  await c.end();
}

main().catch(console.error);
