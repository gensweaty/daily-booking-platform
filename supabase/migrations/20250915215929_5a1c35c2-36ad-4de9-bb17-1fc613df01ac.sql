-- Ensure RLS is on
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- 1) CLEAN UP old/broken policies on storage.objects
DROP POLICY IF EXISTS "Enable access for all users"              ON storage.objects;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON storage.objects;
DROP POLICY IF EXISTS "Enable select for authenticated users only" ON storage.objects;
DROP POLICY IF EXISTS "Enable update for users based on user_id"   ON storage.objects;
DROP POLICY IF EXISTS "Enable delete for users based on user_id"   ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to manage general storage" ON storage.objects;

-- Buckets you display publicly
-- Add others here if you also render them publicly
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies 
                 WHERE schemaname='storage' AND tablename='objects' 
                   AND policyname='public select attachments') THEN
    CREATE POLICY "public select attachments"
    ON storage.objects
    FOR SELECT
    USING (bucket_id IN (
      'event_attachments',
      'customer_attachments',
      'booking_attachments',
      'task_attachments',
      'comment_attachments',
      'chat_attachments',
      'note_attachments'
    ));
  END IF;
END$$;

-- 2) Owner-based policies for authenticated users (cover ALL buckets)

CREATE POLICY "objects_select_own"
ON storage.objects
FOR SELECT TO authenticated
USING (owner = auth.uid());

CREATE POLICY "objects_insert_own"
ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (owner = auth.uid());

CREATE POLICY "objects_update_own"
ON storage.objects
FOR UPDATE TO authenticated
USING (owner = auth.uid());

CREATE POLICY "objects_delete_own"
ON storage.objects
FOR DELETE TO authenticated
USING (owner = auth.uid());

-- 3) Allow public (anon) uploads ONLY to the two public-board buckets.
--    This mirrors your UI which uploads there for external users.
CREATE POLICY "public insert event/customer attachments"
ON storage.objects
FOR INSERT TO anon, authenticated
WITH CHECK (bucket_id IN ('event_attachments','customer_attachments'));

-- 4) Event/Customer file metadata: allow public read when the parent belongs to a public board

-- event_files
ALTER TABLE public.event_files ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS event_files_sel_own ON public.event_files;
DROP POLICY IF EXISTS event_files_ins_own ON public.event_files;
DROP POLICY IF EXISTS event_files_upd_own ON public.event_files;
DROP POLICY IF EXISTS event_files_del_own ON public.event_files;

-- (keep your internal owner policies)
CREATE POLICY event_files_sel_own ON public.event_files
FOR SELECT TO authenticated
USING (
  user_id = auth.uid()
  OR EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_id AND e.user_id = auth.uid())
);

CREATE POLICY event_files_ins_own ON public.event_files
FOR INSERT TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_id AND e.user_id = auth.uid())
);

CREATE POLICY event_files_upd_own ON public.event_files
FOR UPDATE TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY event_files_del_own ON public.event_files
FOR DELETE TO authenticated
USING (user_id = auth.uid());

-- NEW: public read for events that belong to an active public board
CREATE POLICY event_files_sel_public ON public.event_files
FOR SELECT TO anon
USING (
  EXISTS (
    SELECT 1
    FROM public.events e
    JOIN public.public_boards pb ON pb.user_id = e.user_id AND pb.is_active = true
    WHERE e.id = event_id
  )
);

-- customer_files_new
ALTER TABLE public.customer_files_new ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS customer_files_ins_own ON public.customer_files_new;
DROP POLICY IF EXISTS customer_files_sel_own ON public.customer_files_new;
DROP POLICY IF EXISTS customer_files_upd_own ON public.customer_files_new;
DROP POLICY IF EXISTS customer_files_del_own ON public.customer_files_new;

CREATE POLICY customer_files_sel_own ON public.customer_files_new
FOR SELECT TO authenticated
USING (
  user_id = auth.uid()
  OR EXISTS (SELECT 1 FROM public.customers c WHERE c.id = customer_id AND c.user_id = auth.uid())
);

CREATE POLICY customer_files_ins_own ON public.customer_files_new
FOR INSERT TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND EXISTS (SELECT 1 FROM public.customers c WHERE c.id = customer_id AND c.user_id = auth.uid())
);

CREATE POLICY customer_files_upd_own ON public.customer_files_new
FOR UPDATE TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY customer_files_del_own ON public.customer_files_new
FOR DELETE TO authenticated
USING (user_id = auth.uid());

-- NEW: public read for customers that belong to an active public board
CREATE POLICY customer_files_sel_public ON public.customer_files_new
FOR SELECT TO anon
USING (
  EXISTS (
    SELECT 1
    FROM public.customers c
    JOIN public.public_boards pb ON pb.user_id = c.user_id AND pb.is_active = true
    WHERE c.id = customer_id
  )
);

-- 5) Make sure RPCs are callable from the public link (anon) & internal (authenticated)

REVOKE ALL ON FUNCTION public.public_insert_event_file(uuid, uuid, text, text, text, bigint)   FROM PUBLIC;
REVOKE ALL ON FUNCTION public.public_insert_customer_file(uuid, uuid, text, text, text, bigint) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.public_insert_event_file(uuid, uuid, text, text, text, bigint)   TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.public_insert_customer_file(uuid, uuid, text, text, text, bigint) TO anon, authenticated;