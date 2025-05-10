
-- Enable REPLICA IDENTITY FULL for the events table to capture full row data
ALTER TABLE events REPLICA IDENTITY FULL;

-- Enable REPLICA IDENTITY FULL for the customers table
ALTER TABLE customers REPLICA IDENTITY FULL;

-- Enable REPLICA IDENTITY FULL for the tasks table
ALTER TABLE tasks REPLICA IDENTITY FULL;

-- Enable REPLICA IDENTITY FULL for the event_files table
ALTER TABLE event_files REPLICA IDENTITY FULL;

-- Enable REPLICA IDENTITY FULL for the customer_files_new table
ALTER TABLE customer_files_new REPLICA IDENTITY FULL;

-- Enable REPLICA IDENTITY FULL for the files table
ALTER TABLE files REPLICA IDENTITY FULL;

-- Add all these tables to the realtime publication
BEGIN;
  -- Drop the publication if it exists
  DROP PUBLICATION IF EXISTS supabase_realtime;
  
  -- Create the publication with all the tables we want to track
  CREATE PUBLICATION supabase_realtime FOR TABLE
    events,
    customers,
    tasks,
    event_files,
    customer_files_new,
    files;
COMMIT;
