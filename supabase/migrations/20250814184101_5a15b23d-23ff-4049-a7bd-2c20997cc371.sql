-- Re-enable RLS on all tables and add proper policies for authenticated sub-users

-- Re-enable RLS on critical tables
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

-- Enhanced customers policies for authenticated sub-users
DROP POLICY IF EXISTS "Enable delete access for users and public boards" ON public.customers;
DROP POLICY IF EXISTS "Enable insert access for users" ON public.customers;
DROP POLICY IF EXISTS "Enable read access for users" ON public.customers;
DROP POLICY IF EXISTS "Enable update access for users and public boards" ON public.customers;

CREATE POLICY "Users can manage their own customers" 
ON public.customers 
FOR ALL 
USING (
  -- Regular authenticated users (admins)
  (auth.uid() IS NOT NULL AND auth.uid() = user_id AND created_by_type != 'sub_user') OR
  -- Authenticated sub-users can access items they created/edited
  (auth.uid() IS NOT NULL AND (
    (created_by_type = 'sub_user' AND created_by_name IN (
      SELECT email FROM auth.users WHERE id = auth.uid()
      UNION
      SELECT fullname FROM sub_users WHERE board_owner_id = user_id AND lower(email) = lower((SELECT email FROM auth.users WHERE id = auth.uid()))
    )) OR
    (last_edited_by_type = 'sub_user' AND last_edited_by_name IN (
      SELECT email FROM auth.users WHERE id = auth.uid()
      UNION
      SELECT fullname FROM sub_users WHERE board_owner_id = user_id AND lower(email) = lower((SELECT email FROM auth.users WHERE id = auth.uid()))
    )) OR
    -- Legacy data without metadata for authenticated users
    (created_by_type IS NULL AND created_by_name IS NULL AND last_edited_by_type IS NULL AND last_edited_by_name IS NULL)
  )) OR
  -- Public board access for external users
  (user_id IN (SELECT user_id FROM public_boards WHERE is_active = true))
)
WITH CHECK (
  -- Regular authenticated users can create
  (auth.uid() IS NOT NULL AND auth.uid() = user_id) OR
  -- Public board users can create (anonymous)
  (auth.uid() IS NULL AND user_id IN (SELECT user_id FROM public_boards WHERE is_active = true))
);

-- Enhanced tasks policies for authenticated sub-users  
DROP POLICY IF EXISTS "Enable delete access for users and public boards" ON public.tasks;
DROP POLICY IF EXISTS "Enable insert access for users" ON public.tasks;
DROP POLICY IF EXISTS "Enable read access for users" ON public.tasks;
DROP POLICY IF EXISTS "Enable update access for users and public boards" ON public.tasks;

CREATE POLICY "Users can manage their own tasks"
ON public.tasks
FOR ALL
USING (
  -- Regular authenticated users (admins)
  (auth.uid() IS NOT NULL AND auth.uid() = user_id AND created_by_type != 'sub_user') OR
  -- Authenticated sub-users can access items they created/edited
  (auth.uid() IS NOT NULL AND (
    (created_by_type = 'sub_user' AND created_by_name IN (
      SELECT email FROM auth.users WHERE id = auth.uid()
      UNION
      SELECT fullname FROM sub_users WHERE board_owner_id = user_id AND lower(email) = lower((SELECT email FROM auth.users WHERE id = auth.uid()))
    )) OR
    (last_edited_by_type = 'sub_user' AND last_edited_by_name IN (
      SELECT email FROM auth.users WHERE id = auth.uid()
      UNION
      SELECT fullname FROM sub_users WHERE board_owner_id = user_id AND lower(email) = lower((SELECT email FROM auth.users WHERE id = auth.uid()))
    )) OR
    -- Legacy data without metadata for authenticated users
    (created_by_type IS NULL AND created_by_name IS NULL AND last_edited_by_type IS NULL AND last_edited_by_name IS NULL)
  )) OR
  -- Public board access for external users
  (user_id IN (SELECT user_id FROM public_boards WHERE is_active = true))
)
WITH CHECK (
  -- Regular authenticated users can create
  (auth.uid() IS NOT NULL AND auth.uid() = user_id) OR
  -- Public board users can create (anonymous)  
  (auth.uid() IS NULL AND user_id IN (SELECT user_id FROM public_boards WHERE is_active = true))
);

-- Enhanced events policies for authenticated sub-users
DROP POLICY IF EXISTS "Enable delete access for users" ON public.events;
DROP POLICY IF EXISTS "Enable insert access for users" ON public.events;
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON public.events;
DROP POLICY IF EXISTS "Enable read access for users based on user_id" ON public.events;
DROP POLICY IF EXISTS "Enable update access for users" ON public.events;

CREATE POLICY "Users can manage their own events"
ON public.events
FOR ALL
USING (
  -- Regular authenticated users (admins)
  (auth.uid() IS NOT NULL AND auth.uid() = user_id AND created_by_type != 'sub_user') OR
  -- Authenticated sub-users can access items they created/edited
  (auth.uid() IS NOT NULL AND (
    (created_by_type = 'sub_user' AND created_by_name IN (
      SELECT email FROM auth.users WHERE id = auth.uid()
      UNION
      SELECT fullname FROM sub_users WHERE board_owner_id = user_id AND lower(email) = lower((SELECT email FROM auth.users WHERE id = auth.uid()))
    )) OR
    (last_edited_by_type = 'sub_user' AND last_edited_by_name IN (
      SELECT email FROM auth.users WHERE id = auth.uid()
      UNION
      SELECT fullname FROM sub_users WHERE board_owner_id = user_id AND lower(email) = lower((SELECT email FROM auth.users WHERE id = auth.uid()))
    )) OR
    -- Legacy data without metadata for authenticated users
    (created_by_type IS NULL AND created_by_name IS NULL AND last_edited_by_type IS NULL AND last_edited_by_name IS NULL)
  )) OR
  -- Public board access for external users  
  (user_id IN (SELECT user_id FROM public_boards WHERE is_active = true))
)
WITH CHECK (
  -- Regular authenticated users can create
  (auth.uid() IS NOT NULL AND auth.uid() = user_id) OR
  -- Public board users can create (anonymous)
  (auth.uid() IS NULL AND user_id IN (SELECT user_id FROM public_boards WHERE is_active = true))
);