-- COMPLETE ROLLBACK PLAN: Restore file upload functionality everywhere
-- This rollback removes complex RLS that broke uploads and restores simple working system

-- Step 1: Disable RLS on most file tables (restore simple access)
ALTER TABLE public.files DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_files DISABLE ROW LEVEL SECURITY; 
ALTER TABLE public.note_files DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.comment_files DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_message_files DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.booking_files DISABLE ROW LEVEL SECURITY;

-- Keep customer_files_new with RLS enabled but with proper policies
ALTER TABLE public.customer_files_new ENABLE ROW LEVEL SECURITY;

-- Step 2: Clean up all existing storage policies
DROP POLICY IF EXISTS "Allow authenticated users general storage" ON storage.objects;
DROP POLICY IF EXISTS "Allow customer attachments upload" ON storage.objects;
DROP POLICY IF EXISTS "Allow customer attachments view" ON storage.objects;
DROP POLICY IF EXISTS "Allow customer attachments update" ON storage.objects;
DROP POLICY IF EXISTS "Allow customer attachments delete" ON storage.objects;
DROP POLICY IF EXISTS "Allow event attachments upload" ON storage.objects;
DROP POLICY IF EXISTS "Allow event attachments view" ON storage.objects;
DROP POLICY IF EXISTS "Allow event attachments update" ON storage.objects;
DROP POLICY IF EXISTS "Allow event attachments delete" ON storage.objects;
DROP POLICY IF EXISTS "public select attachments" ON storage.objects;
DROP POLICY IF EXISTS "objects_select_own" ON storage.objects;
DROP POLICY IF EXISTS "objects_insert_own" ON storage.objects;
DROP POLICY IF EXISTS "objects_update_own" ON storage.objects;
DROP POLICY IF EXISTS "objects_delete_own" ON storage.objects;
DROP POLICY IF EXISTS "public insert event/customer attachments" ON storage.objects;
DROP POLICY IF EXISTS "authenticated_users_all_buckets_select" ON storage.objects;
DROP POLICY IF EXISTS "authenticated_users_all_buckets_insert" ON storage.objects;
DROP POLICY IF EXISTS "authenticated_users_all_buckets_update" ON storage.objects;
DROP POLICY IF EXISTS "authenticated_users_all_buckets_delete" ON storage.objects;
DROP POLICY IF EXISTS "public_read_attachments" ON storage.objects;
DROP POLICY IF EXISTS "Enable access for all users" ON storage.objects;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON storage.objects;
DROP POLICY IF EXISTS "Enable select for authenticated users only" ON storage.objects;
DROP POLICY IF EXISTS "Enable update for users based on user_id" ON storage.objects;
DROP POLICY IF EXISTS "Enable delete for users based on user_id" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to manage general storage" ON storage.objects;

-- Step 3: Create simple, universal owner-based storage policies
CREATE POLICY "authenticated_users_all_buckets_select" ON storage.objects
FOR SELECT TO authenticated
USING (owner = auth.uid());

CREATE POLICY "authenticated_users_all_buckets_insert" ON storage.objects  
FOR INSERT TO authenticated
WITH CHECK (owner = auth.uid());

CREATE POLICY "authenticated_users_all_buckets_update" ON storage.objects
FOR UPDATE TO authenticated  
USING (owner = auth.uid())
WITH CHECK (owner = auth.uid());

CREATE POLICY "authenticated_users_all_buckets_delete" ON storage.objects
FOR DELETE TO authenticated
USING (owner = auth.uid());

-- Allow public read for attachment buckets (for external boards)
CREATE POLICY "public_read_attachments" ON storage.objects
FOR SELECT TO anon, authenticated
USING (bucket_id IN ('customer_attachments', 'event_attachments', 'task_attachments', 'chat_attachments', 'note_attachments', 'booking_attachments', 'comment_attachments'));

-- Step 4: Reset customer_files_new policies (the only table that needs RLS)
DROP POLICY IF EXISTS customer_files_ins_own ON customer_files_new;
DROP POLICY IF EXISTS customer_files_sel_own ON customer_files_new;  
DROP POLICY IF EXISTS customer_files_upd_own ON customer_files_new;
DROP POLICY IF EXISTS customer_files_del_own ON customer_files_new;
DROP POLICY IF EXISTS customer_files_sel_public ON customer_files_new;
DROP POLICY IF EXISTS "Enhanced customer files delete access" ON customer_files_new;
DROP POLICY IF EXISTS "Enhanced customer files update access" ON customer_files_new;
DROP POLICY IF EXISTS "Public board users can view customer files" ON customer_files_new;
DROP POLICY IF EXISTS "cf_select_owner_or_sub" ON customer_files_new;
DROP POLICY IF EXISTS "customer_files_insert_policy" ON customer_files_new;

-- Simple working policies for customer_files_new
CREATE POLICY "customer_files_select" ON customer_files_new
FOR SELECT USING (
  user_id = auth.uid() OR 
  user_id IN (SELECT user_id FROM public_boards WHERE is_active = true)
);

CREATE POLICY "customer_files_insert" ON customer_files_new  
FOR INSERT WITH CHECK (
  (auth.uid() IS NOT NULL AND user_id = auth.uid()) OR
  (auth.uid() IS NULL AND user_id IN (SELECT user_id FROM public_boards WHERE is_active = true))
);

CREATE POLICY "customer_files_update" ON customer_files_new
FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "customer_files_delete" ON customer_files_new  
FOR DELETE USING (user_id = auth.uid());

-- Ensure public insert for event/customer attachments still works
CREATE POLICY "public_insert_event_customer_attachments" ON storage.objects
FOR INSERT TO anon
WITH CHECK (bucket_id IN ('event_attachments', 'customer_attachments'));