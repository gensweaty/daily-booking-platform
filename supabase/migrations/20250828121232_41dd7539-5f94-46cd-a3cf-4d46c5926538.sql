-- Ensure ALL sub-users are added to their board owner's General chat channel
-- This fixes any missing participant entries that prevent sub-users from seeing chat

-- Add missing sub-users to their General channels
INSERT INTO chat_participants (channel_id, sub_user_id, user_type)
SELECT cc.id as channel_id, su.id as sub_user_id, 'sub_user' as user_type
FROM chat_channels cc
CROSS JOIN sub_users su
WHERE cc.owner_id = su.board_owner_id
  AND cc.is_default = true 
  AND cc.name = 'General'
  AND NOT EXISTS (
    SELECT 1 FROM chat_participants cp 
    WHERE cp.channel_id = cc.id 
      AND cp.sub_user_id = su.id 
      AND cp.user_type = 'sub_user'
  );

-- Also ensure all admins are in their General channels 
INSERT INTO chat_participants (channel_id, user_id, user_type)
SELECT cc.id as channel_id, cc.owner_id as user_id, 'admin' as user_type
FROM chat_channels cc
WHERE cc.is_default = true 
  AND cc.name = 'General'
  AND NOT EXISTS (
    SELECT 1 FROM chat_participants cp 
    WHERE cp.channel_id = cc.id 
      AND cp.user_id = cc.owner_id 
      AND cp.user_type = 'admin'
  );