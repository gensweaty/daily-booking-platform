# Server-side screenshots: SmartBookly AI opens its own browser

Today the bot can only capture a screenshot if your dashboard is already open in a browser tab. The goal is for the AI to open a browser **itself**, log in as you, capture the page, and send it to Telegram — even when you are offline.

Supabase Edge Functions run in a lightweight Deno isolate and cannot start Chromium. So "our own Chromium" has to live somewhere that can run a real browser. The free option that fits best is **Cloudflare Browser Rendering** on the Workers free plan: a real headless Chromium we control, no credit card, 10 minutes of browser time per day (roughly 100-150 screenshots), 3 concurrent sessions.

## How it works

```text
Telegram  ->  ai-chat  ->  capture-screenshot (edge fn)
                                 |
                                 |  1. mint one-time render token (60s, single use, bound to your user id)
                                 |  2. POST render URL to our Cloudflare Worker
                                 v
                         Cloudflare Worker (our Chromium)
                                 |  3. opens https://smartbookly.../render/<token>
                                 |  4. waits for full paint, captures full-page PNG
                                 v
                         back to capture-screenshot
                                 |  5. upload PNG to Supabase storage
                                 |  6. send photo into Telegram + AI chat
```

## Pieces to build

1. **`render_tokens` table** — token hash, user_id, page hint, popup target, expires_at (60s), used_at. Single use, service-role only, no anon access.

2. **`/render/:token` route (read-only)** — a stripped dashboard shell with no navigation, no buttons, no mutations. It calls a new `render-session` edge function that validates the token and returns the data for the requested section (tasks, calendar, CRM, statistics) scoped to your user id. The token can only read; it can never edit or delete. Sub-users get only their own view.

3. **Cloudflare Worker (`smartbookly-render`)** — small Worker using the Browser Rendering binding: takes `{url, width, height, fullPage}`, returns PNG bytes. Protected by a shared secret so only our edge functions can call it.

4. **`capture-screenshot` edge function** — mints the token, calls the Worker, stores the PNG, delivers it to Telegram and the AI chat, and updates the `screenshot_requests` row.

5. **`ai-chat` change** — `request_screenshot` now calls `capture-screenshot` directly instead of only queueing a browser-tab job. If the Worker is unavailable or the daily free quota is used up, it falls back to the existing browser-tab capture, and only then tells you to open the dashboard.

## Security

- Render tokens are single-use, expire in 60 seconds, and are stored hashed.
- The render route is read-only by construction — no write endpoints are reachable from it.
- The Worker only accepts our render URLs and requires a shared secret.
- Sub-users can only ever render their own view; the token carries the identity.

## What is needed from you

A free Cloudflare account. I will give you the Worker code and the exact deploy steps, then you paste back the Worker URL; I store it plus the shared secret as secrets. Everything else is built in this project.

## Fallback kept

Browser-tab capture stays in place as the second path, so nothing that works today stops working.
