
REVOKE SELECT ON public.notes FROM anon;
REVOKE SELECT ON public.reminders FROM anon;
REVOKE SELECT ON public.reminder_entries FROM anon;
REVOKE SELECT ON public.subscriptions FROM anon;
REVOKE SELECT ON public.public_board_access FROM anon;
REVOKE SELECT ON public.ai_context_memories FROM anon;
REVOKE SELECT ON public.render_tokens FROM anon, authenticated;
REVOKE SELECT ON public.telegram_bot_configs FROM anon;
REVOKE SELECT ON public.telegram_bot_state FROM anon, authenticated;
REVOKE SELECT ON public.telegram_messages FROM anon;
REVOKE SELECT ON public.scheduled_emails FROM anon;
REVOKE SELECT ON public."Stripe cusotmers" FROM anon, authenticated;

DO $do$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prosecdef
      AND p.proname IN ('activate_subscription','create_subscription','check_and_lock_redeem_code',
                        'validate_and_use_redeem_code','check_subscription_status','check_trial_status')
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM anon', r.sig);
  END LOOP;
END
$do$;
