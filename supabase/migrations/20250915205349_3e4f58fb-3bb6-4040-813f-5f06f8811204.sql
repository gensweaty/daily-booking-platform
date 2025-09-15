-- Remove the unnecessary RPC function since we're using direct inserts
DROP FUNCTION IF EXISTS public.upload_public_board_customer_file(uuid, uuid, text, text, text, bigint, text);