
-- Phase 1: Database and Storage Alignment
-- Create missing storage buckets with proper configuration

-- Create task_attachments bucket for task files
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'task_attachments',
  'task_attachments', 
  true,
  52428800, -- 50MB limit
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'text/plain']
) ON CONFLICT (id) DO NOTHING;

-- Create event_attachments bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'event_attachments',
  'event_attachments',
  true,
  52428800, -- 50MB limit
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'text/plain']
) ON CONFLICT (id) DO NOTHING;

-- Create customer_attachments bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'customer_attachments',
  'customer_attachments',
  true,
  52428800, -- 50MB limit
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'text/plain']
) ON CONFLICT (id) DO NOTHING;

-- Create booking_attachments bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'booking_attachments',
  'booking_attachments',
  true,
  52428800, -- 50MB limit
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'text/plain']
) ON CONFLICT (id) DO NOTHING;

-- Create RLS policies for all storage buckets
-- Task attachments policies
CREATE POLICY "Allow authenticated users to upload task files" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'task_attachments' AND auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated users to view task files" ON storage.objects
  FOR SELECT USING (bucket_id = 'task_attachments' AND auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated users to delete task files" ON storage.objects
  FOR DELETE USING (bucket_id = 'task_attachments' AND auth.role() = 'authenticated');

-- Event attachments policies
CREATE POLICY "Allow authenticated users to upload event files" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'event_attachments' AND auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated users to view event files" ON storage.objects
  FOR SELECT USING (bucket_id = 'event_attachments' AND auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated users to delete event files" ON storage.objects
  FOR DELETE USING (bucket_id = 'event_attachments' AND auth.role() = 'authenticated');

-- Customer attachments policies
CREATE POLICY "Allow authenticated users to upload customer files" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'customer_attachments' AND auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated users to view customer files" ON storage.objects
  FOR SELECT USING (bucket_id = 'customer_attachments' AND auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated users to delete customer files" ON storage.objects
  FOR DELETE USING (bucket_id = 'customer_attachments' AND auth.role() = 'authenticated');

-- Booking attachments policies
CREATE POLICY "Allow authenticated users to upload booking files" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'booking_attachments' AND auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated users to view booking files" ON storage.objects
  FOR SELECT USING (bucket_id = 'booking_attachments' AND auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated users to delete booking files" ON storage.objects
  FOR DELETE USING (bucket_id = 'booking_attachments' AND auth.role() = 'authenticated');

-- Enable RLS on storage.objects if not already enabled
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Add source column to files table for better tracking
ALTER TABLE files ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'task';
ALTER TABLE files ADD COLUMN IF NOT EXISTS parent_type TEXT DEFAULT 'task';

-- Update existing task files to have proper source
UPDATE files SET source = 'task', parent_type = 'task' WHERE task_id IS NOT NULL AND source IS NULL;
