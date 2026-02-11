-- Run this SQL in Supabase SQL Editor

-- Create transactions table (if not already created)
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

-- Create transaction_activities table for timeline
CREATE TABLE IF NOT EXISTS transaction_activities (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  transaction_id UUID REFERENCES transactions(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by TEXT,
  activity_type TEXT NOT NULL, -- 'note', 'email', 'meeting', 'call', 'task', 'stage_change', 'status_change'
  title TEXT,
  description TEXT,
  metadata JSONB, -- Store additional data like email recipients, meeting attendees, etc.
  is_pinned BOOLEAN DEFAULT FALSE
);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_transaction_activities_transaction ON transaction_activities(transaction_id);
CREATE INDEX IF NOT EXISTS idx_transaction_activities_created ON transaction_activities(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_stage ON transactions(transaction_stage);
CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(transaction_status);
