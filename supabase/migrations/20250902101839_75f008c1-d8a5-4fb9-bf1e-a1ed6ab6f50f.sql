-- Create RLS-safe RPC to list files for a set of message IDs (public board view)
CREATE OR REPLACE FUNCTION public.list_files_for_messages_public(p_message_ids uuid[])
RETURNS TABLE(
  id uuid,
  message_id uuid,
  filename text,
  file_path text,
  content_type text,
  size bigint
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id, message_id, filename, file_path, content_type, size
  FROM chat_message_files
  WHERE message_id = ANY(p_message_ids)
$$;