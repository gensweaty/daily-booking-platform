-- Comprehensive fix for chat functionality issues

-- 1. Fix find_or_create_dm function to handle ON CONFLICT properly
CREATE OR REPLACE FUNCTION public.find_or_create_dm(p_owner_id uuid, p_a_type text, p_a_id uuid, p_b_type text, p_b_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  o record;
  v_key text;
  v_channel uuid;
BEGIN
  SELECT * INTO o FROM dm_order_pair(p_a_type, p_a_id, p_b_type, p_b_id);
  v_key := make_dm_pair_key(p_a_type, p_a_id, p_b_type, p_b_id);

  SELECT id INTO v_channel
  FROM chat_channels
  WHERE owner_id = p_owner_id
    AND is_dm = true
    AND dm_pair_key = v_key
  LIMIT 1;

  IF v_channel IS NOT NULL THEN
    RETURN v_channel;
  END IF;

  INSERT INTO chat_channels (owner_id, name, is_dm, is_private, dm_pair_key)
  VALUES (p_owner_id, 'Direct Message', true, true, v_key)
  RETURNING id INTO v_channel;

  -- Fix: Add ON CONFLICT clause matching the unique constraint (channel_id, user_id, sub_user_id)
  INSERT INTO chat_participants (channel_id, user_type, user_id, sub_user_id) VALUES
    (v_channel, o.left_type,  CASE WHEN o.left_type  = 'admin'    THEN o.left_id  END, CASE WHEN o.left_type  = 'sub_user' THEN o.left_id  END),
    (v_channel, o.right_type, CASE WHEN o.right_type = 'admin'    THEN o.right_id END, CASE WHEN o.right_type = 'sub_user' THEN o.right_id END)
  ON CONFLICT (channel_id, user_id, sub_user_id) DO NOTHING;

  RETURN v_channel;
END;
$function$;

-- 2. Grant EXECUTE permissions to all existing chat-related RPC functions for anon and authenticated roles
GRANT EXECUTE ON FUNCTION public.find_or_create_dm(uuid, text, uuid, text, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_chat_messages_for_channel(uuid, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.list_channel_messages_public(uuid, uuid, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.list_files_for_messages_public(uuid[]) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_custom_chat(uuid, text, uuid, text, jsonb) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_custom_chat(uuid, text, uuid, text, jsonb, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.delete_custom_chat(uuid, uuid, text, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.edit_public_board_message(uuid, uuid, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_dm_channel(uuid, text, uuid, text, uuid) TO anon, authenticated;