-- Update the delete_public_board_message function to also delete associated files
CREATE OR REPLACE FUNCTION public.delete_public_board_message(
  p_owner_id uuid, 
  p_message_id uuid, 
  p_sender_email text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_sub_user_id uuid;
  v_file_path text;
BEGIN
  -- Resolve sub-user ID by email
  SELECT su.id INTO v_sub_user_id
  FROM sub_users su
  WHERE su.board_owner_id = p_owner_id 
    AND lower(su.email) = lower(p_sender_email)
  LIMIT 1;

  IF v_sub_user_id IS NULL THEN
    RAISE EXCEPTION 'Unknown sender for owner % and email %', p_owner_id, p_sender_email;
  END IF;

  -- Delete associated files from storage and database
  FOR v_file_path IN 
    SELECT file_path 
    FROM chat_message_files 
    WHERE message_id = p_message_id
  LOOP
    -- Note: Storage deletion will be handled by the application layer
    -- since RPC functions can't directly call storage functions
    DELETE FROM chat_message_files WHERE message_id = p_message_id AND file_path = v_file_path;
  END LOOP;

  -- Delete the message if it belongs to this sub-user
  UPDATE chat_messages 
  SET is_deleted = true,
      content = '[Message deleted]'
  WHERE id = p_message_id 
    AND owner_id = p_owner_id
    AND sender_type = 'sub_user'
    AND sender_sub_user_id = v_sub_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Message not found or permission denied';
  END IF;
END $$;