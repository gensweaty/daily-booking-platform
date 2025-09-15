-- Fix RLS policies for customer files to allow sub-users to insert for their board owner
-- This allows authenticated sub-users whose email appears in sub_users table to insert files for that owner

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "cf_select_owner_or_sub" ON public.customer_files_new;
DROP POLICY IF EXISTS "cf_insert_owner_or_sub" ON public.customer_files_new;
DROP POLICY IF EXISTS "Enhanced customer files read access" ON public.customer_files_new;
DROP POLICY IF EXISTS "Enhanced customer files insert access" ON public.customer_files_new;

-- Create new policies for customer_files_new that allow sub-users
CREATE POLICY "cf_select_owner_or_sub" ON public.customer_files_new
FOR SELECT TO authenticated
USING (
  user_id = auth.uid()
  OR EXISTS (
    SELECT 1
    FROM public.profiles p
    JOIN public.sub_users su ON lower(su.email) = lower(p.username)
    WHERE p.id = auth.uid()
      AND su.board_owner_id = customer_files_new.user_id
  )
);

CREATE POLICY "cf_insert_owner_or_sub" ON public.customer_files_new
FOR INSERT TO authenticated
WITH CHECK (
  user_id = auth.uid()
  OR EXISTS (
    SELECT 1
    FROM public.profiles p
    JOIN public.sub_users su ON lower(su.email) = lower(p.username)
    WHERE p.id = auth.uid()
      AND su.board_owner_id = customer_files_new.user_id
  )
);

-- Also update policies for the main files table
DROP POLICY IF EXISTS "files_select_owner_or_sub" ON public.files;
DROP POLICY IF EXISTS "files_insert_owner_or_sub" ON public.files;
DROP POLICY IF EXISTS "Enable read access for users" ON public.files;
DROP POLICY IF EXISTS "Enable insert access for users" ON public.files;

CREATE POLICY "files_select_owner_or_sub" ON public.files
FOR SELECT TO authenticated
USING (
  user_id = auth.uid()
  OR EXISTS (
    SELECT 1
    FROM public.profiles p
    JOIN public.sub_users su ON lower(su.email) = lower(p.username)
    WHERE p.id = auth.uid()
      AND su.board_owner_id = files.user_id
  )
);

CREATE POLICY "files_insert_owner_or_sub" ON public.files
FOR INSERT TO authenticated
WITH CHECK (
  user_id = auth.uid()
  OR EXISTS (
    SELECT 1
    FROM public.profiles p
    JOIN public.sub_users su ON lower(su.email) = lower(p.username)
    WHERE p.id = auth.uid()
      AND su.board_owner_id = files.user_id
  )
);