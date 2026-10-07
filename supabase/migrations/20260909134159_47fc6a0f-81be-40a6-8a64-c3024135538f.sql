
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.sms_provider_configs FROM authenticated;

GRANT SELECT (
  id, user_id, provider, base_url, is_connected, last_verified_at, last_error,
  sms_enabled, send_on_booking_confirmed, send_on_reminder, send_on_rescheduled,
  send_on_cancelled, routing_mode, preferred_device_id, preferred_sim_number,
  default_country_code, message_ttl_seconds, quiet_hours_start, quiet_hours_end,
  rate_limit_per_minute, created_at, updated_at
) ON public.sms_provider_configs TO authenticated;

GRANT UPDATE (
  sms_enabled, send_on_booking_confirmed, send_on_reminder, send_on_rescheduled,
  send_on_cancelled, routing_mode, preferred_device_id, preferred_sim_number,
  default_country_code, message_ttl_seconds, quiet_hours_start, quiet_hours_end,
  rate_limit_per_minute
) ON public.sms_provider_configs TO authenticated;
