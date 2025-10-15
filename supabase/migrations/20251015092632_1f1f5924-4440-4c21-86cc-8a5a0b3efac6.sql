-- Create RPC function to list files for chat messages on public boards
-- This allows sub-users on external boards to see file attachments

CREATE OR REPLACE FUNCTION public.list_files_for_messages_public(
  p_message_ids UUID[]
)
RETURNS TABLE (
  id UUID,
  message_id UUID,
  filename TEXT,
  file_path TEXT,
  content_type TEXT,
  size BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Return file attachments for the given message IDs
  -- This is a public function that allows external users to see attachments
  RETURN QUERY
  SELECT 
    cmf.id,
    cmf.message_id,
    cmf.filename,
    cmf.file_path,
    cmf.content_type,
    cmf.size
  FROM chat_message_files cmf
  WHERE cmf.message_id = ANY(p_message_ids)
  ORDER BY cmf.created_at ASC;
END;
$$;