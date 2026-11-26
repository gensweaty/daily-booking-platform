# Safe attachment security for SmartBookly

## Goal and scope

Protect files from unauthorized uploads, replacement, deletion, and private-file reading without disrupting bookings or team boards. Change only the previously selected storage findings; leave all unrelated findings and app behavior untouched.

This is a staged implementation plan, not a claim of zero risk. No live permissions or files have been changed during this review. Findings remain open until their fixes are verified.

## What the review confirmed

- Storage write rules commonly check only the bucket or whether someone is signed in, not whether they can manage the linked record.
- Task, event, customer, booking, note, and chat attachment buckets are currently public. Narrowing read policies alone cannot protect their public download URLs.
- Existing file paths often start with a record ID, not an account ID. Enforcing new account folders immediately would reject legitimate existing files.
- Team-board sign-in verifies passwords in the browser and creates its access token there. Local identity, a client-created token, or an active board alone is insufficient proof for a privileged file operation.

## 1. Establish a compatibility baseline

- Map each selected finding to its exact policy, bucket, callers, and replacement; obtain the full original selection before applying or resolving anything.
- Inventory all relevant file paths and metadata in paginated batches, including legacy task/customer records, comments, chat attachments, avatars, and business images. Use counts and ownership links without downloading private contents.
- Record current policies and bucket settings for recovery. Do not move, rename, delete, or automatically assign ambiguous files.
- Capture baseline flows: owner and team uploads/previews/downloads/deletions, anonymous public and embedded bookings with attachments, booking approval attachment transfer, chat/AI/Telegram attachments, and business images.

## 2. Add verified file access alongside the existing flows

- Owners use their existing SmartBookly sign-in. The server derives their identity and checks the related record belongs to them.
- Team members keep the same sign-in screens and passwords. Introduce server-side password verification and a server-issued, expiring file-access session. Validate board, membership, and current permission on every operation; never elevate a legacy browser token directly.
- Keep this verification limited to the file-security prerequisite. Do not silently redesign other board data access or claim unrelated sign-in findings are resolved.
- Anonymous bookings receive a short-lived upload permission bound to the newly created request, business, and server-generated object path. It permits only new attachments for that request, never reading or deleting other bookings' files.
- Return short-lived upload/download links for large files rather than routing file bytes through the application server. Keep privileged keys server-only.
- Resolve existing file ownership using related records and metadata, not a client-supplied owner or folder name. Reject ambiguous destructive operations; resolve mapping gaps before switching the affected bucket.
- Keep public business images and avatars publicly readable; restrict their modification to their authorized owner or permitted team member.

## 3. Switch writes one file family at a time

- Start with owner-only files and public-image writes, then task/comment, event/customer, booking, and chat/team flows after each family's tests pass.
- Update every upload, replacement, and delete caller for that family, including public boards and server integrations. Preserve file names, limits, previews, and existing UI controls.
- Only then replace the selected broad write policies for that bucket. Check overlapping permissive policies: adding a narrow policy does not cancel an existing broad one.
- If closing an unselected policy is required to make the selected fix effective, leave that finding open and request scope approval rather than changing it silently.
- Preserve existing object paths. Use ownership-bound paths only for new objects where compatible with all callers.

## 4. Protect private reads separately

- Migrate private attachment consumers to verified, expiring download links, including full-message previews, emails, AI document analysis, Telegram, and booking transfers.
- Test new and legacy files before changing any attachment bucket to private through the Storage API.
- Keep actual public media public. Separate any deliberately public document from private attachments before changing its bucket.
- Existing public URLs shared outside the platform stop working if a bucket becomes private. Do not make that change silently: obtain explicit approval for this trade-off or leave the affected read findings open. Already downloaded copies cannot be revoked.

## Verification required before each cutover


| Check                                                                  | Expected result                                                            |
| ---------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| Owner manages their new and legacy files                               | Upload, preview, download, replace, and delete work as before              |
| Team member with permission                                            | Same permitted actions work on their board                                 |
| Team member without permission; expired/revoked session                | Access denied                                                              |
| Different owner; forged account/record/path; forged legacy board token | Access denied                                                              |
| Anonymous public and embedded booking                                  | Request and attachments succeed; other requests' files remain inaccessible |
| Booking approval                                                       | Attachment transfer and notifications still work                           |
| Chat, AI, Telegram, email attachments                                  | Existing permitted workflows still work                                    |
| Public business images and avatars                                     | Still visible on desktop/mobile and public pages                           |
| Direct Storage bypass                                                  | Unauthorized writes fail; private reads fail after approved read cutover   |


Use automated authorization tests plus signed-in browser checks with real test inputs. Clean up only newly created test records. If an account or team session cannot be verified, report that as a blocker; do not tighten its permissions or resolve its finding on source review alone.

## Technical safeguards and completion

- Use additive application-schema migrations for session/ownership support where needed, explicit grants, and RLS. Do not change existing account data or managed storage tables.
- Use the Storage API for bucket settings; policy changes go through migrations.
- Deploy server support before its client callers, then tighten permissions only after compatibility tests. Never leave the server trusting client-created identity during rollout.
- Validate old-file mapping before restrictive cutover. Recovery should restore the compatible authorized path; restoring a broad policy requires explicit acknowledgment that it reopens the vulnerability.
- Re-scan and use `manage_security_finding` only for selected findings with verified fixes. Report pass/fail checks, remaining blockers, and any public-read trade-offs. Do not ignore intentional access merely to clear the scan.

## First implementation milestone

Complete the baseline, verified file-session foundation, and one owner-only file family. Continue with team/booking families only after their positive and negative tests pass; private-read changes require the separate link-compatibility decision above.  
  
Most importantly you houdl make sure no fucntionality will ruin iwth this implementation and verything will work like before!