

# Onboarding Tutorial for New Users

## Overview
Add a step-by-step interactive tutorial that guides new users through the dashboard features (Calendar, Tasks, CRM, Statistics, Business, Chat). The tutorial appears automatically for the first 3 logins, can be skipped, and can be replayed from settings.

## How It Works
- On login, check a `login_count` field on the user's profile. If <= 3, show the tutorial offer dialog.
- User can "Start Tutorial" or "Skip". If skipped, they won't see it again that session.
- The tutorial uses a spotlight/tooltip overlay that highlights each dashboard tab and key UI elements in sequence (6-7 steps), with a SmartBookly mascot/robot character guiding them.
- After completing or dismissing, increment `login_count`.

## Steps

### 1. Database: Add `login_count` to profiles
- Migration: `ALTER TABLE profiles ADD COLUMN login_count integer DEFAULT 0;`

### 2. Create Tutorial Components
- **`src/components/onboarding/OnboardingTutorial.tsx`** — Main controller component. Checks `login_count <= 3` on mount. Shows a welcome dialog offering the tour. Manages current step state.
- **`src/components/onboarding/TutorialStep.tsx`** — Renders a spotlight overlay highlighting a target element (by CSS selector/ref), with a tooltip card containing: step title, description, step counter (e.g. 3/7), Next/Skip buttons, and a small SmartBookly robot icon.
- **`src/components/onboarding/TutorialWelcomeDialog.tsx`** — Initial dialog: "Welcome to SmartBookly! Want a quick tour?" with Start / Skip buttons.

### 3. Tutorial Steps Content (7 steps)
1. **Calendar Tab** — "This is your Booking Calendar. Add events, manage appointments, and track your schedule."
2. **Statistics Tab** — "View analytics about your bookings, income, and business performance."
3. **Tasks Tab** — "Manage your to-do list with a Kanban board. Assign tasks to team members."
4. **CRM Tab** — "Your customer database. Add clients, track payments, and manage relationships."
5. **Business Tab** — "Set up your public booking page so clients can request appointments."
6. **Chat Icon** — "Use the built-in chat to communicate with your team. AI assistant is also available here."
7. **Profile/Theme Area** — "Customize your profile, switch themes, and manage your subscription."

All text will be translated in en.ts, ka.ts, es.ts.

### 4. Integration
- Add `<OnboardingTutorial />` inside the authenticated dashboard view in `Index.tsx`, after `<DashboardContent />`.
- On mount, fetch `login_count` from profiles. If <= 3, show welcome dialog.
- On tutorial complete or skip, increment `login_count` via Supabase update.

### 5. Styling
- Semi-transparent dark overlay with a cutout around the highlighted element (CSS clip-path or box-shadow approach).
- Tooltip card with brand colors (green primary), rounded corners, smooth animations using framer-motion.
- Mobile-responsive — tooltip positions adapt to viewport.

### 6. Translations
- Add `onboarding.*` keys to all 3 language files with step titles, descriptions, and button labels.

## Technical Details
- Spotlight overlay uses a full-screen fixed div with `pointer-events: none` except on the tooltip.
- Target elements found via `document.querySelector` on tab trigger values or known class names.
- `getBoundingClientRect()` positions the tooltip relative to highlighted elements.
- Framer Motion for enter/exit animations on each step transition.
- No external library needed — custom lightweight implementation.

