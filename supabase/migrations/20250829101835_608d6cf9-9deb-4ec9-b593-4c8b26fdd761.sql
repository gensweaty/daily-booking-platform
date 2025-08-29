-- Add unique constraint to prevent duplicate participants
ALTER TABLE chat_participants ADD CONSTRAINT unique_channel_participant 
UNIQUE (channel_id, user_id, sub_user_id);

-- Create function to consolidate duplicate DM channels and preserve all messages
CREATE OR REPLACE FUNCTION public.consolidate_duplicate_dm_channels()
RETURNS TABLE(
  consolidated_channels_count integer,
  migrated_messages_count integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  duplicate_record RECORD;
  canonical_channel_id uuid;
  v_consolidated_count integer := 0;
  v_migrated_count integer := 0;
  temp_migrated integer;
BEGIN
  -- Find all duplicate DM channel groups (same owner + same 2 participants)
  FOR duplicate_record IN
    WITH dm_participant_pairs AS (
      SELECT 
        ch.id as channel_id,
        ch.owner_id,
        ch.updated_at,
        ARRAY_AGG(
          CASE 
            WHEN cp.user_type = 'admin' THEN 'A:' || cp.user_id::text
            ELSE 'S:' || cp.sub_user_id::text 
          END 
          ORDER BY 
            CASE 
              WHEN cp.user_type = 'admin' THEN 'A:' || cp.user_id::text
              ELSE 'S:' || cp.sub_user_id::text 
            END
        ) as participant_keys
      FROM chat_channels ch
      JOIN chat_participants cp ON ch.id = cp.channel_id
      WHERE ch.is_dm = true
      GROUP BY ch.id, ch.owner_id, ch.updated_at
      HAVING COUNT(*) = 2  -- Only consider channels with exactly 2 participants
    ),
    duplicate_groups AS (
      SELECT 
        owner_id,
        participant_keys,
        ARRAY_AGG(channel_id ORDER BY updated_at DESC) as channel_ids,
        COUNT(*) as duplicate_count
      FROM dm_participant_pairs
      GROUP BY owner_id, participant_keys
      HAVING COUNT(*) > 1  -- Only groups with duplicates
    )
    SELECT * FROM duplicate_groups
  LOOP
    -- Use the most recently updated channel as canonical
    canonical_channel_id := duplicate_record.channel_ids[1];
    
    -- Migrate messages from all other channels to canonical channel
    FOR i IN 2..array_length(duplicate_record.channel_ids, 1) LOOP
      -- Move messages from duplicate channel to canonical channel
      UPDATE chat_messages 
      SET channel_id = canonical_channel_id
      WHERE channel_id = duplicate_record.channel_ids[i];
      
      GET DIAGNOSTICS temp_migrated = ROW_COUNT;
      v_migrated_count := v_migrated_count + temp_migrated;
      
      -- Delete participants from duplicate channel
      DELETE FROM chat_participants 
      WHERE channel_id = duplicate_record.channel_ids[i];
      
      -- Delete the duplicate channel
      DELETE FROM chat_channels 
      WHERE id = duplicate_record.channel_ids[i];
      
      v_consolidated_count := v_consolidated_count + 1;
      
      RAISE NOTICE 'Consolidated duplicate channel % into canonical %, migrated % messages', 
                   duplicate_record.channel_ids[i], canonical_channel_id, temp_migrated;
    END LOOP;
    
    -- Update the canonical channel's updated_at to reflect latest activity
    UPDATE chat_channels 
    SET updated_at = NOW()
    WHERE id = canonical_channel_id;
  END LOOP;
  
  RETURN QUERY SELECT v_consolidated_count, v_migrated_count;
END;
$$;

-- Create function to find or create canonical DM channel (enhanced version)
CREATE OR REPLACE FUNCTION public.get_or_create_canonical_dm(
  p_board_owner_id uuid,
  p_a_type text,
  p_a_id uuid,
  p_b_type text,
  p_b_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_canonical_channel_id uuid;
  v_key_a text;
  v_key_b text;
  v_ordered_keys text[];
BEGIN
  -- Create canonical participant keys
  v_key_a := CASE WHEN p_a_type = 'admin' THEN 'A:' || p_a_id::text ELSE 'S:' || p_a_id::text END;
  v_key_b := CASE WHEN p_b_type = 'admin' THEN 'A:' || p_b_id::text ELSE 'S:' || p_b_id::text END;
  
  -- Order keys consistently
  IF v_key_a <= v_key_b THEN
    v_ordered_keys := ARRAY[v_key_a, v_key_b];
  ELSE
    v_ordered_keys := ARRAY[v_key_b, v_key_a];
  END IF;
  
  -- Look for existing canonical DM channel with these exact participants
  WITH dm_channels_with_participants AS (
    SELECT 
      ch.id,
      ch.updated_at,
      ARRAY_AGG(
        CASE 
          WHEN cp.user_type = 'admin' THEN 'A:' || cp.user_id::text
          ELSE 'S:' || cp.sub_user_id::text 
        END 
        ORDER BY 
          CASE 
            WHEN cp.user_type = 'admin' THEN 'A:' || cp.user_id::text
            ELSE 'S:' || cp.sub_user_id::text 
          END
      ) as participant_keys
    FROM chat_channels ch
    JOIN chat_participants cp ON ch.id = cp.channel_id
    WHERE ch.owner_id = p_board_owner_id 
      AND ch.is_dm = true
    GROUP BY ch.id, ch.updated_at
    HAVING COUNT(*) = 2
  )
  SELECT id INTO v_canonical_channel_id
  FROM dm_channels_with_participants
  WHERE participant_keys = v_ordered_keys
  ORDER BY updated_at DESC
  LIMIT 1;
  
  -- If found, return it
  IF v_canonical_channel_id IS NOT NULL THEN
    RAISE NOTICE 'Found existing canonical DM channel: %', v_canonical_channel_id;
    RETURN v_canonical_channel_id;
  END IF;
  
  -- If not found, use the existing ensure_dm_channel function
  RAISE NOTICE 'Creating new canonical DM channel for participants: % and %', v_key_a, v_key_b;
  SELECT public.ensure_dm_channel(p_board_owner_id, p_a_type, p_a_id, p_b_type, p_b_id)
  INTO v_canonical_channel_id;
  
  RETURN v_canonical_channel_id;
END;
$$;