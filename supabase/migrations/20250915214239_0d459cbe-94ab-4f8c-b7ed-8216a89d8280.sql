-- Create SECURITY DEFINER RPCs for public board file uploads

-- 1) For event files (public board)
CREATE OR REPLACE FUNCTION public.public_insert_event_file(
  p_owner_id uuid,
  p_event_id uuid,
  p_filename text,
  p_file_path text,
  p_content_type text,
  p_size bigint
) RETURNS event_files
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rec event_files;
BEGIN
  -- event must belong to the owner
  IF NOT EXISTS (SELECT 1 FROM events e WHERE e.id = p_event_id AND e.user_id = p_owner_id AND e.deleted_at IS NULL) THEN
    RAISE EXCEPTION 'Event not found for owner';
  END IF;

  INSERT INTO event_files(event_id, filename, file_path, content_type, size, user_id)
  VALUES (p_event_id, p_filename, p_file_path, p_content_type, p_size, p_owner_id)
  RETURNING * INTO v_rec;

  RETURN v_rec;
END$$;

-- 2) For customer files (public board)
CREATE OR REPLACE FUNCTION public.public_insert_customer_file(
  p_owner_id uuid,
  p_customer_id uuid,
  p_filename text,
  p_file_path text,
  p_content_type text,
  p_size bigint
) RETURNS customer_files_new
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rec customer_files_new;
BEGIN
  -- customer must belong to the owner
  IF NOT EXISTS (SELECT 1 FROM customers c WHERE c.id = p_customer_id AND c.user_id = p_owner_id AND c.deleted_at IS NULL) THEN
    RAISE EXCEPTION 'Customer not found for owner';
  END IF;

  INSERT INTO customer_files_new(customer_id, filename, file_path, content_type, size, user_id)
  VALUES (p_customer_id, p_filename, p_file_path, p_content_type, p_size, p_owner_id)
  RETURNING * INTO v_rec;

  RETURN v_rec;
END$$;

-- Restore clear owner-policies on event_files table
ALTER TABLE event_files ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS event_files_ins_own ON event_files;
DROP POLICY IF EXISTS event_files_sel_own ON event_files;
DROP POLICY IF EXISTS event_files_upd_own ON event_files;
DROP POLICY IF EXISTS event_files_del_own ON event_files;

CREATE POLICY event_files_sel_own ON event_files
FOR SELECT TO authenticated
USING (
  user_id = auth.uid()
  OR EXISTS(SELECT 1 FROM events e WHERE e.id = event_id AND e.user_id = auth.uid())
);

CREATE POLICY event_files_ins_own ON event_files
FOR INSERT TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND EXISTS(SELECT 1 FROM events e WHERE e.id = event_id AND e.user_id = auth.uid())
);

CREATE POLICY event_files_upd_own ON event_files
FOR UPDATE TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY event_files_del_own ON event_files
FOR DELETE TO authenticated
USING (user_id = auth.uid());

-- Restore clear owner-policies on customer_files_new table
ALTER TABLE customer_files_new ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS customer_files_ins_own ON customer_files_new;
DROP POLICY IF EXISTS customer_files_sel_own ON customer_files_new;
DROP POLICY IF EXISTS customer_files_upd_own ON customer_files_new;
DROP POLICY IF EXISTS customer_files_del_own ON customer_files_new;

CREATE POLICY customer_files_sel_own ON customer_files_new
FOR SELECT TO authenticated
USING (
  user_id = auth.uid()
  OR EXISTS(SELECT 1 FROM customers c WHERE c.id = customer_id AND c.user_id = auth.uid())
);

CREATE POLICY customer_files_ins_own ON customer_files_new
FOR INSERT TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND EXISTS(SELECT 1 FROM customers c WHERE c.id = customer_id AND c.user_id = auth.uid())
);

CREATE POLICY customer_files_upd_own ON customer_files_new
FOR UPDATE TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY customer_files_del_own ON customer_files_new
FOR DELETE TO authenticated
USING (user_id = auth.uid());

-- Allow public read access to storage objects for these buckets
DROP POLICY IF EXISTS "public read event/customer attachments" ON storage.objects;
CREATE POLICY "public read event/customer attachments"
ON storage.objects
FOR SELECT
USING (bucket_id IN ('event_attachments','customer_attachments'));