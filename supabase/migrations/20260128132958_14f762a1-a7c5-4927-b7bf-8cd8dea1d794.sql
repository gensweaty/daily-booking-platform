-- Add metadata column to chat_messages for recipient targeting
ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS metadata JSONB;

-- Create index for efficient metadata queries
CREATE INDEX IF NOT EXISTS idx_chat_messages_metadata 
ON chat_messages USING gin (metadata);

-- Add helpful comment
COMMENT ON COLUMN chat_messages.metadata IS 'Optional metadata for message routing (e.g., recipient_type, recipient_user_id, recipient_sub_user_id)';