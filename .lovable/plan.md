
# Comprehensive Fix Plan: Sub-User Notification Delivery

## Problem Summary

After extensive code analysis, I've identified **two distinct architectural issues** causing notifications to fail for sub-users:

### Issue 1: Notification Targeting is Based on SENDER's Context, Not RECIPIENT's

When admin sends a DM or chat message to a sub-user:
1. The notification dispatch happens on the **ADMIN's browser**
2. `ChatProvider` checks `isOnPublicBoard` which is `false` for admin
3. This causes `targetAudience: 'internal'` to be set
4. Sub-user's `usePublicBoardNotifications` correctly filters OUT notifications with `targetAudience === 'internal'`
5. **Result**: Sub-user never receives the notification

The fundamental flaw is that the current implementation determines `targetAudience` based on the **sender's route**, not the **recipient's context**.

### Issue 2: Sub-User Polling Doesn't Trigger Notifications Properly

For external sub-users (polling-based, not realtime):
1. Messages are polled from the database
2. The `onPolledMessage` handler processes them
3. But notifications are dispatched with `targetAudience: 'public'` **only when the poller is on a public board**
4. When admin sends a message, the sub-user's poller receives it but filters may still fail

## Root Cause Analysis

```text
CURRENT FLOW (BROKEN):
┌──────────────────┐     ┌───────────────────────┐     ┌──────────────────┐
│   Admin sends    │────▶│  Admin's ChatProvider │────▶│  Dispatch event  │
│   DM to sub-user │     │  isOnPublicBoard=false│     │  targetAudience= │
│                  │     │                       │     │  'internal' ❌   │
└──────────────────┘     └───────────────────────┘     └────────┬─────────┘
                                                                 │
                              ┌──────────────────────────────────▼───────────────────┐
                              │                                                       │
               ┌──────────────▼──────────────┐         ┌──────────────▼──────────────┐
               │  useDashboardNotifications  │         │ usePublicBoardNotifications │
               │  (Admin's Dynamic Island)   │         │  (Sub-user's Dynamic Island)│
               │  Accepts 'internal' ✅      │         │  SKIPS 'internal' ❌        │
               └─────────────────────────────┘         └─────────────────────────────┘
```

## Solution: Determine Recipient Context from Channel Participants

The fix requires changing the notification dispatch logic to:
1. **Identify the actual recipient(s)** of the message based on channel participation
2. **Dispatch MULTIPLE notifications** - one for each recipient with correct targeting
3. **Set targetAudience based on recipient's type**, not sender's route

```text
CORRECT FLOW (FIX):
┌──────────────────┐     ┌───────────────────────┐     ┌─────────────────────────────┐
│   Admin sends    │────▶│  Admin's ChatProvider │────▶│  Determine recipients from  │
│   DM to sub-user │     │                       │     │  channel_participants table │
└──────────────────┘     └───────────────────────┘     └───────────────┬─────────────┘
                                                                       │
                                                     ┌─────────────────┴─────────────────┐
                                                     │ For each recipient (except self): │
                                                     └─────────────────┬─────────────────┘
                                                                       │
               ┌──────────────────────────────────────────────────────┴┐
               │ If recipient is admin:                                │
               │   dispatch(targetAudience='internal',                 │
               │            recipientUserId=admin.id)                  │
               │                                                       │
               │ If recipient is sub_user:                             │
               │   dispatch(targetAudience='public',                   │
               │            recipientSubUserId=sub_user.id,            │
               │            recipientSubUserEmail=sub_user.email)      │
               └───────────────────────────────────────────────────────┘
```

## Implementation Details

### Part 1: Update ChatProvider Notification Logic

**File: `src/components/chat/ChatProvider.tsx`**

**Change the `shouldAlert()` and notification dispatch logic** (Lines ~700-780):

