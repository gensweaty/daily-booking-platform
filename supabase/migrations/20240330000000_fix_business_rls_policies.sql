
-- First, enable Row Level Security for the businesses table if not already enabled
ALTER TABLE public.businesses ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Users can create their own businesses" ON public.businesses;
DROP POLICY IF EXISTS "Users can view their own businesses" ON public.businesses;
DROP POLICY IF EXISTS "Users can update their own businesses" ON public.businesses;
DROP POLICY IF EXISTS "Users can delete their own businesses" ON public.businesses;

-- Create policy that allows users to insert their own businesses
CREATE POLICY "Users can create their own businesses" 
ON public.businesses 
FOR INSERT 
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Create policy that allows users to view their own businesses
CREATE POLICY "Users can view their own businesses" 
ON public.businesses 
FOR SELECT 
TO authenticated
USING (auth.uid() = user_id);

-- Create policy that allows users to update their own businesses
CREATE POLICY "Users can update their own businesses" 
ON public.businesses 
FOR UPDATE 
TO authenticated
USING (auth.uid() = user_id);

-- Create policy that allows users to delete their own businesses
CREATE POLICY "Users can delete their own businesses" 
ON public.businesses 
FOR DELETE 
TO authenticated
USING (auth.uid() = user_id);
