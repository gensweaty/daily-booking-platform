-- Enable RLS on storage.objects table (critical security fix)
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;