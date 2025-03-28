
-- Check if the bucket already exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM storage.buckets WHERE id = 'business_covers'
  ) THEN
    -- Create the business_covers bucket if it doesn't exist
    INSERT INTO storage.buckets (id, name, public)
    VALUES ('business_covers', 'Business Covers', true);
    
    -- Add policies to allow authenticated users to upload and access files
    INSERT INTO storage.policies (name, bucket_id, definition, operation)
    VALUES 
      ('Business cover upload policy', 'business_covers', '(auth.role() = ''authenticated'')', 'INSERT'),
      ('Business cover select policy', 'business_covers', '(true)', 'SELECT');
  END IF;
END
$$;
