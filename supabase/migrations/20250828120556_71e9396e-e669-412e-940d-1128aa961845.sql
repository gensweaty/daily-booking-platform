-- Simple migration to ensure General channels exist and have participants

-- Insert missing General channels for existing users
INSERT INTO chat_channels (owner_id, name, emoji, is_default)
SELECT p.id, 'General', '💬', true
FROM profiles p
WHERE NOT EXISTS (
  SELECT 1 FROM chat_channels cc 
  WHERE cc.owner_id = p.id 
    AND cc.is_default = true 
    AND cc.name = 'General'
);

-- Add admins to their General channels (if not already there)
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

-- Add sub-users to their board owner's General channels (if not already there)
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