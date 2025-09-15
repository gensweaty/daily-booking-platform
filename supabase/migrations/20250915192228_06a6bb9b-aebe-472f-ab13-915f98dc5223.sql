-- Enhance RLS policies for customer_files_new to support external users

-- Drop existing policies first
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON public.customer_files_new;
DROP POLICY IF EXISTS "Enable insert access for authenticated users" ON public.customer_files_new;
DROP POLICY IF EXISTS "Enable update access for users based on user_id" ON public.customer_files_new;
DROP POLICY IF EXISTS "Enable delete access for users based on user_id" ON public.customer_files_new;

-- Create comprehensive policies for customer_files_new that handle both internal and external users
CREATE POLICY "Enhanced customer files read access" ON public.customer_files_new
FOR SELECT USING (
  -- Authenticated users can see their own files
  (auth.uid() = user_id) OR
  -- External users can see files for customers on public boards
  (user_id IN (
    SELECT pb.user_id 
    FROM public_boards pb 
    WHERE pb.is_active = true
  ))
);

CREATE POLICY "Enhanced customer files insert access" ON public.customer_files_new
FOR INSERT WITH CHECK (
  -- Authenticated users can upload to their own customers
  (auth.uid() = user_id) OR
  -- External users can upload files (they will be owned by the board owner)
  (auth.uid() IS NULL AND user_id IN (
    SELECT pb.user_id 
    FROM public_boards pb 
    WHERE pb.is_active = true
  ))
);

CREATE POLICY "Enhanced customer files update access" ON public.customer_files_new
FOR UPDATE USING (
  -- Only authenticated users can update their own files
  (auth.uid() = user_id)
);

CREATE POLICY "Enhanced customer files delete access" ON public.customer_files_new
FOR DELETE USING (
  -- Only authenticated users can delete their own files
  (auth.uid() = user_id)
);