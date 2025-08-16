-- Clean up duplicate default channels and ensure proper setup
DO $$ 
DECLARE 
    user_record RECORD;
    existing_channel_id UUID;
    channel_count INTEGER;
BEGIN
    -- For each user, ensure they have only one default channel
    FOR user_record IN SELECT DISTINCT owner_id FROM chat_channels
    LOOP
        -- Count existing default channels for this user
        SELECT COUNT(*) INTO channel_count 
        FROM chat_channels 
        WHERE owner_id = user_record.owner_id AND is_default = true;
        
        IF channel_count > 1 THEN
            -- Keep the first default channel, remove others
            SELECT id INTO existing_channel_id 
            FROM chat_channels 
            WHERE owner_id = user_record.owner_id AND is_default = true 
            ORDER BY created_at ASC 
            LIMIT 1;
            
            -- Delete duplicate channels and their participants
            DELETE FROM chat_participants 
            WHERE channel_id IN (
                SELECT id FROM chat_channels 
                WHERE owner_id = user_record.owner_id 
                AND is_default = true 
                AND id != existing_channel_id
            );
            
            DELETE FROM chat_messages 
            WHERE channel_id IN (
                SELECT id FROM chat_channels 
                WHERE owner_id = user_record.owner_id 
                AND is_default = true 
                AND id != existing_channel_id
            );
            
            DELETE FROM chat_channels 
            WHERE owner_id = user_record.owner_id 
            AND is_default = true 
            AND id != existing_channel_id;
            
            RAISE NOTICE 'Cleaned up duplicate channels for user %', user_record.owner_id;
        END IF;
    END LOOP;
END $$;