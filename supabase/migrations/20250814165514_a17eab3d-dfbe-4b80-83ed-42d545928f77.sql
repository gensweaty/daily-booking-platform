-- Fix RLS policies for public board functionality

-- Update customers table policies to allow public access for public boards
DROP POLICY IF EXISTS "Enable insert access for authenticated users" ON customers;
CREATE POLICY "Enable insert access for authenticated users" 
ON customers 
FOR INSERT 
TO public
WITH CHECK (true);

DROP POLICY IF EXISTS "Enable read access for authenticated users" ON customers;
CREATE POLICY "Enable read access for authenticated users" 
ON customers 
FOR SELECT 
TO public
USING (true);

DROP POLICY IF EXISTS "Enable update access for users based on user_id" ON customers;
CREATE POLICY "Enable update access for users based on user_id" 
ON customers 
FOR UPDATE 
TO public
USING (true);

DROP POLICY IF EXISTS "Enable delete access for users based on user_id" ON customers;
CREATE POLICY "Enable delete access for users based on user_id" 
ON customers 
FOR DELETE 
TO public
USING (true);

-- Update events table policies to allow public access
DROP POLICY IF EXISTS "Enable insert access for authenticated users" ON events;
CREATE POLICY "Enable insert access for authenticated users" 
ON events 
FOR INSERT 
TO public
WITH CHECK (true);

DROP POLICY IF EXISTS "Enable update access for users based on user_id" ON events;
CREATE POLICY "Enable update access for users based on user_id" 
ON events 
FOR UPDATE 
TO public
USING (true);

DROP POLICY IF EXISTS "Enable delete access for users based on user_id" ON events;
CREATE POLICY "Enable delete access for users based on user_id" 
ON events 
FOR DELETE 
TO public
USING (true);