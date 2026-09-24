# Owner-specific booking notification wording

## Goal
Keep every existing email and SMS trigger unchanged, while making business-owner messages clearly different from customer confirmations in English, Spanish, and Georgian.

## Changes
- Leave all customer-facing email and SMS wording unchanged.
- Give owner email copies their own subject, heading, introduction, and closing:
  - dashboard-created events: “New booking added”
  - approved requests: “Booking approved”
- Keep the existing owner detail list for customer name, event, email, phone, date/time, payment, and notes.
- Revise the default owner SMS template so it addresses the owner and describes a new or updated booking, while retaining all current detail tags.
- Preserve saved/custom SMS templates exactly as they are; users can continue editing them in SMS Settings.

## Technical details
- Generate owner-only email content separately inside the existing booking email sender rather than appending details to the customer email.
- Reuse the current language and source values; do not change recipients, triggers, settings, database, or delivery behavior.
- Verify type checking and the preview build log after the edits.
