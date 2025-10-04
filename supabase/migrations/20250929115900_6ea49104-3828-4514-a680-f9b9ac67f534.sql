-- Fix ensure_dm_channel to always upsert participants + add performance index + backfill existing DMs

CREATE OR REPLACE FUNCTION public.ensure_dm_channel(
  p_owner_id uuid,
  p_a_type text, p_a_id uuid,
  p_b_type text, p_b_id uuid
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  o record;
  v_key text;
  v_channel uuid;
BEGIN
  SELECT * INTO o FROM dm_order_pair(p_a_type, p_a_id, p_b_type, p_b_id);
  v_key := make_dm_pair_key(p_a_type, p_a_id, p_b_type, p_b_id);

  SELECT id INTO v_channel
  FROM public.chat_channels
  WHERE owner_id = p_owner_id AND is_dm = true AND dm_pair_key = v_key
  LIMIT 1;

  IF v_channel IS NULL THEN
    INSERT INTO public.chat_channels (owner_id, name, is_dm, is_private, dm_pair_key)
    VALUES (p_owner_id, 'Direct Message', true, true, v_key)
    ON CONFLICT ON CONSTRAINT chat_channels_owner_isdm_dmkey_uniq DO NOTHING
    RETURNING id INTO v_channel;

    IF v_channel IS NULL THEN
      SELECT id INTO v_channel
      FROM public.chat_channels
      WHERE owner_id = p_owner_id AND is_dm = true AND dm_pair_key = v_key
      LIMIT 1;
    END IF;
  END IF;

  -- ✅ always ensure both participants exist (idempotent)
  INSERT INTO public.chat_participants (channel_id, user_type, user_id, sub_user_id)
  VALUES (
    v_channel,
    o.left_type,
    CASE WHEN o.left_type='admin'    THEN o.left_id END,
    CASE WHEN o.left_type='sub_user' THEN o.left_id END
  )
  ON CONFLICT ON CONSTRAINT chat_participants_unique_identity DO NOTHING;

  INSERT INTO public.chat_participants (channel_id, user_type, user_id, sub_user_id)
  VALUES (
    v_channel,
    o.right_type,
    CASE WHEN o.right_type='admin'    THEN o.right_id END,
    CASE WHEN o.right_type='sub_user' THEN o.right_id END
  )
  ON CONFLICT ON CONSTRAINT chat_participants_unique_identity DO NOTHING;

  RETURN v_channel;
END;
$$;

-- Add performance index for membership checks
CREATE INDEX IF NOT EXISTS chat_participants_channel_partkey_idx
  ON public.chat_participants (channel_id, participant_key);

-- One-time backfill: fix stale/missing participants on existing DM channels
WITH dm AS (
  SELECT id FROM chat_channels WHERE is_dm = true
),
seen AS (
  SELECT
    cm.channel_id,
    CASE WHEN cm.sender_type='admin'    THEN 'A:'||cm.sender_user_id::text
         WHEN cm.sender_type='sub_user' THEN 'S:'||cm.sender_sub_user_id::text
    END AS pkey,
    cm.sender_type,
    cm.sender_user_id,
    cm.sender_sub_user_id
  FROM chat_messages cm
  JOIN dm ON dm.id = cm.channel_id
  WHERE (cm.sender_type='admin' AND cm.sender_user_id IS NOT NULL)
     OR (cm.sender_type='sub_user' AND cm.sender_sub_user_id IS NOT NULL)
  GROUP BY 1,2,3,4,5
)
INSERT INTO chat_participants (channel_id, user_type, user_id, sub_user_id)
SELECT
  s.channel_id,
  s.sender_type,
  CASE WHEN s.sender_type='admin'    THEN s.sender_user_id END,
  CASE WHEN s.sender_type='sub_user' THEN s.sender_sub_user_id END
FROM seen s
WHERE s.pkey IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM chat_participants cp
    WHERE cp.channel_id = s.channel_id
      AND cp.participant_key = s.pkey
  );

-- Improve list_channel_messages_public_v2 with better guards
CREATE OR REPLACE FUNCTION public.list_channel_messages_public_v2(
  p_owner_id uuid,
  p_channel_id uuid,
  p_requester_email text DEFAULT NULL,
  p_requester_sub_user_id uuid DEFAULT NULL
)
RETURNS TABLE (
  id uuid, content text, created_at timestamptz, updated_at timestamptz,
  edited_at timestamptz, original_content text, channel_id uuid,
  sender_type text, sender_user_id uuid, sender_sub_user_id uuid,
  sender_name text, sender_avatar_url text, has_attachments boolean,
  message_type text, is_deleted boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_dm boolean;
  v_su_id uuid;
BEGIN
  -- Resolve requester as a sub_user under this owner (email or id)
  IF p_requester_sub_user_id IS NOT NULL THEN
    SELECT su.id INTO v_su_id
    FROM sub_users su
    WHERE su.id = p_requester_sub_user_id
      AND su.board_owner_id = p_owner_id;
  ELSIF p_requester_email IS NOT NULL THEN
    SELECT su.id INTO v_su_id
    FROM sub_users su
    WHERE su.board_owner_id = p_owner_id
      AND lower(su.email) = lower(p_requester_email);
  END IF;

  -- Guard: channel must exist for this owner
  SELECT is_dm INTO v_is_dm
  FROM chat_channels
  WHERE id = p_channel_id AND owner_id = p_owner_id;

  IF NOT FOUND THEN
    RETURN; -- no rows
  END IF;

  IF v_is_dm IS TRUE THEN
    -- DM: requester must be a participant
    IF NOT EXISTS (
      SELECT 1
      FROM chat_participants cp
      WHERE cp.channel_id = p_channel_id
        AND cp.participant_key IN (
          'S:'||v_su_id::text,            -- requester as sub_user
          'A:'||p_owner_id::text          -- or the board owner themselves (admin)
        )
    ) THEN
      RETURN; -- silently return 0 rows
    END IF;
  ELSE
    -- Non-DM: any sub_user under this owner can read (require valid identity)
    IF v_su_id IS NULL THEN
      RETURN;
    END IF;
  END IF;

  RETURN QUERY
  SELECT
    cm.id, cm.content, cm.created_at, cm.updated_at, cm.edited_at,
    cm.original_content, cm.channel_id, cm.sender_type,
    cm.sender_user_id, cm.sender_sub_user_id,
    COALESCE(
      cm.sender_name,
      CASE WHEN cm.sender_type='admin' THEN 'Admin'
           ELSE COALESCE((SELECT su.fullname FROM sub_users su WHERE su.id=cm.sender_sub_user_id),'Member')
      END
    ) AS sender_name,
    cm.sender_avatar_url, cm.has_attachments, cm.message_type, cm.is_deleted
  FROM chat_messages cm
  WHERE cm.channel_id = p_channel_id
    AND cm.owner_id   = p_owner_id
    AND (cm.is_deleted IS NULL OR cm.is_deleted = false)
  ORDER BY cm.created_at ASC;
END;
$$;