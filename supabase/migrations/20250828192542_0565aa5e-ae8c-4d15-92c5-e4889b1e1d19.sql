-- Step 1: Clean up duplicate data and fix chat message visibility
-- This comprehensive migration fixes the chat visibility issue once and for all

-- First, let's clean up any duplicate General channels for users
WITH duplicate_channels AS (
  SELECT 
    owner_id,
    array_agg(id ORDER BY created_at ASC) as channel_ids,
    COUNT(*) as channel_count
  FROM chat_channels 
  WHERE is_default = true AND name = 'General'
  GROUP BY owner_id
  HAVING COUNT(*) > 1
)
DELETE FROM chat_channels 
WHERE id IN (
  SELECT unnest(channel_ids[2:]) 
  FROM duplicate_channels
);

-- Clean up any duplicate participant entries
DELETE FROM chat_participants a
USING chat_participants b
WHERE a.id > b.id 
  AND a.channel_id = b.channel_id 
  AND a.user_id = b.user_id 
  AND a.sub_user_id = b.sub_user_id 
  AND a.user_type = b.user_type;

-- Ensure all board owners are participants in their own General channels
INSERT INTO chat_participants (channel_id, user_id, user_type)
SELECT cc.id, cc.owner_id, 'admin'
FROM chat_channels cc
WHERE cc.is_default = true 
  AND cc.name = 'General'
  AND NOT EXISTS (
    SELECT 1 FROM chat_participants cp 
    WHERE cp.channel_id = cc.id 
      AND cp.user_id = cc.owner_id 
      AND cp.user_type = 'admin'
  )
ON CONFLICT (channel_id, user_id, user_type) DO NOTHING;

-- Ensure all sub-users are participants in their board owner's General channel
INSERT INTO chat_participants (channel_id, sub_user_id, user_type)
SELECT cc.id, su.id, 'sub_user'
FROM chat_channels cc
JOIN sub_users su ON su.board_owner_id = cc.owner_id
WHERE cc.is_default = true 
  AND cc.name = 'General'
  AND NOT EXISTS (
    SELECT 1 FROM chat_participants cp 
    WHERE cp.channel_id = cc.id 
      AND cp.sub_user_id = su.id 
      AND cp.user_type = 'sub_user'
  )
ON CONFLICT (channel_id, sub_user_id, user_type) DO NOTHING;

-- Drop existing problematic RLS policies on chat_messages
DROP POLICY IF EXISTS "Enhanced participants can send messages" ON public.chat_messages;
DROP POLICY IF EXISTS "chat_messages_service_ins" ON public.chat_messages;
DROP POLICY IF EXISTS "read:anon_public_board" ON public.chat_messages;
DROP POLICY IF EXISTS "read:owner_and_participants" ON public.chat_messages;

-- Create comprehensive, optimized RLS policies for chat_messages
-- Policy 1: Dashboard owners can see ALL messages in channels they own
CREATE POLICY "dashboard_owners_see_all_messages"
  ON public.chat_messages
  FOR SELECT
  TO authenticated
  USING (
    -- Owner of the channel can see all messages
    owner_id = auth.uid()
  );

-- Policy 2: Authenticated participants can see messages in their channels
CREATE POLICY "participants_see_channel_messages"
  ON public.chat_messages
  FOR SELECT
  TO authenticated
  USING (
    -- User is explicitly a participant in this channel
    EXISTS (
      SELECT 1
      FROM public.chat_participants cp
      WHERE cp.channel_id = chat_messages.channel_id
        AND (
          cp.user_id = auth.uid() OR
          cp.sub_user_id IN (
            SELECT su.id
            FROM public.sub_users su
            WHERE su.board_owner_id = auth.uid()
          )
        )
    )
  );

-- Policy 3: Anonymous users can see messages in active public boards
CREATE POLICY "public_board_message_access"
  ON public.chat_messages
  FOR SELECT
  TO anon
  USING (
    EXISTS (
      SELECT 1
      FROM public.chat_channels ch
      JOIN public.public_boards pb ON pb.user_id = ch.owner_id
      WHERE ch.id = chat_messages.channel_id
        AND pb.is_active = TRUE
    )
  );

-- Policy 4: Authenticated users can send messages to channels they participate in
CREATE POLICY "authenticated_users_can_send"
  ON public.chat_messages
  FOR INSERT
  TO authenticated
  WITH CHECK (
    -- Admin users can send to channels they own
    (sender_type = 'admin' AND sender_user_id = auth.uid() AND owner_id = auth.uid())
    OR
    -- Sub-users can send to channels where they are participants
    (sender_type = 'sub_user' AND EXISTS (
      SELECT 1
      FROM public.chat_participants cp
      WHERE cp.channel_id = chat_messages.channel_id
        AND cp.sub_user_id = chat_messages.sender_sub_user_id
        AND cp.user_type = 'sub_user'
    ))
  );

-- Policy 5: Service role can do everything (for edge functions)
CREATE POLICY "service_role_full_access"
  ON public.chat_messages
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Ensure realtime is enabled for chat_messages
ALTER PUBLICATION supabase_realtime ADD TABLE IF NOT EXISTS public.chat_messages;

-- Add helpful indexes for performance
CREATE INDEX IF NOT EXISTS idx_chat_messages_channel_created 
  ON public.chat_messages (channel_id, created_at);

CREATE INDEX IF NOT EXISTS idx_chat_messages_owner_channel 
  ON public.chat_messages (owner_id, channel_id);

CREATE INDEX IF NOT EXISTS idx_chat_participants_channel_user 
  ON public.chat_participants (channel_id, user_id) 
  WHERE user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_chat_participants_channel_subuser 
  ON public.chat_participants (channel_id, sub_user_id) 
  WHERE sub_user_id IS NOT NULL;

-- Update the existing DM creation function to use chat_participants properly
CREATE OR REPLACE FUNCTION public.start_authenticated_dm(
  p_owner_id uuid, 
  p_other_id uuid, 
  p_other_type text
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_existing uuid;
  v_new uuid;
BEGIN
  -- Look for existing DM via chat_participants
  SELECT ch.id
  INTO v_existing
  FROM chat_channels ch
  JOIN chat_participants cp_me
    ON cp_me.channel_id = ch.id
   AND cp_me.user_id = p_owner_id
   AND cp_me.user_type = 'admin'
  JOIN chat_participants cp_other
    ON cp_other.channel_id = ch.id
   AND (
        (p_other_type = 'admin'    AND cp_other.user_id    = p_other_id) OR
        (p_other_type = 'sub_user' AND cp_other.sub_user_id = p_other_id)
       )
  WHERE ch.owner_id = p_owner_id
    AND ch.is_dm = TRUE
  LIMIT 1;

  IF v_existing IS NOT NULL THEN
    RETURN v_existing;
  END IF;

  -- Create new DM channel
  INSERT INTO chat_channels (owner_id, is_dm, name, updated_at)
  VALUES (
    p_owner_id,
    TRUE,
    'Direct Message',
    NOW()
  )
  RETURNING id INTO v_new;

  -- Add participants
  INSERT INTO chat_participants (channel_id, user_id, user_type)
  VALUES (v_new, p_owner_id, 'admin')
  ON CONFLICT DO NOTHING;

  IF p_other_type = 'admin' THEN
    INSERT INTO chat_participants (channel_id, user_id, user_type)
    VALUES (v_new, p_other_id, 'admin')
    ON CONFLICT DO NOTHING;
  ELSE
    INSERT INTO chat_participants (channel_id, sub_user_id, user_type)
    VALUES (v_new, p_other_id, 'sub_user')
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN v_new;
END;
$$;