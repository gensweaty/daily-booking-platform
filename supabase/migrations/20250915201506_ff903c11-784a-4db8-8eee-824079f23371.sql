-- Add storage policies to allow external board users to upload files
-- Allow authenticated users who are sub-users of public boards to upload to customer_attachments
CREATE POLICY "Sub-users can upload to customer attachments" 
ON storage.objects 
FOR INSERT 
WITH CHECK (
  bucket_id = 'customer_attachments' 
  AND auth.uid() IN (
    SELECT su.id 
    FROM sub_users su 
    JOIN public_boards pb ON su.board_owner_id = pb.user_id 
    WHERE pb.is_active = true
  )
);

-- Allow authenticated users who are sub-users of public boards to upload to event_attachments  
CREATE POLICY "Sub-users can upload to event attachments"
ON storage.objects
FOR INSERT  
WITH CHECK (
  bucket_id = 'event_attachments'
  AND auth.uid() IN (
    SELECT su.id 
    FROM sub_users su 
    JOIN public_boards pb ON su.board_owner_id = pb.user_id 
    WHERE pb.is_active = true
  )
);