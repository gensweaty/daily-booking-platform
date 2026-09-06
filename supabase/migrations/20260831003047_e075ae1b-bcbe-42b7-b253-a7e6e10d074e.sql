
CREATE OR REPLACE FUNCTION public.identity_names_for_owner(p_owner uuid)
RETURNS TABLE(name text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, auth AS $$
  SELECT u.email::text FROM auth.users u WHERE u.id = auth.uid()
  UNION
  SELECT su.fullname FROM public.sub_users su
   WHERE su.board_owner_id = p_owner
     AND lower(su.email) = lower(coalesce((SELECT u2.email::text FROM auth.users u2 WHERE u2.id = auth.uid()), ''));
$$;
GRANT EXECUTE ON FUNCTION public.identity_names_for_owner(uuid) TO anon, authenticated, service_role;

DROP POLICY "Users can manage their own customers" ON public.customers;
CREATE POLICY "Users can manage their own customers" ON public.customers FOR ALL
USING (
  ((auth.uid() IS NOT NULL) AND (auth.uid() = user_id) AND (created_by_type IS DISTINCT FROM 'sub_user'))
  OR ((auth.uid() IS NOT NULL) AND (
        ((created_by_type = 'sub_user') AND (created_by_name IN (SELECT name FROM public.identity_names_for_owner(customers.user_id))))
     OR ((last_edited_by_type = 'sub_user') AND (last_edited_by_name IN (SELECT name FROM public.identity_names_for_owner(customers.user_id))))
     OR (created_by_type IS NULL AND created_by_name IS NULL AND last_edited_by_type IS NULL AND last_edited_by_name IS NULL)
  ))
  OR public.is_active_public_board_owner(user_id)
)
WITH CHECK (
  ((auth.uid() IS NOT NULL) AND (auth.uid() = user_id))
  OR ((auth.uid() IS NULL) AND public.is_active_public_board_owner(user_id))
);

DROP POLICY "Sub users can delete only their own created events" ON public.events;
CREATE POLICY "Sub users can delete only their own created events" ON public.events FOR DELETE
USING (
  (auth.uid() IS NOT NULL) AND (created_by_type = 'sub_user')
  AND (created_by_name IN (SELECT name FROM public.identity_names_for_owner(events.user_id)))
);

DROP POLICY "Sub users can update only their own created events" ON public.events;
CREATE POLICY "Sub users can update only their own created events" ON public.events FOR UPDATE
USING (
  (auth.uid() IS NOT NULL) AND (
    ((created_by_type = 'sub_user') AND (created_by_name IN (SELECT name FROM public.identity_names_for_owner(events.user_id))))
    OR ((created_by_type = 'sub_user') AND (last_edited_by_type = 'sub_user')
        AND (last_edited_by_name IN (SELECT name FROM public.identity_names_for_owner(events.user_id))))
  )
);
