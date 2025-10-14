-- Add AI tracking flags to tasks, events, and customers tables
ALTER TABLE tasks 
ADD COLUMN IF NOT EXISTS created_by_ai boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS last_edited_by_ai boolean DEFAULT false;

ALTER TABLE events 
ADD COLUMN IF NOT EXISTS created_by_ai boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS last_edited_by_ai boolean DEFAULT false;

ALTER TABLE customers 
ADD COLUMN IF NOT EXISTS created_by_ai boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS last_edited_by_ai boolean DEFAULT false;