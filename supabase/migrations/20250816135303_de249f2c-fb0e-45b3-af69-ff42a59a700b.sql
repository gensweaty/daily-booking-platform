-- Create auto-participant functionality for chat channels
-- This will automatically add all users and sub-users to the default channel

-- Function to add all team members to default channel
CREATE OR REPLACE FUNCTION public.add_all_team_to_default_channel()
RETURNS TRIGGER AS $$
DECLARE
  v_default_channel_id UUID;
  v_sub_user RECORD;
BEGIN
  -- Find the default channel for this owner
  SELECT id INTO v_default_channel_id
  FROM public.chat_channels 
  WHERE owner_id = NEW.id AND is_default = true
  LIMIT 1;

  IF v_default_channel_id IS NOT NULL THEN
    -- Add the owner to the default channel
    INSERT INTO public.chat_participants (channel_id, user_id, user_type)
    VALUES (v_default_channel_id, NEW.id, 'admin')
    ON CONFLICT (channel_id, user_id, user_type) DO NOTHING;

    -- Add all sub-users for this owner to the default channel
    FOR v_sub_user IN 
      SELECT id FROM public.sub_users 
      WHERE board_owner_id = NEW.id
    LOOP
      INSERT INTO public.chat_participants (channel_id, sub_user_id, user_type)
      VALUES (v_default_channel_id, v_sub_user.id, 'sub_user')
      ON CONFLICT (channel_id, sub_user_id, user_type) DO NOTHING;
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to add new sub-users to default channel automatically
CREATE OR REPLACE FUNCTION public.add_sub_user_to_default_channel()
RETURNS TRIGGER AS $$
DECLARE
  v_default_channel_id UUID;
BEGIN
  -- Find the default channel for this owner
  SELECT id INTO v_default_channel_id
  FROM public.chat_channels 
  WHERE owner_id = NEW.board_owner_id AND is_default = true
  LIMIT 1;

  IF v_default_channel_id IS NOT NULL THEN
    -- Add the new sub-user to the default channel
    INSERT INTO public.chat_participants (channel_id, sub_user_id, user_type)
    VALUES (v_default_channel_id, NEW.id, 'sub_user')
    ON CONFLICT (channel_id, sub_user_id, user_type) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update the existing default channel creation function to add participants
CREATE OR REPLACE FUNCTION public.create_default_chat_channel()
RETURNS TRIGGER AS $$
DECLARE
  v_channel_id UUID;
  v_sub_user RECORD;
BEGIN
  -- Create the default channel
  INSERT INTO public.chat_channels (owner_id, name, emoji, is_default)
  VALUES (NEW.id, 'General', '💬', true)
  RETURNING id INTO v_channel_id;

  -- Add the owner to the channel
  INSERT INTO public.chat_participants (channel_id, user_id, user_type)
  VALUES (v_channel_id, NEW.id, 'admin');

  -- Add all existing sub-users to the channel
  FOR v_sub_user IN 
    SELECT id FROM public.sub_users 
    WHERE board_owner_id = NEW.id
  LOOP
    INSERT INTO public.chat_participants (channel_id, sub_user_id, user_type)
    VALUES (v_channel_id, v_sub_user.id, 'sub_user');
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to add new sub-users to default channel
DROP TRIGGER IF EXISTS add_sub_user_to_default_channel_trigger ON public.sub_users;
CREATE TRIGGER add_sub_user_to_default_channel_trigger
  AFTER INSERT ON public.sub_users
  FOR EACH ROW
  EXECUTE FUNCTION public.add_sub_user_to_default_channel();