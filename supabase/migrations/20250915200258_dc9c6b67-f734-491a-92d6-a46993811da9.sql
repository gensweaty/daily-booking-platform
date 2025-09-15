-- Add public storage access policies for external board users
-- This allows external users to view files in customer_attachments and event_attachments buckets

-- Policy for customer_attachments bucket (for public board external users)
INSERT INTO storage.policies (id, name, bucket_id, policy_role, policy_cmd, policy_qual)
VALUES (
  'customer_attachments_public_board_access',
  'Public board users can view customer attachments',
  'customer_attachments',
  'anon',
  'SELECT',
  '(bucket_id = ''customer_attachments'')'
) ON CONFLICT (id) DO NOTHING;

-- Policy for event_attachments bucket (for public board external users) 
INSERT INTO storage.policies (id, name, bucket_id, policy_role, policy_cmd, policy_qual)
VALUES (
  'event_attachments_public_board_access', 
  'Public board users can view event attachments',
  'event_attachments',
  'anon',
  'SELECT',
  '(bucket_id = ''event_attachments'')'
) ON CONFLICT (id) DO NOTHING;