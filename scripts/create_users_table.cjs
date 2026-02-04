const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://nohouhstbuysnimquvtx.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5vaG91aHN0YnV5c25pbXF1dnR4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTc3MDAxOSwiZXhwIjoyMDg1MzQ2MDE5fQ.S8EBKUQrJy8aOhkHR3CKTYReKRjoEmB03euLtsdnpIs';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function createUsersTable() {
  console.log('Creating users table...');

  // Create the users table using raw SQL
  const { error: createError } = await supabase.rpc('exec_sql', {
    sql: `
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        name VARCHAR(255) NOT NULL,
        initials VARCHAR(10),
        role VARCHAR(50) DEFAULT 'user',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        last_login TIMESTAMP WITH TIME ZONE
      );
    `
  });

  if (createError) {
    // Table might already exist or we need to create it differently
    console.log('Note: Could not create via RPC, trying direct insert...');
  }

  // Insert default users
  const defaultUsers = [
    { email: 'admin@cata.org', password: 'admin123', name: 'Admin User', initials: 'AU', role: 'admin' },
    { email: 'alex@carbontrust.com', password: 'password123', name: 'Alex Kelham', initials: 'AK', role: 'user' },
    { email: 'john@ADB.com', password: 'password123', name: 'John Doe', initials: 'JD', role: 'user' },
  ];

  console.log('Inserting default users...');

  for (const user of defaultUsers) {
    const { data, error } = await supabase
      .from('users')
      .upsert(user, { onConflict: 'email' })
      .select();

    if (error) {
      console.error(`Error inserting ${user.email}:`, error.message);
    } else {
      console.log(`✓ User ${user.email} added/updated`);
    }
  }

  // Verify users
  const { data: allUsers, error: fetchError } = await supabase
    .from('users')
    .select('email, name, role');

  if (fetchError) {
    console.error('Error fetching users:', fetchError.message);
    console.log('\n⚠️  The users table may not exist yet.');
    console.log('Please create it manually in Supabase SQL Editor with this query:\n');
    console.log(`
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  initials VARCHAR(10),
  role VARCHAR(50) DEFAULT 'user',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_login TIMESTAMP WITH TIME ZONE
);

-- Insert default users
INSERT INTO users (email, password, name, initials, role) VALUES
  ('admin@cata.org', 'admin123', 'Admin User', 'AU', 'admin'),
  ('alex@carbontrust.com', 'password123', 'Alex Kelham', 'AK', 'user'),
  ('john@ADB.com', 'password123', 'John Doe', 'JD', 'user')
ON CONFLICT (email) DO NOTHING;
    `);
  } else {
    console.log('\n✓ Users table ready with', allUsers.length, 'users:');
    console.table(allUsers);
  }
}

createUsersTable();
