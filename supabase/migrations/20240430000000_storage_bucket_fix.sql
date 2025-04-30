
-- Create an RPC function to add a public policy to an existing bucket
CREATE OR REPLACE FUNCTION create_public_bucket_policy(bucket_name TEXT)
RETURNS VOID AS $$
BEGIN
  -- Insert policy for public SELECT access
  INSERT INTO storage.policies (name, definition, bucket_id)
  VALUES 
    ('Public Read Access', '(bucket_id = ''' || bucket_name || ''')::text', bucket_name)
  ON CONFLICT DO NOTHING;
  
  -- Set bucket to public
  UPDATE storage.buckets 
  SET public = TRUE 
  WHERE name = bucket_name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Ensure event_attachments bucket exists and is public
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM storage.buckets WHERE name = 'event_attachments') THEN
    INSERT INTO storage.buckets (id, name, public, avif_autodetection, file_size_limit, allowed_mime_types)
    VALUES ('event_attachments', 'event_attachments', TRUE, FALSE, 50000000, NULL);
    
    -- Add policy for public access
    PERFORM create_public_bucket_policy('event_attachments');
  END IF;
END $$;

-- Ensure note_attachments bucket exists and is public
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM storage.buckets WHERE name = 'note_attachments') THEN
    INSERT INTO storage.buckets (id, name, public, avif_autodetection, file_size_limit, allowed_mime_types)
    VALUES ('note_attachments', 'note_attachments', TRUE, FALSE, 50000000, NULL);
    
    -- Add policy for public access
    PERFORM create_public_bucket_policy('note_attachments');
  END IF;
END $$;

-- Ensure customer_attachments bucket exists and is public
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM storage.buckets WHERE name = 'customer_attachments') THEN
    INSERT INTO storage.buckets (id, name, public, avif_autodetection, file_size_limit, allowed_mime_types)
    VALUES ('customer_attachments', 'customer_attachments', TRUE, FALSE, 50000000, NULL);
    
    -- Add policy for public access
    PERFORM create_public_bucket_policy('customer_attachments');
  END IF;
END $$;

-- Ensure task_attachments bucket exists and is public
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM storage.buckets WHERE name = 'task_attachments') THEN
    INSERT INTO storage.buckets (id, name, public, avif_autodetection, file_size_limit, allowed_mime_types)
    VALUES ('task_attachments', 'task_attachments', TRUE, FALSE, 50000000, NULL);
    
    -- Add policy for public access
    PERFORM create_public_bucket_policy('task_attachments');
  END IF;
END $$;

-- Make sure all existing buckets are public
UPDATE storage.buckets
SET public = TRUE
WHERE name IN ('event_attachments', 'note_attachments', 'customer_attachments', 'task_attachments');
