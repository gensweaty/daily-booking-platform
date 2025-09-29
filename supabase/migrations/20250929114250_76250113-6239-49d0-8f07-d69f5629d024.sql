-- 20250929_chat_stabilize_identity_fixed.sql
BEGIN;

-- 1) Add a canonical participant key (no RLS impact; computed server-side)
ALTER TABLE public.chat_participants
ADD COLUMN IF NOT EXISTS participant_key text
GENERATED ALWAYS AS (
  CASE
    WHEN user_type = 'admin'    AND user_id      IS NOT NULL THEN 'A:' || user_id::text
    WHEN user_type = 'sub_user' AND sub_user_id  IS NOT NULL THEN 'S:' || sub_user_id::text
    ELSE 'X:invalid'
  END
) STORED;

-- 2) De-dupe by the canonical key
WITH ranked AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY channel_id, participant_key
           ORDER BY id
         ) rn
  FROM public.chat_participants
  WHERE participant_key <> 'X:invalid'
)
DELETE FROM public.chat_participants
WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

-- 3) Add ONE unique guard that all upserts can safely target
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chat_participants_unique_identity'
  ) THEN
    ALTER TABLE public.chat_participants
      ADD CONSTRAINT chat_participants_unique_identity
      UNIQUE (channel_id, participant_key);
  END IF;
END$$;

-- 4) Channel uniqueness for DMs (name it and use it everywhere)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chat_channels_owner_isdm_dmkey_uniq'
  ) THEN
    ALTER TABLE public.chat_channels
      ADD CONSTRAINT chat_channels_owner_isdm_dmkey_uniq
      UNIQUE (owner_id, is_dm, dm_pair_key);
  END IF;
END$$;

CREATE INDEX IF NOT EXISTS chat_channels_owner_isdm_dmkey_idx
  ON public.chat_channels (owner_id, is_dm, dm_pair_key);

-- 5) Drop and recreate DM helpers to target the named constraints above
DROP FUNCTION IF EXISTS public.ensure_dm_channel(uuid, text, uuid, text, uuid);

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

    -- LEFT participant
    INSERT INTO public.chat_participants (channel_id, user_type, user_id, sub_user_id)
    VALUES (
      v_channel,
      o.left_type,
      CASE WHEN o.left_type='admin'    THEN o.left_id END,
      CASE WHEN o.left_type='sub_user' THEN o.left_id END
    )
    ON CONFLICT ON CONSTRAINT chat_participants_unique_identity DO NOTHING;

    -- RIGHT participant
    INSERT INTO public.chat_participants (channel_id, user_type, user_id, sub_user_id)
    VALUES (
      v_channel,
      o.right_type,
      CASE WHEN o.right_type='admin'    THEN o.right_id END,
      CASE WHEN o.right_type='sub_user' THEN o.right_id END
    )
    ON CONFLICT ON CONSTRAINT chat_participants_unique_identity DO NOTHING;
  END IF;

  RETURN v_channel;
END;
$$;

CREATE OR REPLACE FUNCTION public.find_or_create_dm(
  p_owner_id uuid, p_a_type text, p_a_id uuid, p_b_type text, p_b_id uuid
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Delegate to the single source of truth
  RETURN ensure_dm_channel(p_owner_id, p_a_type, p_a_id, p_b_type, p_b_id);
END;
$$;

-- Create the unbreakable public message reader
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

  -- Identify channel type
  SELECT is_dm INTO v_is_dm
  FROM chat_channels
  WHERE id = p_channel_id AND owner_id = p_owner_id;

  IF v_is_dm THEN
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

-- 6) Grants (idempotent)
GRANT EXECUTE ON FUNCTION public.ensure_dm_channel(uuid, text, uuid, text, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.find_or_create_dm(uuid, text, uuid, text, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.list_channel_messages_public_v2(uuid, uuid, text, uuid) TO anon, authenticated;

COMMIT;