```typescript
shouldAlert().then(async (shouldShowMe) => {
  // Always play sound if I should see this message
  if (shouldShowMe && !isViewingThisChannel) {
    import('@/utils/audioManager')
      .then(({ playNotificationSound }) => playNotificationSound())
      .catch(() => {});
  }

  // CRITICAL FIX: Dispatch notifications to ALL recipients based on channel participants
  // Don't rely on sender's route to determine audience
  
  // Fetch channel participants to determine who should receive notifications
  const { data: participants } = await supabase
    .from('chat_participants')
    .select('user_id, sub_user_id, user_type')
    .eq('channel_id', message.channel_id);
  
  if (!participants || participants.length === 0) return;
  
  // For each participant (except the sender), dispatch a targeted notification
  for (const p of participants) {
    const isParticipantSender = 
      (p.user_type === 'admin' && p.user_id === message.sender_user_id) ||
      (p.user_type === 'sub_user' && p.sub_user_id === message.sender_sub_user_id);
    
    if (isParticipantSender) continue; // Don't notify the sender
    
    // Determine notification targeting based on RECIPIENT's type
    if (p.user_type === 'admin' && p.user_id) {
      // Admin recipient - internal dashboard
      showNotification({
        title: `${message.sender_name || 'Someone'} messaged`,
        body: message.content,
        channelId: message.channel_id,
        senderId: message.sender_user_id || message.sender_sub_user_id || 'unknown',
        senderName: message.sender_name || 'Unknown',
        targetAudience: 'internal',
        recipientUserId: p.user_id,
      });
    } else if (p.user_type === 'sub_user' && p.sub_user_id) {
      // Sub-user recipient - public board
      // Get sub-user email for fallback matching
      const { data: subUser } = await supabase
        .from('sub_users')
        .select('email')
        .eq('id', p.sub_user_id)
        .maybeSingle();
      
      showNotification({
        title: `${message.sender_name || 'Someone'} messaged`,
        body: message.content,
        channelId: message.channel_id,
        senderId: message.sender_user_id || message.sender_sub_user_id || 'unknown',
        senderName: message.sender_name || 'Unknown',
        targetAudience: 'public',
        recipientSubUserId: p.sub_user_id,
        recipientSubUserEmail: subUser?.email?.toLowerCase(),
      });
    }
  }
});
```

### Part 2: Cache Participants to Avoid Repeated Queries

**Add participant caching to ChatProvider** to prevent excessive database queries:

```typescript
// Add to ChatProvider state
const [participantCache, setParticipantCache] = useState<
  Map<string, Array<{ user_id?: string; sub_user_id?: string; user_type: string; email?: string }>>
>(new Map());

// Fetch and cache participants when a channel is accessed
const getChannelParticipants = useCallback(async (channelId: string) => {
  // Check cache first
  if (participantCache.has(channelId)) {
    return participantCache.get(channelId)!;
  }
  
  // Fetch from database
  const { data: participants } = await supabase
    .from('chat_participants')
    .select(`
      user_id, 
      sub_user_id, 
      user_type
    `)
    .eq('channel_id', channelId);
  
  if (!participants) return [];
  
  // Resolve sub-user emails for better matching
  const enriched = await Promise.all(
    participants.map(async (p) => {
      if (p.user_type === 'sub_user' && p.sub_user_id) {
        const { data: su } = await supabase
          .from('sub_users')
          .select('email')
          .eq('id', p.sub_user_id)
          .maybeSingle();
        return { ...p, email: su?.email?.toLowerCase() };
      }
      return p;
    })
  );
  
  // Update cache
  setParticipantCache(prev => new Map(prev.set(channelId, enriched)));
  return enriched;
}, [participantCache]);
```

### Part 3: Update Reminder Alert Dispatch

**Update reminder alert handling** to use recipient metadata (already has this from previous fix):

The `process-reminders` edge function now includes metadata, but `ChatProvider` must respect it:

```typescript
// In handleNewMessage and onPolledMessage for reminder_alert:
if (isReminderAlert) {
  const metadata = message.metadata || {};
  
  // Use metadata to determine exact recipient
  const isForMe = 
    (metadata.recipient_type === 'admin' && me?.type === 'admin' && me?.id === metadata.recipient_user_id) ||
    (metadata.recipient_type === 'sub_user' && me?.type === 'sub_user' && 
      (me?.id === metadata.recipient_sub_user_id || 
       me?.email?.toLowerCase() === metadata.recipient_email?.toLowerCase()));
  
  if (!isForMe) {
    console.log('⏭️ Reminder not for current user, skipping');
    return;
  }
  
  // Dispatch with CORRECT targeting based on recipient metadata
  showNotification({
    title: 'Reminder Alert',
    body: message.content,
    channelId: message.channel_id,
    senderId: 'ai',
    senderName: 'Smartbookly AI',
    // Use metadata to set correct audience
    targetAudience: metadata.recipient_type === 'sub_user' ? 'public' : 'internal',
    recipientUserId: metadata.recipient_type === 'admin' ? metadata.recipient_user_id : undefined,
    recipientSubUserId: metadata.recipient_type === 'sub_user' ? metadata.recipient_sub_user_id : undefined,
    recipientSubUserEmail: metadata.recipient_email,
  });
}
```

