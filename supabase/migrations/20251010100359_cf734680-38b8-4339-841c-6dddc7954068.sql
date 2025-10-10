-- Add paid_at column to customers table
ALTER TABLE customers ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;

-- Backfill: if it's paid and has a positive amount, use last_edited_at or created_at
UPDATE customers
SET paid_at = COALESCE(paid_at, last_edited_at, created_at)
WHERE paid_at IS NULL
  AND deleted_at IS NULL
  AND (payment_status ILIKE '%fully%' OR payment_status ILIKE '%partly%' OR payment_status = 'fully_paid' OR payment_status = 'partly_paid')
  AND COALESCE((payment_amount)::numeric, 0) > 0;

-- Create index for efficient queries
CREATE INDEX IF NOT EXISTS customers_paid_at_idx ON customers (user_id, paid_at) WHERE deleted_at IS NULL;