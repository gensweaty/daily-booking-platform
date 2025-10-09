-- Backfill legacy standalone customers to ensure they appear in statistics
-- Mark all standalone customers (no event or create_event=false) with type='customer'
-- This is safe: only touches NULL type fields for valid standalone customers
UPDATE customers
SET type = 'customer'
WHERE type IS NULL
  AND (event_id IS NULL OR create_event IS FALSE)
  AND deleted_at IS NULL;