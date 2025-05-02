
-- Create a function to securely retrieve the business owner's email based on business_id
CREATE OR REPLACE FUNCTION public.get_business_owner_email(business_id_param UUID)
RETURNS TABLE (email TEXT) 
SECURITY DEFINER 
SET search_path = public
LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  SELECT au.email
  FROM auth.users au
  JOIN public.business_profiles bp ON bp.user_id = au.id
  WHERE bp.id = business_id_param;
END;
$$;

-- Grant permission to execute this function for authenticated users
GRANT EXECUTE ON FUNCTION public.get_business_owner_email TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_business_owner_email TO anon;
