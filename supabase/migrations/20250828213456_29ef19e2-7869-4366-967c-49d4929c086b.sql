-- Fix the add_sub_user_to_default_channel function to use correct conflict handling
CREATE OR REPLACE FUNCTION public.add_sub_user_to_default_channel()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_default_channel_id UUID;
BEGIN
  -- Find the default channel for this owner
  SELECT id INTO v_default_channel_id
  FROM public.chat_channels 
  WHERE owner_id = NEW.board_owner_id AND is_default = true
  LIMIT 1;

  IF v_default_channel_id IS NOT NULL THEN
    -- Add the new sub-user to the default channel using the correct unique constraint
    INSERT INTO public.chat_participants (channel_id, sub_user_id, user_type)
    VALUES (v_default_channel_id, NEW.id, 'sub_user')
    ON CONFLICT (channel_id, user_id, sub_user_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$function$;