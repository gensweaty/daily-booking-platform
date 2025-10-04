-- Ensure all boards have proper General channels with participants for chat functionality

-- Create a function to ensure default General channel exists with participants
CREATE OR REPLACE FUNCTION ensure_general_channel_with_participants()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  admin_record RECORD;
  channel_id UUID;
  sub_user_record RECORD;
BEGIN
  -- For each user with a profile (board owners)
  FOR admin_record IN 
    SELECT id, username FROM profiles
  LOOP
    -- Check if they have a default General channel
    SELECT id INTO channel_id
    FROM chat_channels 
    WHERE owner_id = admin_record.id 
      AND is_default = true 
      AND name = 'General'
    LIMIT 1;
    
    -- If no default General channel exists, create one
    IF channel_id IS NULL THEN
      INSERT INTO chat_channels (owner_id, name, emoji, is_default)
      VALUES (admin_record.id, 'General', '💬', true)
      RETURNING id INTO channel_id;
      
      RAISE NOTICE 'Created General channel for user %', admin_record.username;
    END IF;
    
    -- Ensure admin is participant in their General channel
    INSERT INTO chat_participants (channel_id, user_id, user_type)
    VALUES (channel_id, admin_record.id, 'admin')
    ON CONFLICT (channel_id, user_id, user_type) DO NOTHING;
    
    -- Add all sub-users for this board owner to the General channel
    FOR sub_user_record IN 
      SELECT id FROM sub_users WHERE board_owner_id = admin_record.id
    LOOP
      INSERT INTO chat_participants (channel_id, sub_user_id, user_type)
      VALUES (channel_id, sub_user_record.id, 'sub_user')
      ON CONFLICT (channel_id, sub_user_id, user_type) DO NOTHING;
      
      RAISE NOTICE 'Added sub-user % to General channel', sub_user_record.id;
    END LOOP;
    
  END LOOP;
END;
$$;

-- Execute the function to fix existing data
SELECT ensure_general_channel_with_participants();

-- Drop the temporary function
DROP FUNCTION ensure_general_channel_with_participants();