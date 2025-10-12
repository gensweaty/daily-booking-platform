-- Phase 1: AI Channel Database Schema

-- Add is_ai column to chat_channels
ALTER TABLE chat_channels 
ADD COLUMN IF NOT EXISTS is_ai BOOLEAN DEFAULT false;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_chat_channels_is_ai 
ON chat_channels(owner_id, is_ai) 
WHERE is_ai = true;

-- Create function to ensure AI channel exists for a workspace
CREATE OR REPLACE FUNCTION ensure_ai_channel(p_owner_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_channel_id uuid;
BEGIN
  -- Check if AI channel already exists
  SELECT id INTO v_channel_id
  FROM chat_channels
  WHERE owner_id = p_owner_id 
    AND is_ai = true 
    AND is_deleted = false
  LIMIT 1;

  -- Create if doesn't exist
  IF v_channel_id IS NULL THEN
    INSERT INTO chat_channels (
      owner_id, 
      name, 
      emoji,
      is_ai, 
      is_custom, 
      is_private,
      is_default
    ) VALUES (
      p_owner_id,
      'Smartbookly AI',
      '🤖',
      true,
      false,
      true,  -- Private to workspace
      false
    )
    RETURNING id INTO v_channel_id;

    -- Add owner as participant
    INSERT INTO chat_participants (
      channel_id, 
      user_id, 
      user_type
    ) VALUES (
      v_channel_id, 
      p_owner_id, 
      'admin'
    )
    ON CONFLICT ON CONSTRAINT chat_participants_unique_identity DO NOTHING;

    -- Add all sub-users as participants
    INSERT INTO chat_participants (
      channel_id, 
      sub_user_id, 
      user_type
    )
    SELECT 
      v_channel_id,
      id,
      'sub_user'
    FROM sub_users
    WHERE board_owner_id = p_owner_id
    ON CONFLICT ON CONSTRAINT chat_participants_unique_identity DO NOTHING;
  END IF;

  RETURN v_channel_id;
END;
$$;