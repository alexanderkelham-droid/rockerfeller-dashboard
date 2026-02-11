const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://nohouhstbuysnimquvtx.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5vaG91aHN0YnV5c25pbXF1dnR4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTc3MDAxOSwiZXhwIjoyMDg1MzQ2MDE5fQ.S8EBKUQrJy8aOhkHR3CKTYReKRjoEmB03euLtsdnpIs'
);

async function createTransactionsTable() {
  console.log('Creating transactions table...');
  
  const { error } = await supabase.rpc('exec_sql', {
    sql: `
      -- Create transactions table for CRM functionality
      CREATE TABLE IF NOT EXISTS transactions (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        created_by TEXT,
        
        -- Coal Plant Characteristics
        plant_name TEXT NOT NULL,
        unit_name TEXT,
        capacity_mw NUMERIC,
        country TEXT,
        location_coordinates TEXT,
        owner TEXT,
        operational_status TEXT, -- operating, retired, cancelled
        start_year INTEGER,
        original_end_of_life_year INTEGER,
        lifetime_sox_tonnes NUMERIC,
        lifetime_nox_tonnes NUMERIC,
        lifetime_co2_tonnes NUMERIC,
        grid_connection_type TEXT,
        
        -- CATA Project Characteristics
        project_value NUMERIC,
        project_stage TEXT, -- Concept/proposal development, In delivery, Completed, No engagement
        key_contacts TEXT,
        project_name TEXT,
        planned_retirement_year INTEGER,
        actual_retirement_year INTEGER,
        
        -- Transaction Data
        transition_type TEXT,
        transaction_stage TEXT, -- Origination, Scoping, Concept Note/Proposal, Agreement Signed, In Delivery, Transaction Complete, On Hold, Cancelled
        transaction_status TEXT, -- Red, Amber, Green (RAG)
        transaction_confidence_rating NUMERIC, -- percentage 0-100
        transaction_next_steps TEXT, -- JSON array of next steps
        deal_timeframe DATE, -- expected close date
        estimated_deal_size NUMERIC, -- in USD
        financial_mechanism TEXT,
        lenders_funders TEXT,
        planned_post_retirement_status TEXT,
        
        -- Key Features
        actors_in_contact TEXT,
        funded_delivery_partners TEXT[], -- Array: CSV, RMI, CT, CCSF, World Bank, ADB, IADB
        related_work_link TEXT,
        assumptions_confidence_rating NUMERIC, -- percentage 0-100
        
        -- Additional tracking
        notes TEXT,
        last_activity_date DATE,
        assigned_to TEXT
      );

      -- Create index for faster queries
      CREATE INDEX IF NOT EXISTS idx_transactions_stage ON transactions(transaction_stage);
      CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(transaction_status);
      CREATE INDEX IF NOT EXISTS idx_transactions_plant ON transactions(plant_name);
      CREATE INDEX IF NOT EXISTS idx_transactions_country ON transactions(country);

      -- Create updated_at trigger
      CREATE OR REPLACE FUNCTION update_transactions_updated_at()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = NOW();
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;

      DROP TRIGGER IF EXISTS transactions_updated_at ON transactions;
      CREATE TRIGGER transactions_updated_at
        BEFORE UPDATE ON transactions
        FOR EACH ROW
        EXECUTE FUNCTION update_transactions_updated_at();
    `
  });

  if (error) {
    // If exec_sql doesn't exist, try direct SQL via REST API
    console.log('exec_sql not available, trying direct approach...');
    
    // Create the table using Supabase's SQL editor approach
    const createTableSQL = `
      CREATE TABLE IF NOT EXISTS transactions (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        created_by TEXT,
        plant_name TEXT NOT NULL,
        unit_name TEXT,
        capacity_mw NUMERIC,
        country TEXT,
        location_coordinates TEXT,
        owner TEXT,
        operational_status TEXT,
        start_year INTEGER,
        original_end_of_life_year INTEGER,
        lifetime_sox_tonnes NUMERIC,
        lifetime_nox_tonnes NUMERIC,
        lifetime_co2_tonnes NUMERIC,
        grid_connection_type TEXT,
        project_value NUMERIC,
        project_stage TEXT,
        key_contacts TEXT,
        project_name TEXT,
        planned_retirement_year INTEGER,
        actual_retirement_year INTEGER,
        transition_type TEXT,
        transaction_stage TEXT,
        transaction_status TEXT,
        transaction_confidence_rating NUMERIC,
        transaction_next_steps TEXT,
        deal_timeframe DATE,
        estimated_deal_size NUMERIC,
        financial_mechanism TEXT,
        lenders_funders TEXT,
        planned_post_retirement_status TEXT,
        actors_in_contact TEXT,
        funded_delivery_partners TEXT[],
        related_work_link TEXT,
        assumptions_confidence_rating NUMERIC,
        notes TEXT,
        last_activity_date DATE,
        assigned_to TEXT
      );
    `;
    
    console.log('\n⚠️  Please run this SQL in the Supabase SQL Editor:');
    console.log('================================================');
    console.log(createTableSQL);
    console.log('================================================\n');
    
    // Try to check if table already exists
    const { data, error: checkError } = await supabase
      .from('transactions')
      .select('id')
      .limit(1);
    
    if (!checkError) {
      console.log('✅ transactions table already exists!');
    } else if (checkError.message.includes('does not exist')) {
      console.log('❌ Table does not exist. Please create it using the SQL above in Supabase dashboard.');
    } else {
      console.log('Error checking table:', checkError.message);
    }
  } else {
    console.log('✅ Transactions table created successfully!');
  }
}

createTransactionsTable();
