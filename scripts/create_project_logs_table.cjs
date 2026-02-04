// Script to create project_logs table for tracking project updates
const { Client } = require('pg');
const dns = require('dns');
dns.setDefaultResultOrder('ipv4first');

const PG_CONNECTION_STRING = 'postgresql://postgres.nohouhstbuysnimquvtx:BlackfriarsPier25@54.247.26.119:5432/postgres';

async function createProjectLogsTable() {
  const client = new Client({ 
    connectionString: PG_CONNECTION_STRING, 
    ssl: { rejectUnauthorized: false } 
  });
  
  await client.connect();
  
  // Create project_logs table
  const createTableSQL = `
    CREATE TABLE IF NOT EXISTS project_logs (
      id SERIAL PRIMARY KEY,
      project_id INTEGER NOT NULL,
      plant_name TEXT,
      field_changed TEXT,
      old_value TEXT,
      new_value TEXT,
      notes TEXT,
      updated_by TEXT DEFAULT 'system',
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
    
    -- Create index for faster lookups by project_id
    CREATE INDEX IF NOT EXISTS idx_project_logs_project_id ON project_logs(project_id);
    
    -- Create index for timestamp-based queries
    CREATE INDEX IF NOT EXISTS idx_project_logs_created_at ON project_logs(created_at DESC);
  `;
  
  try {
    await client.query(createTableSQL);
    console.log('✅ project_logs table created successfully');
    
    // Verify the table
    const result = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'project_logs' 
      ORDER BY ordinal_position
    `);
    
    console.log('\nTable structure:');
    result.rows.forEach(row => {
      console.log(`  - ${row.column_name}: ${row.data_type}`);
    });
    
  } catch (err) {
    console.error('Error creating table:', err.message);
  }
  
  await client.end();
}

createProjectLogsTable().catch(console.error);
