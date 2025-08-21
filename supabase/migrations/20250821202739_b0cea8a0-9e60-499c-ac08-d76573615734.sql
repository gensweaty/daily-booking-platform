-- Add owner_id column to chat_messages if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='chat_messages' AND column_name='owner_id') THEN
    ALTER TABLE public.chat_messages ADD COLUMN owner_id UUID;
  END IF;
END $$;