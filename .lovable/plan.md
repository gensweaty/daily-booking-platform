

# Plan: Center Notifications Popup Properly on All Dashboards

## Problem Identified
The notification popup appears off-center (bottom-right) on both internal and external dashboards because **framer-motion's scale animation overwrites the CSS `transform` property**, which removes the `translate(-50%, -50%)` centering.

Looking at the screenshots:
- Internal dashboard: Popup appears in bottom-right area
- External dashboard: Popup also appears off-center

## Solution
Use a **flex container centering approach** instead of `transform: translate(-50%, -50%)`. This technique wraps the popup in a full-screen fixed container with `display: flex; align-items: center; justify-content: center;`, so framer-motion's scale animation doesn't interfere with positioning.

This is the same robust pattern used by properly centered modals.

## Changes Required

### File: `src/components/dashboard/NotificationsPopup.tsx`

**Current approach (broken):**
```jsx
<motion.div
  style={{
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)', // Gets overwritten by framer-motion scale!
  }}
  animate={{ scale: 1 }}
/>
```

**New approach (flex container centering):**
```jsx
{/* Centering wrapper - uses flex to center, not transform */}
<div className="fixed inset-0 flex items-center justify-center">
  <motion.div
    // No transform needed - parent flex container centers it
    animate={{ opacity: 1, scale: 1 }}
  />
</div>
```

**Specific changes:**
1. Keep the backdrop as a separate layer with `zIndex: 99998`
2. Add a new centering wrapper `<div>` with:
   - `fixed inset-0 flex items-center justify-center`
   - `zIndex: 99999`
   - `padding` for mobile responsiveness
3. Remove the inline `top/left/transform` styles from the popup
4. Update responsive width to use Tailwind classes: `w-[92vw] max-w-[420px]`
5. Ensure mobile responsiveness with proper padding and max-height

This ensures the popup is **perfectly centered on all devices** (mobile and desktop) and works identically on both internal and external dashboards.

---

## Technical Details

### Updated Layout Structure:
```
document.body (via createPortal)
├── Backdrop (fixed inset-0, z-index: 99998)
└── Centering Container (fixed inset-0 flex items-center justify-center, z-index: 99999)
    └── Popup Modal (motion.div with scale animation)
```

### Responsive Sizing:
- Width: `min(92vw, 420px)` for mobile/desktop
- Max-height: `min(80vh, 600px)` to fit on all screens
- Padding: Container will have `p-4` to ensure spacing from screen edges on mobile

### Both Dashboards
Since `NotificationsPopup` is a shared component imported by both `DynamicIsland.tsx` (internal) and `PublicDynamicIsland.tsx` (external), fixing this single file will resolve centering for **both dashboards**.

