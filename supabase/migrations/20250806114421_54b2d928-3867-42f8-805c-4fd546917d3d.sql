-- Allow public read access to active public boards
DROP POLICY IF EXISTS "Users can view their own public boards" ON public.public_boards;

-- Create new policy that allows public read access to active boards
CREATE POLICY "Public can view active public boards" 
ON public.public_boards 
FOR SELECT 
USING (is_active = true);

-- Keep the authenticated user policies for managing their own boards
CREATE POLICY "Users can manage their own public boards" 
ON public.public_boards 
FOR ALL 
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);