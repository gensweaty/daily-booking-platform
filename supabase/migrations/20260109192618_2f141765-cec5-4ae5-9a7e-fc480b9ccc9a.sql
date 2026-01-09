-- Add working hours columns to business_profiles table
ALTER TABLE public.business_profiles
ADD COLUMN IF NOT EXISTS working_hours JSONB DEFAULT NULL;

-- The working_hours JSON structure will be:
-- {
--   "enabled": false,  -- If false, all times are available
--   "timezone": "Europe/Paris",
--   "days": {
--     "monday": { "enabled": true, "start": "09:00", "end": "18:00" },
--     "tuesday": { "enabled": true, "start": "09:00", "end": "18:00" },
--     "wednesday": { "enabled": true, "start": "09:00", "end": "18:00" },
--     "thursday": { "enabled": true, "start": "09:00", "end": "18:00" },
--     "friday": { "enabled": true, "start": "09:00", "end": "18:00" },
--     "saturday": { "enabled": false, "start": "09:00", "end": "18:00" },
--     "sunday": { "enabled": false, "start": "09:00", "end": "18:00" }
--   }
-- }

COMMENT ON COLUMN public.business_profiles.working_hours IS 'JSON containing working days and hours configuration for the business';