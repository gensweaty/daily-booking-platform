-- Add a UNIQUE constraint to the email column in the subscriptions table.
-- This is to support the ON CONFLICT(email) clause used in the verify-stripe-subscription Edge Function,
-- which is the source of the "42P10" error ("no unique or exclusion constraint matching the ON CONFLICT specification").
--
-- IMPORTANT: Before applying this migration, ensure that there are no existing duplicate email values
-- in the 'public.subscriptions' table. If duplicates exist, this migration will fail.
-- Duplicate emails must be resolved manually (e.g., by updating or deleting records) before this constraint can be added.

ALTER TABLE public.subscriptions
ADD CONSTRAINT subscriptions_email_unique UNIQUE (email);

-- Note on user_id constraint:
-- The Supabase function at 'supabase/functions/stripe-webhook/index.ts' (which might be an older or alternative webhook)
-- uses 'ON CONFLICT (user_id)'. If 'user_id' is also intended to be a unique identifier for a user's subscription,
-- a unique constraint should exist on 'user_id' as well.
-- If such a constraint is needed and does not exist, it can be added with a command like:
--
-- ALTER TABLE public.subscriptions
-- ADD CONSTRAINT subscriptions_user_id_unique UNIQUE (user_id);
--
-- Again, ensure no duplicate 'user_id' values exist before applying such a constraint.
-- For this migration, we are only adding the 'email' constraint as it directly addresses the error in 'verify-stripe-subscription'.
