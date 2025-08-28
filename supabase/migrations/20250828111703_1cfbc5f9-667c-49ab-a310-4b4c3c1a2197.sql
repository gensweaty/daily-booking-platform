-- Clean up duplicate General channels and fix participants
-- First, let's identify the General channel that has participants
DO $$
DECLARE
  v_owner_id UUID := '69af81ef-fb31-49cb-8e73-9fd29c536250';
  v_active_general_id UUID;
  v_participant_count INTEGER;
  v_channel RECORD;
BEGIN
  -- Find the General channel that has participants
  SELECT cc.id INTO v_active_general_id
  FROM chat_channels cc
  WHERE cc.owner_id = v_owner_id 
    AND cc.is_default = true 
    AND cc.name = 'General'
    AND EXISTS (
      SELECT 1 FROM chat_participants cp 
      WHERE cp.channel_id = cc.id
    )
  ORDER BY cc.created_at ASC
  LIMIT 1;

  IF v_active_general_id IS NOT NULL THEN
    RAISE NOTICE 'Found active General channel with participants: %', v_active_general_id;
    
    -- Delete all other duplicate General channels (those without participants)
    DELETE FROM chat_channels 
    WHERE owner_id = v_owner_id 
      AND is_default = true 
      AND name = 'General'
      AND id != v_active_general_id;
      
    RAISE NOTICE 'Cleaned up duplicate General channels';
    
    -- Verify we have all expected participants
    SELECT COUNT(*) INTO v_participant_count
    FROM chat_participants
    WHERE channel_id = v_active_general_id;
    
    RAISE NOTICE 'Active General channel has % participants', v_participant_count;
    
  ELSE
    RAISE NOTICE 'No General channel with participants found. Creating new one with proper setup.';
    
    -- Delete all empty General channels
    DELETE FROM chat_channels 
    WHERE owner_id = v_owner_id 
      AND is_default = true 
      AND name = 'General';
    
    -- Create new General channel
    INSERT INTO chat_channels (owner_id, name, emoji, is_default)
    VALUES (v_owner_id, 'General', '💬', true)
    RETURNING id INTO v_active_general_id;
    
    -- Add owner to the channel
    INSERT INTO chat_participants (channel_id, user_id, user_type)
    VALUES (v_active_general_id, v_owner_id, 'admin')
    ON CONFLICT (channel_id, user_id, user_type) DO NOTHING;
    
    -- Add all sub-users to the channel
    FOR v_channel IN 
      SELECT id FROM sub_users WHERE board_owner_id = v_owner_id
    LOOP
      INSERT INTO chat_participants (channel_id, sub_user_id, user_type)
      VALUES (v_active_general_id, v_channel.id, 'sub_user')
      ON CONFLICT (channel_id, sub_user_id, user_type) DO NOTHING;
    END LOOP;
    
    RAISE NOTICE 'Created new General channel with all participants: %', v_active_general_id;
  END IF;
END $$;