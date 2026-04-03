

## Plan: Bigger Favicon + Interactive Robot Eye

### 1. Fix Small Browser Tab Icon

**Problem**: `favicon.ico` is only 48x48 pixels, which renders tiny on modern browser tabs. The `favicon.png` (1024x1024) exists but browsers prefer `.ico`.

**Solution**: Regenerate `favicon.ico` from the existing `favicon.png` with multiple embedded sizes (16x16, 32x32, 48x48, 64x64, 128x128, 256x256). Also add a 32x32 PNG `<link>` tag as a fallback for browsers that prefer PNG favicons. Delete the old small `.ico` and replace it.

**Files**: `public/favicon.ico` (regenerated), `index.html` (update favicon link tags to include sizes)

---

### 2. Interactive Robot Eye on Chat Icon

**Problem**: The robot SVG in the chat button is static.

**Solution**: Add a pure CSS animation to the robot's eye pupil in `ChatIcon.tsx`:
- **Eye movement**: The pupil (`cx`/`cy` on the inner circles) will shift subtly left/right on a slow CSS keyframe loop (~4s), giving the impression the robot is "looking around"
- **Blink**: Add a periodic scale-Y squash on the entire eye group (~every 3-4s) to simulate blinking
- Implementation uses CSS `@keyframes` only (no JS timers, no framer-motion) to avoid performance impact
- The SVG eye circles will be wrapped in a `<g>` group with a CSS class for the animation

**Files**: `src/components/chat/ChatIcon.tsx` (add animated eye group), `src/index.css` (add 2 small keyframe definitions)

---

### 3. Interactive Robot Eye on Site Logo (Landing Page)

**Problem**: The site logo is a raster PNG image (`logo-dark.png`, `logo-light.png`), not an inline SVG.

**Solution**: Since the logos are PNG files, we cannot animate internal elements. Two options:
- **Option A (recommended)**: Leave the PNG logo as-is. The interactive eye only applies to the chat icon robot where the SVG is inline and animatable.
- **Option B**: Add a very subtle CSS hover effect on the logo `<img>` (e.g., slight scale pulse on hover) to make it feel interactive without changing the image format.

I recommend Option A to avoid any risk to the landing page layout.

---

### What stays untouched
- All AI chat functionality, memory system, task/event creation
- Landing page layout, Navigation, Footer, DashboardHeader
- No changes to any business logic, hooks, or Supabase functions
- Logo PNG files remain unchanged

