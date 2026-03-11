-- Fix backdated Loan ID and Customer ID to be in chronological order
-- We need to use a temp column approach to avoid unique constraint violations

-- Step 1: Create temporary columns to store new IDs
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS customer_id_new TEXT;
ALTER TABLE loan_applications ADD COLUMN IF NOT EXISTS loan_id_new TEXT;

-- Step 2: Calculate new customer_ids based on created_at order
WITH ordered_contacts AS (
  SELECT id, created_at,
         ROW_NUMBER() OVER (ORDER BY created_at ASC) as seq_num
  FROM contacts
  WHERE customer_id IS NOT NULL
)
UPDATE contacts 
SET customer_id_new = 'CUST-' || to_char(oc.created_at, 'YYYYMM') || '-' || 
                      LPAD(oc.seq_num::TEXT, 5, '0')
FROM ordered_contacts oc
WHERE contacts.id = oc.id;

-- Step 3: Calculate new loan_ids based on created_at order
WITH ordered_loans AS (
  SELECT id, created_at,
         ROW_NUMBER() OVER (ORDER BY created_at ASC) as seq_num
  FROM loan_applications
  WHERE loan_id IS NOT NULL
)
UPDATE loan_applications 
SET loan_id_new = 'LOAN-' || to_char(ol.created_at, 'YYYYMM') || '-' || 
                  LPAD(ol.seq_num::TEXT, 5, '0')
FROM ordered_loans ol
WHERE loan_applications.id = ol.id;

-- Step 4: Clear existing IDs to avoid constraint violations
UPDATE contacts SET customer_id = NULL WHERE customer_id IS NOT NULL;
UPDATE loan_applications SET loan_id = NULL WHERE loan_id IS NOT NULL;

-- Step 5: Copy new IDs to original columns
UPDATE contacts SET customer_id = customer_id_new WHERE customer_id_new IS NOT NULL;
UPDATE loan_applications SET loan_id = loan_id_new WHERE loan_id_new IS NOT NULL;

-- Step 6: Drop temporary columns
ALTER TABLE contacts DROP COLUMN IF EXISTS customer_id_new;
ALTER TABLE loan_applications DROP COLUMN IF EXISTS loan_id_new;

-- Step 7: Reset sequences to continue after the highest number
SELECT setval('customer_id_seq',
  GREATEST(COALESCE((SELECT COUNT(*) FROM contacts WHERE customer_id IS NOT NULL), 0), 1)
);

SELECT setval('loan_id_seq',
  GREATEST(COALESCE((SELECT COUNT(*) FROM loan_applications WHERE loan_id IS NOT NULL), 0), 1)
);