### Part 4: Fix usePublicBoardNotifications Identity Resolution

**Ensure sub-user receives notifications even when ID is email-based**:

The current implementation already has UUID resolution via database lookup. Add more robust logging and fallback:

```typescript
// In handleNotificationEvent listener (usePublicBoardNotifications.ts):
const handleNotificationEvent = (event: CustomEvent<DashboardNotificationEvent>) => {
  // ... existing code ...
  
  // RELAXED MATCHING: If targetAudience is 'public' and no specific recipient is set,
  // this could be a general notification for all sub-users
  if (targetAudience === 'public' && !recipientSubUserId && !recipientSubUserEmail) {
    console.log('✅ [Public] Accepting general public notification');
    // Accept the notification for display
  }
  
  // If specific targeting exists, validate identity
  if (recipientSubUserId || recipientSubUserEmail) {
    const effectiveSubUserId = resolvedSubUserId || currentSubUserId;
    const effectiveIdIsUuid = effectiveSubUserId && uuidRe.test(effectiveSubUserId);
    
    const uuidMatch = effectiveIdIsUuid && recipientSubUserId === effectiveSubUserId;
    const emailMatch = currentEmail && recipientSubUserEmail?.toLowerCase() === currentEmail;
    
    if (!uuidMatch && !emailMatch) {
      console.log('⏭️ [Public] No identity match - skipping');
      return;
    }
  }
  
  // ... rest of notification handling ...
};
```

### Part 5: Ensure Voice Alerts Work for Sub-Users

**Confirm audio plays correctly for public board users**:

The `showSingleNotification` in `useEnhancedNotifications.ts` already plays sound. Verify it's not being blocked:

```typescript
// In useEnhancedNotifications.ts showSingleNotification:
const showSingleNotification = useCallback(async (data: NotificationData) => {
  console.log('🔔 [Enhanced] Showing notification:', data);
  
  // Dispatch to Dynamic Island FIRST (synchronous)
  window.dispatchEvent(new CustomEvent('dashboard-notification', {
    detail: {
      type: 'chat',
      title: data.title,
      message: data.body,
      actionData: { channelId: data.channelId },
      targetAudience: data.targetAudience,
      recipientUserId: data.recipientUserId,
      recipientSubUserId: data.recipientSubUserId,
      recipientSubUserEmail: data.recipientSubUserEmail,
    }
  }));
  
  // Play sound IMMEDIATELY (don't await - non-blocking)
  try {
    const now = Date.now();
    if (now - lastSoundTime.current >= 1200) {
      import('@/utils/audioManager')
        .then(({ playNotificationSound }) => {
          console.log('🔊 Playing notification sound');
          playNotificationSound();
        })
        .catch((e) => console.warn('Sound failed:', e));
      lastSoundTime.current = now;
    }
  } catch (error) {
    console.warn('❌ Failed to play notification sound:', error);
  }
  
  // ... rest of notification logic
}, []);
```

## Summary of Changes

| File | Change |
|------|--------|
| `src/components/chat/ChatProvider.tsx` | Dispatch notifications to each participant with their correct `targetAudience` based on participant type (admin vs sub_user), not sender's route |
| `src/hooks/usePublicBoardNotifications.ts` | Improve logging and ensure email fallback matching works correctly |
| `src/hooks/useEnhancedNotifications.ts` | Ensure sound plays without blocking notification dispatch |

## Testing Checklist

After implementation:

1. ✅ Admin sends DM to sub-user → Sub-user receives notification + voice alert
2. ✅ Admin sends message in General chat → Sub-user receives notification (if participant)
3. ✅ Sub-user creates AI reminder → Only that sub-user sees the reminder alert
4. ✅ Admin creates AI reminder → Only admin sees the reminder alert
5. ✅ Sub-user sends message → Admin receives notification
6. ✅ No cross-contamination between different sub-users
7. ✅ No cross-contamination between admin and sub-user

## Technical Architecture Notes

The key insight is that **notifications must be routed based on recipient identity, not sender's current view context**. The previous implementation assumed that whoever dispatches the notification knows the correct audience, but this fails when:

- Admin browser dispatches notification for sub-user (admin is on `/dashboard`, not `/board/...`)
- The `isOnPublicBoard` check is irrelevant for determining where the notification should appear

The fix shifts notification routing to be **recipient-centric** by:
1. Looking up channel participants from the database
2. Dispatching individual notifications for each recipient with their correct targeting
3. Allowing the recipient's notification listener to match based on their own identity
