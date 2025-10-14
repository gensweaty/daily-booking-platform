-- Add language column to custom_reminders table to store the language the reminder was created in
ALTER TABLE custom_reminders 
ADD COLUMN IF NOT EXISTS language text DEFAULT 'en';

COMMENT ON COLUMN custom_reminders.language IS 'Language code (en/ka/es/ru) - stores the language the user was speaking when creating the reminder for proper email localization';