# Attachment security implementation baseline

Snapshot: 2026-11-16. This milestone changes no live storage policies, buckets, file paths, records, or frontend callers. The isolated authorization foundation is not an applied security fix.

## Existing object inventory

These are server-side aggregate counts, not a download of private file contents. Aggregate SQL counts are not subject to the Data API's 1,000-row result cap. A complete per-object ownership map remains necessary before any cutover.

| Bucket | Objects | Without storage owner | Nested paths |
|---|---:|---:|---:|
| avatars | 9 | 0 | 9 |
| booking_attachments | 191 | 171 | 121 |
| business_covers | 15 | 0 | 0 |
| business_photos | 1 | 0 | 0 |
| chat_attachments | 251 | 90 | 50 |
| chat-avatars | 3 | 0 | 0 |
| customer_attachments | 156 | 1 | 106 |
| email-attachments | 9 | 0 | 9 |
| event_attachments | 480 | 7 | 251 |
| excel-reports | 8 | 8 | 8 |
| screenshots | 9 | 0 | 9 |
| task_attachments | 69 | 6 | 11 |
| note_attachments | 0 | 0 | 0 |

Email attachments, reports and screenshots are private; all remaining buckets above are public. Do not change bucket visibility until all relevant readers are migrated and public-link compatibility is approved.

## Initial exact-path ownership checks

Task attachments: 41 of 69 match files joined to owned tasks. Event attachments: 261 of 480 match event_files joined to owned events. Customer attachments: 112 of 156 match customer_files_new joined to owned customers. Chat attachments: 173 of 251 match chat_message_files joined to owned channels. No booking attachment matches booking_files joined to booking_requests and business_profiles through the straightforward exact-path join.

These are preliminary counts, NOT proof remaining objects are orphaned. Cross-family references exist (including event attachments referenced by customers and tasks, and booking-bucket paths referenced by event/customer metadata). Legacy fields, comments, renamed paths, and alternate business relations need separate resolution. Do not delete or assign any unmatched file.

## Current blocking gates

1. Browser auth status is external_unmanaged. Managed signed-in end-to-end checks cannot be restored for this project's external Supabase. No permission cutover can be represented as verified from a signed-out or fabricated session.
2. PublicBoard currently obtains password hashes through get_sub_user_auth, verifies them locally, and directly writes sub_users password fields and public_board_access tokens. A new server signature alone would not make a client-mutable credential trustworthy. Privileged team file sessions require a protected verification source; changes to the wider credential write/read policies require explicit scope review rather than silently addressing unselected findings.
3. Existing public download links would stop working if attachment buckets become private. Private read cutover requires the user decision recorded in the approved plan.

## Foundation delivered

Pure server-side authorization helpers cover owned records, current team membership and family permissions, exact legacy metadata links, and one-request anonymous booking upload grants. They accept only already verified principals/grants; no browser identity or legacy token is promoted. They do not issue sessions, access Supabase, or modify storage. Integration must additionally implement verified authentication, atomic grant consumption, server-generated upload paths, and actual Storage operations.

## Finding status

Recovered the original selection of 49 IDs from the user's 2026-11-16 message: 9 RLS findings and 40 storage findings. This implementation milestone addresses only the storage foundation. No finding is marked fixed or ignored because the live restrictions are deliberately not applied before the compatibility gates pass.