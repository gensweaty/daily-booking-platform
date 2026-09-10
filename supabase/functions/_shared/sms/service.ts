// SmartBookly-facing SMS service.
//
// Everything in the product calls sendSms() from here. It never throws into the
// caller: a failed SMS must never break a booking, reminder or CRM operation.

import { getProvider } from "./smsgate.ts";
import { normalizePhoneNumber, defaultCountryCodeForLanguage } from "./phone.ts";
import type { SmsCredentials, SmsPurpose, SmsStatus } from "./types.ts";

type Admin = any;

export interface SmsConfig {
  id: string;
  user_id: string;
  provider: string;
  base_url: string;
  username: string | null;
  password: string | null;
  access_token: string | null;
  refresh_token: string | null;
  token_expires_at: string | null;
  is_connected: boolean;
  sms_enabled: boolean;
  send_on_booking_confirmed: boolean;
  send_on_reminder: boolean;
  send_on_rescheduled: boolean;
  send_on_cancelled: boolean;
  routing_mode: string;
  preferred_device_id: string | null;
  preferred_sim_number: number | null;
  default_country_code: string;
  message_ttl_seconds: number;
  quiet_hours_start: string | null;
  quiet_hours_end: string | null;
  rate_limit_per_minute: number | null;
}

export async function getSmsConfig(admin: Admin, ownerId: string): Promise<SmsConfig | null> {
  const { data } = await admin
    .from("sms_provider_configs")
    .select("*")
    .eq("user_id", ownerId)
    .maybeSingle();
  return (data as SmsConfig) || null;
}

/** Returns credentials with a valid access token, refreshing/re-issuing when needed. */
export async function getCredentials(
  admin: Admin,
  cfg: SmsConfig,
): Promise<SmsCredentials | null> {
  const provider = getProvider(cfg.provider);
  const base = cfg.base_url;

  const expired = !cfg.access_token ||
    !cfg.token_expires_at ||
    new Date(cfg.token_expires_at).getTime() - Date.now() < 60_000;

  if (!expired) {
    return { baseUrl: base, accessToken: cfg.access_token };
  }

  // 1) try refresh
  if (cfg.refresh_token) {
    const refreshed = await provider.refreshTokens(base, cfg.refresh_token);
    if (refreshed) {
      await admin.from("sms_provider_configs").update({
        access_token: refreshed.accessToken,
        refresh_token: refreshed.refreshToken,
        token_expires_at: refreshed.expiresAt,
        updated_at: new Date().toISOString(),
      }).eq("id", cfg.id);
      cfg.access_token = refreshed.accessToken;
      cfg.token_expires_at = refreshed.expiresAt;
      return { baseUrl: base, accessToken: refreshed.accessToken };
    }
  }

  // 2) re-issue from stored username/password
  if (cfg.username && cfg.password) {
    const issued = await provider.issueTokens({
      baseUrl: base,
      username: cfg.username,
      password: cfg.password,
    });
    if (issued) {
      await admin.from("sms_provider_configs").update({
        access_token: issued.accessToken,
        refresh_token: issued.refreshToken,
        token_expires_at: issued.expiresAt,
        updated_at: new Date().toISOString(),
      }).eq("id", cfg.id);
      cfg.access_token = issued.accessToken;
      cfg.token_expires_at = issued.expiresAt;
      return { baseUrl: base, accessToken: issued.accessToken };
    }
    // Some deployments only support Basic auth — fall back to it.
    return { baseUrl: base, username: cfg.username, password: cfg.password };
  }

  return null;
}

function purposeEnabled(cfg: SmsConfig, purpose: SmsPurpose): boolean {
  switch (purpose) {
    case "booking_confirmed":
      return cfg.send_on_booking_confirmed;
    case "reminder":
      return cfg.send_on_reminder;
    case "rescheduled":
      return cfg.send_on_rescheduled;
    case "cancelled":
      return cfg.send_on_cancelled;
    default:
      return true; // test / manual are explicit user actions
  }
}

