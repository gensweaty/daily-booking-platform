
-- Add RLS policies for the businesses table
ALTER TABLE public.businesses ENABLE ROW LEVEL SECURITY;

-- Create policy to allow authenticated users to insert their own businesses
CREATE POLICY "Users can create their own businesses" 
ON public.businesses 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Create policy to allow users to view their own businesses
CREATE POLICY "Users can view their own businesses" 
ON public.businesses 
FOR SELECT 
USING (auth.uid() = user_id);

-- Create policy to allow users to update their own businesses
CREATE POLICY "Users can update their own businesses" 
ON public.businesses 
FOR UPDATE 
USING (auth.uid() = user_id);

-- Create policy to allow users to delete their own businesses
CREATE POLICY "Users can delete their own businesses" 
ON public.businesses 
FOR DELETE 
USING (auth.uid() = user_id);
