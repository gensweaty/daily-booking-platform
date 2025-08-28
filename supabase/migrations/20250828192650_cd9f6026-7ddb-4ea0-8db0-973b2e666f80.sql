-- Step 1: Fix chat message visibility with corrected constraints
-- Clean up duplicate data and create optimized RLS policies

-- Clean up any duplicate participant entries
DELETE FROM chat_participants a
USING chat_participants b
WHERE a.id > b.id 
  AND a.channel_id = b.channel_id 
  AND COALESCE(a.user_id, '00000000-0000-0000-0000-000000000000') = COALESCE(b.user_id, '00000000-0000-0000-0000-000000000000')
  AND COALESCE(a.sub_user_id, '00000000-0000-0000-0000-000000000000') = COALESCE(b.sub_user_id, '00000000-0000-0000-0000-000000000000')
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
  );

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
  );

-- Drop existing problematic RLS policies on chat_messages
DROP POLICY IF EXISTS "Enhanced participants can send messages" ON public.chat_messages;
DROP POLICY IF EXISTS "chat_messages_service_ins" ON public.chat_messages;
DROP POLICY IF EXISTS "read:anon_public_board" ON public.chat_messages;
DROP POLICY IF EXISTS "read:owner_and_participants" ON public.chat_messages;