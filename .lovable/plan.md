# SMS Gateway (SMSGate) integration for SmartBookly

Adds real SMS sending to SmartBookly through an Android phone running the "SMS Gateway for Android" app in Public Cloud mode, wired in as a reusable internal service — not as one-off code scattered across booking, CRM and reminders.

## What the administrator will do

1. Install SMS Gateway for Android on a phone, allow SMS permissions, switch on Cloud Server, put it Online.
2. Copy the username and password the app shows.
3. In SmartBookly open **Business → Integrations → SMS Gateway**, paste them, press **Connect**.
4. SmartBookly verifies the credentials, lists the connected phones and their SIM cards, and shows online status.
5. Send a test SMS and watch it move through Queued → Sent → Delivered.
6. Switch on the SMS notifications wanted (confirmation, reminder, rescheduled, cancelled).

Changing phones later is done entirely on this page — no code, no environment variables.

## The page

Placed as a new **Integrations** section on the existing Business tab (the same place business contact settings already live), with a shortcut from the chat sidebar next to the Telegram connect button.

- **Connection** — Connected/Disconnected badge, Connect form, Disconnect / Reconnect, last verified time.
- **Devices** — auto-discovered Android devices, online/last-seen, SIM cards where reported, "Automatic" routing by default with an optional fixed device/SIM.
- **Test** — phone number, message, Send Test SMS, live status chip.
- **Notifications** — master on/off plus per-event toggles for booking confirmed, reminder, rescheduled, cancelled. These reuse the existing reminder timings; no parallel reminder engine.
- **History** — recent messages with recipient, status, related booking/customer, failure reason, retry.
- **Advanced** (collapsed) — sender device rotation, message TTL, quiet hours, per-minute rate limit, provider mode (Public Cloud now; Private/self-hosted later).

## Technical design

### Data (new tables, RLS scoped to the owner)

- `sms_provider_configs` — one row per SmartBookly account: provider (`smsgate_cloud`), base URL, credential reference, JWT access/refresh tokens + expiry, enabled flags, routing preference, advanced settings, webhook id/secret, last verification result.
- `sms_devices` — discovered devices per account: external device id, name, last seen, online flag, SIM info, enabled for routing.
- `sms_messages` — outbox/history: owner, recipient, body, language, status (`queued|sending|sent|delivered|failed|expired|cancelled`), provider message id, device/SIM used, attempt count, next retry, error, plus `event_id`, `customer_id`, `booking_request_id`, `purpose` (confirmation/reminder/reschedule/cancellation/test/manual) and a `dedupe_key` unique index that makes duplicate sends impossible.
- `sms_templates` — per-account, per-language message text for each purpose, seeded with English/Georgian/Spanish/Russian defaults; Unicode-safe.

Credentials are never stored in the browser. The Android username/password is written server-side only and immediately exchanged for scoped JWT tokens (`messages:send`, `messages:read`, `devices:list`, `webhooks:*`), refreshed automatically by the backend.

### Provider abstraction

New shared module `supabase/functions/_shared/sms/`:

- `types.ts` — `SmsProvider` interface: `sendSms`, `getSmsStatus`, `getDevices`, `verifyCredentials`, `registerWebhook`.
- `smsgate.ts` — the only file that knows SMSGate specifics: `POST /3rdparty/v1/messages` with `textMessage.text`, `phoneNumbers`, optional `deviceId`/`simNumber`, `validUntil`, `priority`; `GET /3rdparty/v1/messages/{id}`; `GET /3rdparty/v1/devices`; `POST /3rdparty/v1/auth/token` and `/auth/token/refresh`; webhook registration.
- `service.ts` — SmartBookly-facing `sendSms({ ownerId, to, body, purpose, relatedIds, dedupeKey })`: checks the master switch, normalises the phone number, records a `sms_messages` row, picks a healthy device, dispatches, and returns without ever throwing into the caller.

Swapping SMSGate for another provider later means adding one file next to `smsgate.ts`.

### Edge Functions

- `sms-admin` — status, connect (verify + token exchange + webhook registration), disconnect, list/refresh devices, send test, list history, retry, save settings/templates. The only function the frontend talks to; requires the caller's Supabase session.
- `sms-webhook` (public, signature-verified) — receives `sms:sent`, `sms:delivered`, `sms:failed` and updates `sms_messages`.
- `sms-dispatch` (cron, every minute) — drains queued messages, retries temporary failures with backoff, expires messages past TTL, and polls status for anything the webhook missed. This is what keeps an offline phone from blocking anything.

### Hooking into existing flows (additive only)

- **Booking approved** — inside the existing `_shared/bookingActions.ts` approve path, after the email step, one `sendSms` call in a try/catch. Booking success never depends on it.
- **Reminders** — `process-reminders` gains an SMS branch alongside the existing email and Telegram branches, using the reminder times already in the system.
- **Rescheduled / cancelled** — when an event's time changes or it is soft-deleted, queued-but-unsent reminder SMS for that event are cancelled, and a reschedule/cancellation SMS is queued if enabled. Recurring events are matched by their existing instance identity; the recurrence logic itself is untouched.
- **CRM** — recipient numbers come from the phone fields already on customers, events and booking requests.

Frontend touches are limited to the new Integrations UI and a small `useSmsGateway` hook; no SMS code enters EventDialog, CRM or booking components.

## Limits of version 1

- Public Cloud mode only (Private/self-hosted is a config switch left for later).
- Outgoing SMS only — incoming SMS and MMS are not handled.
- Delivery status depends on what the carrier and handset report; some networks only confirm "sent".
- SMS cost and carrier limits are whatever the SIM's plan allows; rate limiting is available under Advanced.
