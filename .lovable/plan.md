
# Fix Plan: Sub-User Notification Isolation

## Problem Summary

1. **Sub-user AI reminders appear on admin dashboard**: When sub-user "Cau" asks AI to set a reminder, the notification appears on the admin's Dynamic Island instead of Cau's
2. **Sub-users don't receive chat notifications**: Messages from admin to sub-users (DM or general chat) don't trigger notifications for the sub-user

## Root Cause

### Issue 1: Reminder Notification Leaking to Admin
The `CustomReminderNotifications.tsx` component queries `custom_reminders` WHERE `user_id = current_user_id`. Since reminders are stored with `user_id = board_owner_id` (the admin), the admin's notification listener picks them up even when created BY a sub-user FOR the sub-user.

The table already has `created_by_type` and `created_by_sub_user_id` columns, but they're only used for tracking creation - not for notification routing.

### Issue 2: Chat Notifications Not Reaching Sub-Users
The notification system uses `targetAudience: 'internal' | 'public'` to route notifications, but this doesn't handle cross-context messaging (admin sending to sub-user). The sub-user's `usePublicBoardNotifications` hook correctly filters out `internal` notifications, but when admin sends a message to a sub-user, it should dispatch with `targetAudience: 'public'` for the sub-user recipient.

## Solution

### Part 1: Fix Reminder Notification Routing

**Change 1: `CustomReminderNotifications.tsx`**
- Add filter to EXCLUDE reminders where `created_by_type = 'sub_user'`
- These are sub-user's reminders and should not appear on admin dashboard
- The admin's component should only show reminders that belong to the admin

**Change 2: Add Sub-User Reminder Notification Listener (new component)**
- Create `PublicBoardReminderNotifications.tsx` for public board context
- Poll reminders where `created_by_type = 'sub_user'` AND `created_by_sub_user_id = current_sub_user.id`
- Dispatch notifications with `targetAudience: 'public'`

**Change 3: Mount the listener in `PublicBoard.tsx`**
- Include the new reminder notification component for sub-users

### Part 2: Fix Cross-User Chat Notifications

**Change 4: `ChatProvider.tsx` - Fix notification targeting for cross-user messages**
- When a message is received, determine WHO should receive the notification
- For DMs: notify the other participant (if admin sent, notify sub-user with `targetAudience: 'public'`)
- For general/custom chats: notify all participants who aren't the sender
- Use the new `recipientSubUserId` field in the notification event

**Change 5: `usePublicBoardNotifications.ts` - Filter by recipient ID**
- Check if `recipientSubUserId` matches the current sub-user's ID
- Only show notifications that are meant for this specific sub-user

**Change 6: `useDashboardNotifications.ts` - Filter by recipient ID**  
- Check if `recipientUserId` matches the current admin user's ID
- Only show notifications meant for this specific admin user

### Part 3: AI Chat Edge Function - Return Sub-User ID for Reminder Dispatch

**Change 7: `supabase/functions/ai-chat/index.ts`**
- When creating a reminder for a sub-user, include `sub_user_id` in the response
- This allows the client to dispatch a properly-targeted notification event

**Change 8: `MessageInput.tsx` - Dispatch sub-user reminder notification**
- After AI creates a reminder, check if response contains `sub_user_id`
- Dispatch `dashboard-notification` with `targetAudience: 'public'` and `recipientSubUserId`

---

## Technical Details

### Files to Modify

1. **`src/components/reminder/CustomReminderNotifications.tsx`**
   - Add query filter: `.not('created_by_type', 'eq', 'sub_user')`
   - This ensures admin only sees admin-created reminders

2. **`src/components/reminder/PublicBoardReminderNotifications.tsx`** (NEW)
   - Create new component for sub-user reminder notifications
   - Query reminders by `created_by_sub_user_id` matching current sub-user
   - Poll every 30 seconds like the admin version
   - Dispatch to `dashboard-notification` with `targetAudience: 'public'`

3. **`src/pages/PublicBoard.tsx`**
   - Import and mount `PublicBoardReminderNotifications`

4. **`src/components/chat/ChatProvider.tsx`**
   - Update `showNotification` calls to include recipient identification
   - For each message notification, determine if recipient is admin or sub-user
   - Set `targetAudience` and `recipientSubUserId`/`recipientUserId` accordingly

5. **`src/hooks/usePublicBoardNotifications.ts`**
   - Add recipient filtering: only process notifications where `recipientSubUserId` matches current sub-user
   - Fall back to current behavior if no recipient specified (backward compatibility)

6. **`src/hooks/useDashboardNotifications.ts`**
   - Add recipient filtering: only process notifications where `recipientUserId` matches current admin
   - Fall back to current behavior if no recipient specified

7. **`supabase/functions/ai-chat/index.ts`**
   - In reminder creation paths (fast-path and tool call), return `sub_user_id` when `requesterType === 'sub_user'`

8. **`src/components/chat/MessageInput.tsx`**
   - After successful AI reminder creation, if `data.sub_user_id` exists, dispatch notification with proper targeting

### Database Query Changes

**Current query in `CustomReminderNotifications.tsx`:**
```typescript
.eq('user_id', user.id)
```

**New query (admin version):**
```typescript
.eq('user_id', user.id)
.or('created_by_type.is.null,created_by_type.neq.sub_user')
```

**New query (sub-user version):**
```typescript
.eq('user_id', boardOwnerId)
.eq('created_by_type', 'sub_user')
.eq('created_by_sub_user_id', currentSubUserId)
```

### Notification Event Structure

Current:
```typescript
{
  type: 'chat',
  title: '...',
  message: '...',
  actionData: { channelId: '...' },
  targetAudience: 'internal' | 'public'
}
```

New (with recipient filtering):
```typescript
{
  type: 'chat',
  title: '...',
  message: '...',
  actionData: { channelId: '...' },
  targetAudience: 'internal' | 'public',
  recipientUserId?: string,      // For internal dashboard users
  recipientSubUserId?: string,   // For public board sub-users
  recipientSubUserEmail?: string // Fallback for sub-user identification
}
```

---

## Verification Steps

After implementation:

1. **Test sub-user reminder isolation**:
   - Log in as sub-user on public board
   - Ask AI "remind me in 2 minutes about test"
   - Verify reminder notification appears ONLY on sub-user's Dynamic Island
   - Verify admin's dashboard does NOT show this notification

2. **Test admin-to-sub-user DM notifications**:
   - Open admin dashboard and sub-user public board side by side
   - Send DM from admin to sub-user
   - Verify sub-user receives notification in their Dynamic Island
   - Verify admin does NOT receive their own message as notification

3. **Test general chat notifications**:
   - Send message in General chat as admin
   - Verify sub-users who are participants receive notifications
   - Verify admin doesn't receive notification for their own message

4. **Test backward compatibility**:
   - Verify existing task/event/booking notifications still work
   - Verify admin reminders (created by admin) still notify admin
