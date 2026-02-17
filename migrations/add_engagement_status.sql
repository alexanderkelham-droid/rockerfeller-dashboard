-- Migration: Add engagement_status column to transactions table
-- This field tracks the CATA engagement status for coal retirement projects
-- Run this in your Supabase SQL Editor

-- Add the engagement_status column (if it doesn't exist)
ALTER TABLE transactions 
ADD COLUMN IF NOT EXISTS engagement_status VARCHAR(50) DEFAULT 'no_engagement';

-- Add a comment for documentation
COMMENT ON COLUMN transactions.engagement_status IS 
  'CATA engagement status: no_engagement, concept_proposal, in_delivery, completed';

-- Note: The following columns already exist in the database:
-- - planned_retirement_year (used for initial/planned retirement year)
-- - actual_retirement_year (used for target retirement year)
-- - deal_timeframe (used for target close date)
-- - deal_currency (USD default)
-- - plants (JSONB array for multiple plants)
