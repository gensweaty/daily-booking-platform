
# Safe Database Cleanup Plan — Trim Log Bloat to 7-Day Retention

## Goal
Reduce DB from **2.78 GB → ~100 MB** by removing log/cache bloat ONLY. No app tables touched. No functionality changed. Then keep it lean forever with a 7-day retention cron.

## Safety Guarantees (read first)
- **Zero app data is touched.** Only system/log tables are pruned: `cron.job_run_details`, `net._http_response`, `supabase_functions.hooks`.
- **No schema changes** to any `public.*` table. No edge function changes. No RLS changes.
- **No cron job is deleted or disabled** — every scheduled job keeps running exactly as today (reminders, Telegram polling, Stripe sync, etc.).
- **Everything is reversible** in concept (these are log/cache rows, not business records). But to be extra safe, we will export a backup of each table to `/mnt/documents/` as CSV **before** deleting anything, so you have a downloadable copy.
- Done in **small batches** with `DELETE` instead of `TRUNCATE` first, so locks are short and the DB stays responsive.

## What Gets Cleaned (and why each is safe)

| Table | Size | What it stores | Safe to prune? |
|---|---|---|---|
| `cron.job_run_details` | 1,180 MB | History of every pg_cron job run (success/fail logs). Postgres/Supabase **does not read this back** to schedule future jobs — purely audit. | ✅ Yes. Cron jobs keep firing on schedule. |
| `net._http_response` | 1,104 MB | Cache of HTTP response bodies from `pg_net` calls. **Live rows: 0** — pure dead tuples. | ✅ Yes. pg_net does not need history to make new calls. |
| `supabase_functions.hooks` | 427 MB | Webhook trigger queue/log (2.9M rows). Rows older than a few minutes are already processed. | ✅ Yes, keep last 7 days. |

**NOT touched:** every `public.*` table (events, customers, chat_messages, reminders, notes, tasks, profiles, sub_users, business_profiles, etc.), storage buckets, auth.users, edge functions, secrets, cron schedules.

## Execution Order (4 steps, each a separate migration so you approve one at a time)

### Step 1 — Backup snapshot (read-only, no risk)
Export current row counts + a 1000-row sample of each target table to `/mnt/documents/` so you have evidence of what existed before. Pure SELECT, no writes.

### Step 2 — One-time cleanup migration
```text
-- cron.job_run_details: keep last 7 days
DELETE FROM cron.job_run_details WHERE end_time < now() - interval '7 days';

-- net._http_response: 0 live rows anyway, full clear
TRUNCATE net._http_response;

-- supabase_functions.hooks: keep last 7 days
DELETE FROM supabase_functions.hooks WHERE created_at < now() - interval '7 days';

-- Reclaim disk
VACUUM (ANALYZE) cron.job_run_details;
VACUUM (ANALYZE) net._http_response;
VACUUM (ANALYZE) supabase_functions.hooks;
```
Run during low traffic. No locks on app tables. Expected runtime: 1–3 minutes.

### Step 3 — Verify (read-only)
- Re-query DB size and per-table size.
- Spot-check that app still works: open dashboard, send a chat message, create a reminder, trigger a booking. (You do this in the preview — I do not touch app code.)
- Confirm cron jobs still firing: `SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 10;`

### Step 4 — Install a daily 7-day retention cron (prevents bloat from coming back)
Adds ONE new pg_cron job that runs nightly at 03:00 UTC and re-applies the same DELETEs. Existing crons untouched.
```text
SELECT cron.schedule(
  'retention-cleanup-daily',
  '0 3 * * *',
  $$
    DELETE FROM cron.job_run_details WHERE end_time < now() - interval '7 days';
    DELETE FROM supabase_functions.hooks WHERE created_at < now() - interval '7 days';
    DELETE FROM net._http_response WHERE created < now() - interval '1 day';
  $$
);
```

## What This Does NOT Decide
- **Does NOT downgrade your Supabase plan.** You decide that later in the Supabase dashboard after seeing the freed space. This plan only makes downgrade *possible* and keeps the DB healthy regardless.
- **Does NOT change any edge function, AI prompt, or frontend code.**

## Expected Result
- DB size: **~2,785 MB → ~100 MB**
- App behavior: identical
- Future growth: capped at 7 days of logs (~10–30 MB steady state)
- You can downgrade to Free safely whenever you want, OR stay on Pro with a much cheaper/faster DB

## Rollback
If anything looks off after Step 2, there is nothing to roll back at the app level — only log rows were removed and the app does not read them. The CSV snapshots from Step 1 remain in `/mnt/documents/` as evidence.

---
Reply **"approve"** to switch to build mode and run Step 1 (backup) + Step 2 (cleanup). Steps 3 and 4 follow after you confirm the app still works.
