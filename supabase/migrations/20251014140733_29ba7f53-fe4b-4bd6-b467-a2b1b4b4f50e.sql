-- Clean up old shared AI channels and ensure proper per-user isolation
-- The old system created shared AI channels (is_dm=false) with multiple participants
-- The new system creates per-user AI channels (is_dm=true) with single participants

-- Mark old shared AI channels as deleted to prevent confusion
UPDATE chat_channels
SET is_deleted = true,
    updated_at = now()
WHERE is_ai = true
  AND is_dm = false  -- Old shared channels
  AND is_deleted = false;

-- Log the cleanup
DO $$
DECLARE
  v_deleted_count integer;
BEGIN
  SELECT COUNT(*) INTO v_deleted_count
  FROM chat_channels
  WHERE is_ai = true AND is_dm = false AND is_deleted = true;
  
  RAISE NOTICE '✅ Marked % old shared AI channels as deleted', v_deleted_count;
END $$;