CREATE TABLE IF NOT EXISTS public.ai_context_memories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL,
  audience_type TEXT NOT NULL,
  audience_sub_user_id UUID NULL,
  channel_id UUID NOT NULL REFERENCES public.chat_channels(id) ON DELETE CASCADE,
  source_kind TEXT NOT NULL,
  source_record_id UUID NULL,
  source_message_ids UUID[] NOT NULL DEFAULT '{}'::uuid[],
  source_quote TEXT NOT NULL DEFAULT '',
  summary TEXT NOT NULL DEFAULT '',
  structured_context JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT ai_context_memories_audience_type_check CHECK (audience_type IN ('admin', 'sub_user')),
  CONSTRAINT ai_context_memories_source_kind_check CHECK (source_kind IN ('reminder', 'task', 'event', 'customer', 'statistics', 'general')),
  CONSTRAINT ai_context_memories_identity_scope_check CHECK (
    (audience_type = 'admin' AND audience_sub_user_id IS NULL)
    OR
    (audience_type = 'sub_user' AND audience_sub_user_id IS NOT NULL)
  )
);

ALTER TABLE public.ai_context_memories ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'ai_context_memories'
      AND policyname = 'ai_context_memories_service_role_all'
  ) THEN
    CREATE POLICY ai_context_memories_service_role_all
    ON public.ai_context_memories
    FOR ALL
    USING ((auth.jwt() ->> 'role') = 'service_role')
    WITH CHECK ((auth.jwt() ->> 'role') = 'service_role');
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_ai_context_memories_identity
  ON public.ai_context_memories (owner_id, audience_type, audience_sub_user_id, channel_id, source_kind);

CREATE INDEX IF NOT EXISTS idx_ai_context_memories_source_record
  ON public.ai_context_memories (source_kind, source_record_id);

CREATE INDEX IF NOT EXISTS idx_ai_context_memories_structured_context
  ON public.ai_context_memories USING GIN (structured_context);

ALTER TABLE public.custom_reminders
  ADD COLUMN IF NOT EXISTS context_memory_id UUID NULL REFERENCES public.ai_context_memories(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_custom_reminders_context_memory_id
  ON public.custom_reminders (context_memory_id);

CREATE OR REPLACE FUNCTION public.update_ai_context_memories_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'update_ai_context_memories_updated_at'
  ) THEN
    CREATE TRIGGER update_ai_context_memories_updated_at
    BEFORE UPDATE ON public.ai_context_memories
    FOR EACH ROW
    EXECUTE FUNCTION public.update_ai_context_memories_updated_at();
  END IF;
END
$$;