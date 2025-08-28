-- Clean up duplicate General channels and ensure proper participants
DO $$
DECLARE
    owner_record RECORD;
    default_channel_record RECORD;
    channels_to_delete UUID[];
    participant_count INTEGER;
BEGIN
    -- Process each board owner
    FOR owner_record IN 
        SELECT DISTINCT cc.owner_id 
        FROM chat_channels cc 
        WHERE cc.is_default = true AND cc.name = 'General'
    LOOP
        RAISE NOTICE 'Processing owner: %', owner_record.owner_id;
        
        -- Find all General channels for this owner
        SELECT ARRAY_AGG(cc.id ORDER BY 
            (SELECT COUNT(*) FROM chat_participants cp WHERE cp.channel_id = cc.id) DESC, 
            cc.created_at ASC
        ) INTO channels_to_delete
        FROM chat_channels cc
        WHERE cc.owner_id = owner_record.owner_id 
        AND cc.is_default = true 
        AND cc.name = 'General';
        
        -- Keep the first one (should have most participants), delete the rest
        IF array_length(channels_to_delete, 1) > 1 THEN
            RAISE NOTICE 'Found % General channels for owner %, keeping % and deleting the rest', 
                array_length(channels_to_delete, 1), owner_record.owner_id, channels_to_delete[1];
            
            -- Delete duplicate channels (skip the first one)
            FOR i IN 2..array_length(channels_to_delete, 1) LOOP
                RAISE NOTICE 'Deleting duplicate General channel: %', channels_to_delete[i];
                
                -- Delete participants first
                DELETE FROM chat_participants WHERE channel_id = channels_to_delete[i];
                -- Delete messages
                DELETE FROM chat_messages WHERE channel_id = channels_to_delete[i];
                -- Delete channel
                DELETE FROM chat_channels WHERE id = channels_to_delete[i];
            END LOOP;
        END IF;
        
        -- Ensure the remaining General channel has proper participants
        IF array_length(channels_to_delete, 1) >= 1 THEN
            SELECT COUNT(*) INTO participant_count
            FROM chat_participants cp
            WHERE cp.channel_id = channels_to_delete[1];
            
            RAISE NOTICE 'General channel % has % participants', channels_to_delete[1], participant_count;
            
            -- If no participants, add them
            IF participant_count = 0 THEN
                RAISE NOTICE 'Adding participants to General channel %', channels_to_delete[1];
                
                -- Add the owner (admin)
                INSERT INTO chat_participants (channel_id, user_id, user_type)
                VALUES (channels_to_delete[1], owner_record.owner_id, 'admin')
                ON CONFLICT (channel_id, user_id, user_type) DO NOTHING;
                
                -- Add all sub-users for this owner
                INSERT INTO chat_participants (channel_id, sub_user_id, user_type)
                SELECT channels_to_delete[1], su.id, 'sub_user'
                FROM sub_users su
                WHERE su.board_owner_id = owner_record.owner_id
                ON CONFLICT (channel_id, sub_user_id, user_type) DO NOTHING;
                
                RAISE NOTICE 'Added participants to General channel %', channels_to_delete[1];
            END IF;
        END IF;
    END LOOP;
    
    RAISE NOTICE 'General channel cleanup completed';
END $$;