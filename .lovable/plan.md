# Restore CRM visibility and SmartBookly AI safely

## Goal
Restore the pre-feature behavior of CRM, calendar/customer details, and SmartBookly AI without changing or deleting existing business data or weakening any core workflow.

## Confirmed findings
- Customer and event data still exists in Supabase. The issue is not a bulk deletion caused by the email feature.
- The personalized-email feature only reads customer fields, uploads email attachments, and invokes its own sender function; it does not update customers, events, tasks, bookings, business profiles, or statistics.
- SmartBookly AI currently calls Lovable AI Gateway with an incompatible authentication header. Telegram receives the resulting non-success response and replaces it with the generic “could not process” message.
- Some optimized CRM projections omit fields such as comments and event contact details. Any view using those projections can appear as though values were erased even though the database rows remain complete.

## Implementation
1. **Repair AI gateway connectivity**
   - Centralize gateway request headers so every AI call uses the required `Lovable-API-Key` header consistently.
   - Keep the current Gemini 3.1 Flash-Lite primary model and existing tool definitions, context, file analysis, and action guards unchanged.
   - Preserve real gateway status/message details through `ai-chat`; make Telegram show an actionable error instead of masking every failure.
   - Add bounded retry only for 429 and 5xx responses; do not retry terminal 400/401/402/403 failures.

2. **Restore complete CRM/calendar projections**
   - Add all existing customer/event display and edit fields to optimized query projections, especially comments, phone, email/social link, surname, type, and payment data.
   - Replace attachment `inner` joins where they can hide records without files.
   - Do not alter database rows, schemas, dates, filters, deduplication rules, or delete/update behavior.

3. **Isolate the new email feature**
   - Keep the composer as an additive selection action only.
   - Ensure opening, editing, or closing it cannot mutate selected CRM records.
   - Keep bulk delete and all existing CRM actions on their original paths.

4. **Regression validation**
   - Test the deployed `ai-chat` function with a harmless greeting and a read-only request, then verify one tool-backed reminder request does not falsely claim success.
   - Verify Telegram receives the AI response through the existing poll path.
   - Validate representative populated customer and event rows against the fields shown in CRM and calendar edit/preview surfaces.
   - Run focused app checks for CRM, calendar, tasks, statistics, business profile, existing email sending, and the new personalized-email dialog; no destructive test actions.

## Safety constraints
- No data migration, bulk update, cleanup, restore, or deletion.
- No changes to customer/event/task/booking ownership or access rules.
- No replacement of existing email/reminder/business/statistics logic.
- If validation exposes an unrelated pre-existing defect, stop and report it rather than expanding scope silently.
