-- Migration: Add engagement_status column to transactions table
-- This field tracks the CATA engagement status for coal retirement projects

-- Add the engagement_status column
ALTER TABLE transactions 
ADD COLUMN IF NOT EXISTS engagement_status VARCHAR(50) DEFAULT 'no_engagement';

-- Add a comment for documentation
COMMENT ON COLUMN transactions.engagement_status IS 
  'CATA engagement status: no_engagement, concept_proposal, in_delivery, completed';

-- Update existing records to have a default engagement status based on transaction_stage
UPDATE transactions 
SET engagement_status = 
  CASE 
    WHEN transaction_stage IN ('in_delivery', 'deal_structuring', 'closing') THEN 'in_delivery'
    WHEN transaction_stage = 'transaction_complete' THEN 'completed'
    WHEN transaction_stage IN ('ideation', 'screening', 'pre_feasibility', 'full_feasibility', 'origination', 'scoping', 'concept_note') THEN 'concept_proposal'
    ELSE 'no_engagement'
  END
WHERE engagement_status IS NULL OR engagement_status = '';
