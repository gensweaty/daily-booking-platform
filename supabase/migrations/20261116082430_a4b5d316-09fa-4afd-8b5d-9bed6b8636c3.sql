DROP POLICY IF EXISTS "Enable insert access for users" ON public.notes;
CREATE POLICY "Enable insert access for users" ON public.notes FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Allow creating sub users during registration" ON public.sub_users;
CREATE POLICY "Allow creating sub users during registration" ON public.sub_users FOR INSERT TO anon, authenticated WITH CHECK (public.is_active_public_board_owner(board_owner_id));
DROP POLICY IF EXISTS "Allow updating sub users last login" ON public.sub_users;
CREATE POLICY "Allow updating sub users last login" ON public.sub_users FOR UPDATE TO anon, authenticated USING (public.is_active_public_board_owner(board_owner_id)) WITH CHECK (public.is_active_public_board_owner(board_owner_id));

DROP POLICY IF EXISTS "Allow public board access creation" ON public.public_board_access;
CREATE POLICY "Allow public board access creation" ON public.public_board_access FOR INSERT TO anon, authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.public_boards b WHERE b.id = board_id AND b.is_active));
DROP POLICY IF EXISTS "Allow public board access updates" ON public.public_board_access;
CREATE POLICY "Allow public board access updates" ON public.public_board_access FOR UPDATE TO anon, authenticated
  USING (EXISTS (SELECT 1 FROM public.public_boards b WHERE b.id = board_id AND b.is_active))
  WITH CHECK (EXISTS (SELECT 1 FROM public.public_boards b WHERE b.id = board_id AND b.is_active));