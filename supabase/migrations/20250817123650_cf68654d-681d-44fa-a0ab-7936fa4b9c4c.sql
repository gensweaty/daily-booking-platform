-- Add sender display fields to chat_messages for denormalized reads
ALTER TABLE chat_messages 
ADD COLUMN IF NOT EXISTS sender_name TEXT,
ADD COLUMN IF NOT EXISTS sender_avatar_url TEXT;

-- Add is_dm and participants columns to chat_channels for DM support
ALTER TABLE chat_channels 
ADD COLUMN IF NOT EXISTS is_dm BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS participants JSONB DEFAULT '[]'::jsonb;