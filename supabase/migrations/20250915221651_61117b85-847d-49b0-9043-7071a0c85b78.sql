-- COMPLETE ROLLBACK: Remove all conflicting policies and restore simple file upload functionality

-- ========================================
-- STEP 1: DROP ALL POLICIES FROM FILE TABLES
-- ========================================

-- Drop policies from booking_files
DROP POLICY IF EXISTS "Users can delete their own booking files" ON public.booking_files;
DROP POLICY IF EXISTS "Users can insert their own booking files" ON public.booking_files;
DROP POLICY IF EXISTS "Users can update their own booking files" ON public.booking_files;
DROP POLICY IF EXISTS "Users can view their own booking files" ON public.booking_files;

-- Drop policies from chat_message_files
DROP POLICY IF EXISTS "Participants can manage message files" ON public.chat_message_files;
DROP POLICY IF EXISTS "Participants can view message files" ON public.chat_message_files;

-- Drop policies from comment_files
DROP POLICY IF EXISTS "Allow deleting comment files" ON public.comment_files;
DROP POLICY IF EXISTS "Allow uploading comment files" ON public.comment_files;
DROP POLICY IF EXISTS "Allow viewing comment files" ON public.comment_files;

-- Drop policies from customer_files (old table)
DROP POLICY IF EXISTS "Enable delete access for users based on user_id" ON public.customer_files;
DROP POLICY IF EXISTS "Enable insert access for authenticated users" ON public.customer_files;
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON public.customer_files;
DROP POLICY IF EXISTS "Enable update access for users based on user_id" ON public.customer_files;

-- Drop policies from customer_files_new
DROP POLICY IF EXISTS "customer_files_delete" ON public.customer_files_new;
DROP POLICY IF EXISTS "customer_files_insert" ON public.customer_files_new;
DROP POLICY IF EXISTS "customer_files_select" ON public.customer_files_new;
DROP POLICY IF EXISTS "customer_files_update" ON public.customer_files_new;

-- Drop policies from event_files
DROP POLICY IF EXISTS "Users can delete their own event files" ON public.event_files;
DROP POLICY IF EXISTS "Users can insert their own event files" ON public.event_files;
DROP POLICY IF EXISTS "Users can update their own event files" ON public.event_files;
DROP POLICY IF EXISTS "Users can view event files for their events" ON public.event_files;
DROP POLICY IF EXISTS "event_files_del_own" ON public.event_files;
DROP POLICY IF EXISTS "event_files_ins_own" ON public.event_files;
DROP POLICY IF EXISTS "event_files_sel_own" ON public.event_files;
DROP POLICY IF EXISTS "event_files_sel_public" ON public.event_files;
DROP POLICY IF EXISTS "event_files_upd_own" ON public.event_files;

-- Drop policies from files
DROP POLICY IF EXISTS "Enable delete access for users" ON public.files;
DROP POLICY IF EXISTS "Enable update access for users" ON public.files;
DROP POLICY IF EXISTS "files_insert_owner_or_sub" ON public.files;
DROP POLICY IF EXISTS "files_select_owner_or_sub" ON public.files;

-- Drop policies from note_files
DROP POLICY IF EXISTS "Enable delete access for users based on user_id" ON public.note_files;
DROP POLICY IF EXISTS "Enable insert access for authenticated users" ON public.note_files;
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON public.note_files;
DROP POLICY IF EXISTS "Enable update access for users based on user_id" ON public.note_files;

-- ========================================
-- STEP 2: DISABLE RLS ON ALL FILE TABLES (CONFIRMED)
-- ========================================

ALTER TABLE public.booking_files DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_message_files DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.comment_files DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_files DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_files_new DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_files DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.files DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.note_files DISABLE ROW LEVEL SECURITY;

-- ========================================
-- STEP 3: CLEAN UP STORAGE POLICIES
-- ========================================

-- Remove all conflicting storage policies
DROP POLICY IF EXISTS "authenticated_users_all_buckets_select" ON storage.objects;
DROP POLICY IF EXISTS "authenticated_users_all_buckets_insert" ON storage.objects;
DROP POLICY IF EXISTS "authenticated_users_all_buckets_update" ON storage.objects;
DROP POLICY IF EXISTS "authenticated_users_all_buckets_delete" ON storage.objects;
DROP POLICY IF EXISTS "public_read_attachments" ON storage.objects;

-- Remove any other conflicting policies
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

-- ========================================
-- STEP 4: CREATE SIMPLE WORKING STORAGE POLICIES
-- ========================================

-- Simple authenticated user policies for all storage operations
CREATE POLICY "simple_authenticated_select" ON storage.objects
FOR SELECT TO authenticated
USING (owner = auth.uid());

CREATE POLICY "simple_authenticated_insert" ON storage.objects  
FOR INSERT TO authenticated
WITH CHECK (owner = auth.uid());

CREATE POLICY "simple_authenticated_update" ON storage.objects
FOR UPDATE TO authenticated  
USING (owner = auth.uid())
WITH CHECK (owner = auth.uid());

CREATE POLICY "simple_authenticated_delete" ON storage.objects
FOR DELETE TO authenticated
USING (owner = auth.uid());

-- Allow public read access for specific attachment buckets (for external boards)
CREATE POLICY "simple_public_read_attachments" ON storage.objects
FOR SELECT TO anon, authenticated
USING (bucket_id IN ('customer_attachments', 'event_attachments', 'task_attachments', 'chat_attachments', 'note_attachments', 'booking_attachments'));

-- ========================================
-- STEP 5: ENSURE BUCKETS EXIST
-- ========================================

-- Create attachment buckets if they don't exist
INSERT INTO storage.buckets (id, name, public) 
VALUES ('customer_attachments', 'customer_attachments', true)
ON CONFLICT (id) DO UPDATE SET public = true;

INSERT INTO storage.buckets (id, name, public) 
VALUES ('event_attachments', 'event_attachments', true)
ON CONFLICT (id) DO UPDATE SET public = true;

INSERT INTO storage.buckets (id, name, public) 
VALUES ('task_attachments', 'task_attachments', true)
ON CONFLICT (id) DO UPDATE SET public = true;

INSERT INTO storage.buckets (id, name, public) 
VALUES ('chat_attachments', 'chat_attachments', true)
ON CONFLICT (id) DO UPDATE SET public = true;

INSERT INTO storage.buckets (id, name, public) 
VALUES ('note_attachments', 'note_attachments', true)
ON CONFLICT (id) DO UPDATE SET public = true;

INSERT INTO storage.buckets (id, name, public) 
VALUES ('booking_attachments', 'booking_attachments', true)
ON CONFLICT (id) DO UPDATE SET public = true;