/** Minutes-since-midnight helper for "HH:MM" strings. */
function hm(v: string | null): number | null {
  if (!v) return null;
  const m = /^(\d{1,2}):(\d{2})$/.exec(v.trim());
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

export function isQuietHours(cfg: SmsConfig, now = new Date()): boolean {
  const start = hm(cfg.quiet_hours_start);
  const end = hm(cfg.quiet_hours_end);
  if (start === null || end === null || start === end) return false;
  const cur = now.getUTCHours() * 60 + now.getUTCMinutes();
  return start < end ? cur >= start && cur < end : cur >= start || cur < end;
}

export async function pickDevice(
  admin: Admin,
  cfg: SmsConfig,
): Promise<{ deviceId: string | null; simNumber: number | null }> {
  if (cfg.routing_mode === "fixed" && cfg.preferred_device_id) {
    return { deviceId: cfg.preferred_device_id, simNumber: cfg.preferred_sim_number ?? null };
  }
  const { data } = await admin
    .from("sms_devices")
    .select("external_id, is_online, last_seen_at")
    .eq("user_id", cfg.user_id)
    .eq("enabled", true)
    .order("is_online", { ascending: false })
    .order("last_seen_at", { ascending: false })
    .limit(1);
  const d = (data || [])[0];
  // No device id => the gateway picks one itself.
  return { deviceId: d?.external_id ?? null, simNumber: null };
}

export interface SendSmsArgs {
  ownerId: string;
  to: string | null | undefined;
  body: string;
  purpose: SmsPurpose;
  language?: string | null;
  eventId?: string | null;
  customerId?: string | null;
  bookingRequestId?: string | null;
  dedupeKey?: string | null;
  /** send later (RFC3339) — used for reminders */
  scheduledAt?: string | null;
  /** bypass the per-purpose toggle (test messages) */
  force?: boolean;
}

export interface SendSmsOutcome {
  ok: boolean;
  skipped?: string;
  messageId?: string;
  status?: SmsStatus;
  error?: string;
}

/**
 * Queue (and immediately attempt) an SMS. Never throws.
 */
export async function sendSms(admin: Admin, args: SendSmsArgs): Promise<SendSmsOutcome> {
  try {
    const cfg = await getSmsConfig(admin, args.ownerId);
    if (!cfg) return { ok: false, skipped: "not_configured" };
    if (!cfg.is_connected) return { ok: false, skipped: "not_connected" };
    if (!cfg.sms_enabled && !args.force) return { ok: false, skipped: "sms_disabled" };
    if (!purposeEnabled(cfg, args.purpose) && !args.force) {
      return { ok: false, skipped: "purpose_disabled" };
    }

    const cc = cfg.default_country_code || defaultCountryCodeForLanguage(args.language);
    const to = normalizePhoneNumber(args.to, cc);
    if (!to) return { ok: false, skipped: "invalid_number" };

    const body = (args.body || "").trim();
    if (!body) return { ok: false, skipped: "empty_body" };

    const nowIso = new Date().toISOString();
    const expiresAt = new Date(
      Date.now() + Math.max(60, cfg.message_ttl_seconds || 3600) * 1000,
    ).toISOString();

    const row = {
      user_id: args.ownerId,
      recipient: to,
      body,
      language: (args.language || "en").slice(0, 5),
      purpose: args.purpose,
      status: "queued",
      provider: cfg.provider,
      attempts: 0,
      next_attempt_at: args.scheduledAt || nowIso,
      scheduled_at: args.scheduledAt || null,
      expires_at: expiresAt,
      event_id: args.eventId || null,
      customer_id: args.customerId || null,
      booking_request_id: args.bookingRequestId || null,
      dedupe_key: args.dedupeKey || null,
    };

    const { data: inserted, error } = await admin
      .from("sms_messages")
      .insert(row)
      .select("*")
      .maybeSingle();

    if (error) {
      // unique violation on dedupe_key => the message already exists
      if (String(error.code) === "23505") return { ok: true, skipped: "duplicate" };
      return { ok: false, error: error.message };
    }

    // Scheduled or quiet hours: leave it for the dispatcher.
    if (args.scheduledAt && new Date(args.scheduledAt).getTime() > Date.now() + 30_000) {
      return { ok: true, messageId: inserted.id, status: "queued" };
    }
    if (isQuietHours(cfg) && args.purpose !== "test") {
      return { ok: true, messageId: inserted.id, status: "queued" };
    }

    const res = await dispatchMessage(admin, cfg, inserted);
    return { ok: res.ok, messageId: inserted.id, status: res.status, error: res.error };
  } catch (e) {
    console.error("sendSms error:", e);
    return { ok: false, error: String(e) };
  }
}

/** Attempt one queued message; updates the row with the outcome. Never throws. */
export async function dispatchMessage(
  admin: Admin,
  cfg: SmsConfig,
  msg: any,
): Promise<{ ok: boolean; status?: SmsStatus; error?: string }> {
  try {
    if (msg.expires_at && new Date(msg.expires_at).getTime() < Date.now()) {
      await admin.from("sms_messages").update({
        status: "expired",
        updated_at: new Date().toISOString(),
      }).eq("id", msg.id);
      return { ok: false, status: "expired", error: "expired" };
    }

    const creds = await getCredentials(admin, cfg);
    if (!creds) {
      await admin.from("sms_messages").update({
        status: "failed",
        error: "SMS gateway is not connected.",
        failed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).eq("id", msg.id);
      return { ok: false, status: "failed", error: "no_credentials" };
    }

    const provider = getProvider(cfg.provider);
    const { deviceId, simNumber } = await pickDevice(admin, cfg);

    const result = await provider.sendSms(creds, {
      to: msg.recipient,
      body: msg.body,
      deviceId,
      simNumber: simNumber ?? cfg.preferred_sim_number ?? null,
      validUntil: msg.expires_at || null,
    });

    const attempts = (msg.attempts || 0) + 1;

    if (result.ok) {
      await admin.from("sms_messages").update({
        status: result.status === "delivered" ? "delivered" : "sent",
        provider_message_id: result.providerMessageId,
        device_external_id: deviceId,
        sim_number: simNumber ?? cfg.preferred_sim_number ?? null,
        attempts,
        sent_at: new Date().toISOString(),
        error: null,
        updated_at: new Date().toISOString(),
      }).eq("id", msg.id);
      return { ok: true, status: "sent" };
    }

    const retryable = result.retryable !== false && attempts < 5;
    const backoffMs = Math.min(30 * 60_000, 60_000 * Math.pow(2, attempts - 1));

    await admin.from("sms_messages").update({
      status: retryable ? "queued" : "failed",
      attempts,
      next_attempt_at: new Date(Date.now() + backoffMs).toISOString(),
      error: result.error || "Send failed",
      failed_at: retryable ? null : new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq("id", msg.id);

    return { ok: false, status: retryable ? "queued" : "failed", error: result.error };
  } catch (e) {
    console.error("dispatchMessage error:", e);
    return { ok: false, error: String(e) };
  }
}

/** Cancel queued (not yet sent) messages tied to an event — used on reschedule/cancel. */
export async function cancelQueuedSmsForEvent(
  admin: Admin,
  ownerId: string,
  eventId: string,
  purposes: SmsPurpose[] = ["reminder"],
): Promise<number> {
  try {
    const { data } = await admin
      .from("sms_messages")
      .update({ status: "cancelled", updated_at: new Date().toISOString() })
      .eq("user_id", ownerId)
      .eq("event_id", eventId)
      .in("purpose", purposes)
      .eq("status", "queued")
      .select("id");
    return (data || []).length;
  } catch (e) {
    console.error("cancelQueuedSmsForEvent error:", e);
    return 0;
  }
}

// ── Templates ───────────────────────────────────────────────────────────

export const DEFAULT_TEMPLATES: Record<string, Record<string, string>> = {
  booking_confirmed: {
    en: "Hi {name}, your booking at {business} on {date} is confirmed. See you then!",
    ka: "გამარჯობა {name}, თქვენი ჯავშანი {business}-ში {date}-ზე დადასტურებულია.",
    es: "Hola {name}, tu reserva en {business} el {date} está confirmada.",
    ru: "Здравствуйте, {name}! Ваша запись в {business} на {date} подтверждена.",
  },
  reminder: {
    en: "Reminder: {title} on {date}. — {business}",
    ka: "შეხსენება: {title} — {date}. {business}",
    es: "Recordatorio: {title} el {date}. — {business}",
    ru: "Напоминание: {title} — {date}. {business}",
  },
  rescheduled: {
    en: "Hi {name}, your booking at {business} has moved to {date}.",
    ka: "გამარჯობა {name}, თქვენი ჯავშანი {business}-ში გადავიდა {date}-ზე.",
    es: "Hola {name}, tu reserva en {business} se ha movido al {date}.",
    ru: "Здравствуйте, {name}! Ваша запись в {business} перенесена на {date}.",
  },
  cancelled: {
    en: "Hi {name}, your booking at {business} on {date} has been cancelled.",
    ka: "გამარჯობა {name}, თქვენი ჯავშანი {business}-ში {date}-ზე გაუქმდა.",
    es: "Hola {name}, tu reserva en {business} el {date} ha sido cancelada.",
    ru: "Здравствуйте, {name}! Ваша запись в {business} на {date} отменена.",
  },
};

export function fillTemplate(tpl: string, vars: Record<string, string>): string {
  return tpl.replace(/\{(\w+)\}/g, (_m, k) => vars[k] ?? "");
}

export async function renderTemplate(
  admin: Admin,
  ownerId: string,
  purpose: SmsPurpose,
  language: string | null | undefined,
  vars: Record<string, string>,
): Promise<string> {
  const lang = (language || "en").slice(0, 2);
  try {
    const { data } = await admin
      .from("sms_templates")
      .select("body, language")
      .eq("user_id", ownerId)
      .eq("purpose", purpose);
    const custom = (data || []).find((t: any) => t.language === lang) ||
      (data || []).find((t: any) => t.language === "en");
    if (custom?.body) return fillTemplate(custom.body, vars);
  } catch { /* fall through to defaults */ }

  const set = DEFAULT_TEMPLATES[purpose] || DEFAULT_TEMPLATES.reminder;
  return fillTemplate(set[lang] || set.en, vars);
}
