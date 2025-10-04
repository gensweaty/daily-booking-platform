-- Re-grant EXECUTE on the new/updated RPCs so PostgREST can call them
GRANT EXECUTE ON FUNCTION public.get_chat_messages_for_channel(uuid, uuid)
  TO anon, authenticated;

GRANT EXECUTE ON FUNCTION public.list_channel_messages_public(uuid, uuid, text, text)
  TO anon, authenticated;

GRANT EXECUTE ON FUNCTION public.list_files_for_messages_public(uuid[])
  TO anon, authenticated;