
-- Add color column to notes table
ALTER TABLE notes ADD COLUMN IF NOT EXISTS color VARCHAR(255);

-- Create events table
CREATE TABLE IF NOT EXISTS events (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    start_date TIMESTAMP WITH TIME ZONE NOT NULL,
    end_date TIMESTAMP WITH TIME ZONE NOT NULL,
    location VARCHAR(255),
    type VARCHAR(50) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    user_id UUID REFERENCES auth.users(id)
);

-- Add RLS policies for events table
ALTER TABLE events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read access for authenticated users" ON events
    FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

CREATE POLICY "Enable insert access for authenticated users" ON events
    FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Enable update access for users based on user_id" ON events
    FOR UPDATE
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Enable delete access for users based on user_id" ON events
    FOR DELETE
    TO authenticated
    USING (auth.uid() = user_id);

-- Add foreign key reference for event_files table to booking_requests
ALTER TABLE event_files 
DROP CONSTRAINT IF EXISTS event_files_event_id_fkey,
ADD CONSTRAINT event_files_event_id_fkey 
FOREIGN KEY (event_id) 
REFERENCES events(id) 
ON DELETE CASCADE;

-- Add additional constraint to allow booking_requests IDs
-- First create a function to validate event_id exists in either events or booking_requests
CREATE OR REPLACE FUNCTION validate_event_id()
RETURNS TRIGGER AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM events WHERE id = NEW.event_id) THEN
    RETURN NEW;
  ELSIF EXISTS (SELECT 1 FROM booking_requests WHERE id = NEW.event_id) THEN
    RETURN NEW;
  ELSE
    RAISE EXCEPTION 'Event ID must exist in either events or booking_requests table';
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to validate event_id before insert or update
CREATE TRIGGER validate_event_id_trigger
BEFORE INSERT OR UPDATE ON event_files
FOR EACH ROW EXECUTE FUNCTION validate_event_id();

