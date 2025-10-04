-- Add owner_id column to chat_messages if it doesn't exist (for proper notifications)
DO $$ 
BEGIN 
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'chat_messages' 
        AND column_name = 'owner_id'
    ) THEN
        ALTER TABLE public.chat_messages ADD COLUMN owner_id uuid;
        
        -- Populate owner_id for existing messages based on channel owner
        UPDATE public.chat_messages 
        SET owner_id = (
            SELECT cc.owner_id 
            FROM public.chat_channels cc 
            WHERE cc.id = chat_messages.channel_id
        )
        WHERE owner_id IS NULL;
    END IF;
END $$;