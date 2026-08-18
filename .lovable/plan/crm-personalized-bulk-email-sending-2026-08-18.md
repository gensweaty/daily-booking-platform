# CRM: Personalized Bulk Email Sending

## What you get

When you select one, several, or all customers in CRM, a new **Email** button appears next to the Delete button. Clicking it opens a full email composer popup.

### Composer
- **To** field: pre-filled with the selected customers' emails as editable chips (remove, add manually, duplicates and customers without email are filtered out with a notice).
- **Cc** and **Bcc** fields (Bcc collapsible), plus **Reply-to** defaults to your account email.
- **Subject** field (supports personalization tags too).
- **Rich editor** with modern controls: bold/italic/underline, headings, lists, quotes, links, text align, colors, horizontal rule, inline images (upload or paste), tables, and a **Source/HTML** toggle so you can paste raw HTML.
- **Personalization**: type `@` in subject or body to get a dropdown of merge tags — `@full_name`, `@surname`, `@email`, `@phone`, `@comment`, `@payment_status`, `@payment_amount`, `@event_date`, `@social_link`. Each recipient gets their own values substituted at send time. Empty values fall back to a safe default (e.g. blank or "there" for name) so no email says "Hi @full_name".
- **Preview** toggle: shows the email rendered exactly as the first selected recipient will receive it, with a recipient switcher.
- **Attachments**: drag-drop / paste / browse. Images, videos, documents, archives — any type. Up to **100 MB total** per send.
- **Send** shows a per-recipient progress bar and a final summary (sent / failed, with reason).

### Attachments over the email limit
Email providers reject messages over ~40 MB, so files are handled in two tiers automatically:
- Total attachments up to 20 MB: attached directly to the email.
- Anything above that: uploaded to your project storage and inserted into the email as a clean "Attached files" download block with expiring secure links. The UI tells you which files became links, so there is no surprise.

### Deliverability (avoiding spam)
- Sent one message per recipient (never one message with 50 people in To) — personalized and not flagged as bulk.
- From stays `Your Name via SmartBookly <noreply@smartbookly.com>` on the verified domain; your real address goes in Reply-To (same pattern already used by direct emails, which keeps SPF/DKIM/DMARC aligned).
- Every email includes: a plain-text alternative auto-generated from the HTML, a `List-Unsubscribe` header, unique `X-Entity-Ref-ID`, and a valid physical/sender footer.
- Sends are throttled (small delay + batching) to avoid rate spikes that damage domain reputation.
- Client-side validation of every address before sending; invalid ones are surfaced, not sent.

## Technical section

**Frontend**
- New `src/components/crm/EmailComposerDialog.tsx` — recipient chips, Cc/Bcc, subject, TipTap-based editor (extended config: Image, Link, Table, TextAlign, Color, Underline + HTML source view), `@` mention extension backed by the merge-tag list, preview mode, send progress.
- New `src/components/crm/emailMergeTags.ts` — tag definitions and a `renderTemplate(html, customer)` function mapping tags to `customers` columns (`title`, `user_surname`, `user_number`, `event_notes`, `payment_status`, `payment_amount`, `start_date`, `social_network_link`).
- `CustomerList.tsx`: add an Email button beside the existing bulk-delete button (shown when `selectedCustomerIds.size > 0`), passing the selected customer rows. Mirror the same button into `PublicCRMList.tsx` only if the sub-user has CRM permission.
- Reuse `AttachmentDropzone` with per-instance overrides for max size (100 MB total) and unrestricted mime types.

**Backend**
- New edge function `send-crm-bulk-email`: validates JWT, validates payload with zod (recipients, subject, html, attachments metadata), enforces 100 MB total, renders per-recipient personalization server-side as a second safety pass, generates the text alternative, uploads oversized attachments to a private storage bucket and creates signed URLs, then sends via Resend one call per recipient with a short delay between batches. Returns per-recipient results.
- New private storage bucket `email-attachments` with RLS scoped to `auth.uid()`; links are signed with a 30-day expiry.
- No changes to `send-direct-email` or any existing email flow.

**Scope guarantee**: no changes to existing CRM data logic, delete flow, filters, pagination, or other email functions — only additive files plus the toolbar button.
