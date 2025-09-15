-- Create RPC function for public board customer file uploads
CREATE OR REPLACE FUNCTION public.upload_public_board_customer_file(
  p_board_owner_id uuid,
  p_customer_id uuid,
  p_filename text,
  p_file_path text,
  p_content_type text,
  p_size bigint,
  p_sender_email text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sub_user_id uuid;
  v_file_id uuid;
BEGIN
  -- Verify this is a valid public board
  IF NOT EXISTS (
    SELECT 1 FROM public_boards 
    WHERE user_id = p_board_owner_id AND is_active = true
  ) THEN
    RAISE EXCEPTION 'Invalid or inactive public board';
  END IF;

  -- Resolve sub-user ID by email
  SELECT su.id INTO v_sub_user_id
  FROM sub_users su
  WHERE su.board_owner_id = p_board_owner_id 
    AND lower(su.email) = lower(p_sender_email)
  LIMIT 1;

  IF v_sub_user_id IS NULL THEN
    RAISE EXCEPTION 'Unknown sender for board owner % and email %', p_board_owner_id, p_sender_email;
  END IF;

  -- Insert the file record with board owner as user_id (for RLS compatibility)
  INSERT INTO customer_files_new (
    filename,
    file_path,
    content_type,
    size,
    user_id,
    customer_id
  ) VALUES (
    p_filename,
    p_file_path,
    p_content_type,
    p_size,
    p_board_owner_id, -- Use board owner ID for RLS
    p_customer_id
  ) RETURNING id INTO v_file_id;

  RETURN v_file_id;
END;
$$;