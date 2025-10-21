-- Add recipient tracking to custom_reminders for customer/event person reminders
ALTER TABLE custom_reminders 
ADD COLUMN IF NOT EXISTS recipient_email TEXT,
ADD COLUMN IF NOT EXISTS recipient_customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS recipient_event_id UUID REFERENCES events(id) ON DELETE SET NULL;

COMMENT ON COLUMN custom_reminders.recipient_email IS 'Email address to send reminder to - if NULL, sends to admin';
COMMENT ON COLUMN custom_reminders.recipient_customer_id IS 'Customer ID if reminder is for a customer';
COMMENT ON COLUMN custom_reminders.recipient_event_id IS 'Event ID if reminder is for an event person';