-- Update create_custom_chat function to accept avatar_url parameter
CREATE OR REPLACE FUNCTION public.create_custom_chat(
  p_owner_id UUID,
  p_creator_type TEXT,        -- 'admin' | 'sub_user'
  p_creator_id UUID,          -- uuid of board owner (admin) or sub_user.id
  p_name TEXT,
  p_participants JSONB,       -- array of { "type":"admin"|"sub_user", "id":"<uuid>" }
  p_avatar_url TEXT DEFAULT NULL  -- optional avatar URL for custom chat
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_name TEXT := NULLIF(TRIM(p_name), '');
  v_is_creator_valid BOOLEAN;
  v_participants JSONB;
  v_all JSONB;
  v_sig TEXT;
  v_channel_id UUID;
BEGIN
  IF v_name IS NULL THEN
    RAISE EXCEPTION 'Chat name is required';
  END IF;

  -- validate creator belongs to this board
  IF p_creator_type = 'admin' THEN
    v_is_creator_valid := (p_creator_id = p_owner_id);
  ELSE
    SELECT EXISTS(
      SELECT 1 FROM public.sub_users su
       WHERE su.id = p_creator_id AND su.board_owner_id = p_owner_id
    ) INTO v_is_creator_valid;
  END IF;
  IF NOT v_is_creator_valid THEN
    RAISE EXCEPTION 'Creator is not part of this board';
  END IF;

  -- normalize participants (dedupe, valid types only)
  v_participants :=
    (SELECT jsonb_agg(DISTINCT x)
       FROM jsonb_to_recordset(COALESCE(p_participants,'[]'::jsonb)) AS x(type TEXT, id UUID)
      WHERE x.type IN ('admin','sub_user') AND x.id IS NOT NULL);

  -- must include at least TWO others (=> total >= 3 with creator)
  IF jsonb_array_length(COALESCE(v_participants,'[]'::jsonb)) < 2 THEN
    RAISE EXCEPTION 'Pick at least two participants';
  END IF;

  -- final set = creator + participants (dedup is fine)
  v_all := COALESCE(v_participants, '[]'::jsonb) ||
           jsonb_build_array(jsonb_build_object('type', p_creator_type, 'id', p_creator_id));

  -- canonical signature
  WITH s AS (
    SELECT (e->>'type') || ':' || (e->>'id') AS k
    FROM jsonb_array_elements(v_all) e
  )
  SELECT string_agg(k, '|' ORDER BY k) INTO v_sig FROM s;

  -- prevent duplicate by THE SAME CREATOR with same set (active)
  IF EXISTS(
    SELECT 1 FROM public.chat_channels c
     WHERE c.owner_id = p_owner_id
       AND c.is_custom = true
       AND c.is_deleted = false
       AND c.created_by_type = p_creator_type
       AND c.created_by_id = p_creator_id
       AND c.custom_sig = v_sig
  ) THEN
    RAISE EXCEPTION 'Custom chat already exists: %',
      (SELECT c.name FROM public.chat_channels c
        WHERE c.owner_id = p_owner_id
          AND c.is_custom = true
          AND c.is_deleted = false
          AND c.created_by_type = p_creator_type
          AND c.created_by_id = p_creator_id
          AND c.custom_sig = v_sig
        LIMIT 1);
  END IF;

  -- create channel with avatar_url
  INSERT INTO public.chat_channels (id, owner_id, name, is_dm, is_custom, created_by_type, created_by_id, custom_sig, avatar_url)
  VALUES (gen_random_uuid(), p_owner_id, v_name, false, true, p_creator_type, p_creator_id, v_sig, p_avatar_url)
  RETURNING id INTO v_channel_id;

  -- add all members
  INSERT INTO public.chat_participants (channel_id, user_type, user_id, sub_user_id)
  SELECT v_channel_id,
         e.type,
         CASE WHEN e.type='admin' THEN e.id ELSE NULL END,
         CASE WHEN e.type='sub_user' THEN e.id ELSE NULL END
  FROM jsonb_to_recordset(v_all) e(type TEXT, id UUID)
  ON CONFLICT DO NOTHING;

  RETURN v_channel_id;
END;
$$;