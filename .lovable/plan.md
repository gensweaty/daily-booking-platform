

# Smartbookly Visual Rebrand Plan

## Brand Identity Summary (from Brandbook)

**Color Palette:**
- Primary Blue: `#335CF4` (replaces current purple `#9b87f5`)
- Primary Yellow: `#FED308`
- Secondary Red: `#FF4E32`
- Secondary Black: `#000002`
- Secondary Green: `#08B531`

**Typography:**
- Primary font: **Roboto** (headings & sub-headings)
- Secondary font: **Roboto Mono** (UI text & body copy)
- Replaces current Inter + BPG Glaho WEB Caps (Georgian font stays for Georgian text)

**Logo:** New robot character with single eye -- a rounded square "bot" body with little legs. Used across all contexts:
- Full detailed horizontal logo (for navigation header)
- Symbol/Avatar (for favicon, chat AI face)
- On white background (light mode), on black or blue (dark mode)

**AI Character:** The same robot symbol is the Smartbookly AI persona -- the "innocent manager bot"

---

## What Changes, What Does NOT Change

**NOT touched:** All translations, all functionality, all backend logic, all Supabase edge functions, all gestures/UX, routing, auth flows.

**Changed (visual only):**
1. Logo files everywhere
2. Color palette (CSS variables + Tailwind config)
3. Font family (Roboto + Roboto Mono)
4. Gradient text colors
5. Chat icon robot to match new brand robot
6. Favicon
7. Button gradient variants
8. Theme color meta tag

---

## Implementation Steps

### Step 1: Add New Logo Assets
- User needs to provide the actual logo image files (light mode, dark mode variants, favicon, robot symbol) as separate PNG/SVG uploads. The PDF contains them visually but we need clean individual files.
- Copy new logos to `public/` directory replacing the old `lovable-uploads` references.
- **Action needed from user:** Upload the individual logo files (horizontal logo for light, horizontal logo for dark, symbol/avatar for favicon + AI face).

### Step 2: Update Color Palette (`src/index.css`)
Replace CSS custom properties:

**Light mode (`:root`):**
- `--primary`: change from `262 83% 58%` (purple) to `227 79% 58%` (Primary Blue #335CF4)
- `--accent`: match primary blue
- `--ring`: match primary blue

**Dark mode (`.dark`):**
- `--primary`: change from `262 83% 75%` to `227 79% 78%` (lighter blue for dark mode)
- `--accent`: match
- `--ring`: match

### Step 3: Update Tailwind Config (`tailwind.config.ts`)
- Change `fontFamily.sans` from `Inter` to `Roboto`
- Add `fontFamily.mono` as `Roboto Mono`
- Update color values:
  - `primary.DEFAULT`: `#335CF4`
  - `primary.light`: `#5A7CF6`
  - `primary.dark`: `#2548C9`
  - `secondary.DEFAULT`: `#FED308` (yellow)
  - `secondary.light`: `#FEDC3A`
  - `secondary.dark`: `#D4B006`
  - `accent.DEFAULT`: `#FF4E32` (red)
  - `accent.light`: `#FF7A66`
  - `accent.dark`: `#CC3E28`

### Step 4: Update Font Loading (`index.html`)
- Add Google Fonts preconnect and stylesheet for Roboto + Roboto Mono
- Keep BPG Glaho WEB Caps for Georgian text

### Step 5: Update Gradient CSS (`src/components/landing/animations/gradient-text.css`)
- Change gradient from `#f97316, #ec4899, #9b87f5` to brand colors: `#335CF4, #FED308, #FF4E32`

### Step 6: Replace Logo References (10 files)
Replace all occurrences of the old logo paths across these files:
- `src/components/landing/HeroSection.tsx`
- `src/components/landing/FooterSection.tsx`
- `src/components/landing/Navigation.tsx` (via currentLogo prop)
- `src/components/AuthUI.tsx`
- `src/components/DashboardHeader.tsx`
- `src/components/ResetPassword.tsx`
- `src/components/ForgotPassword.tsx`
- `src/pages/Contact.tsx`
- `src/pages/Legal.tsx`
- `src/pages/PublicBoard.tsx`
- `index.html` (preload + favicon)

### Step 7: Update Favicon (`index.html`)
- Replace favicon link to point to new robot symbol/avatar
- Update `theme-color` meta from `#9b87f5` to `#335CF4`

### Step 8: Update Button Variants (`src/components/ui/button.tsx`)
- `purple` variant: change gradient from `#9b87f5 -> #f97316` to `#335CF4 -> #FED308`
- `dynamic` variant: update `primary/70` references (will inherit from new CSS vars)
- Chat icon gradient: change from purple/pink to brand blue

### Step 9: Update Chat Icon Robot (`src/components/chat/ChatIcon.tsx`)
- Redesign the SVG robot to match the new brand character (rounded square body with single eye, little legs)
- Update gradient from `#2563EB, #6D28D9, #DB2777` to brand blue `#335CF4`
- The robot becomes the Smartbookly AI face

### Step 10: Update `src/lib/font-utils.ts`
- Keep Georgian font utilities unchanged (BPG Glaho WEB Caps stays for Georgian)

### Step 11: Update Admin Header (`src/components/admin/AdminHeader.tsx`)
- Inherits from CSS variables, no direct color changes needed

### Step 12: Update `src/App.css`
- No brand-specific changes needed (generic layout CSS)

---

## Technical Details

### Files Modified (estimated ~15 files):
1. `index.html` -- fonts, favicon, theme-color, logo preload
2. `tailwind.config.ts` -- fonts, colors
3. `src/index.css` -- CSS custom properties (light + dark)
4. `src/components/landing/animations/gradient-text.css` -- gradient colors
5. `src/components/ui/button.tsx` -- gradient button variants
6. `src/components/chat/ChatIcon.tsx` -- robot SVG + gradient
7. `src/components/landing/HeroSection.tsx` -- logo path
8. `src/components/landing/FooterSection.tsx` -- logo path
9. `src/components/AuthUI.tsx` -- logo path
10. `src/components/DashboardHeader.tsx` -- logo path
11. `src/components/ResetPassword.tsx` -- logo path
12. `src/components/ForgotPassword.tsx` -- logo path
13. `src/pages/Contact.tsx` -- logo path
14. `src/pages/Legal.tsx` -- logo path
15. `src/pages/PublicBoard.tsx` -- logo path

### Pre-requisite
I need you to upload the individual logo files extracted from the brandbook:
1. **Horizontal logo for light background** (black version)
2. **Horizontal logo for dark background** (blue version from page 12)
3. **Robot symbol/avatar** (for favicon + AI chat face)

If you can provide these as separate PNG/SVG files, I can proceed immediately with the full rebrand. Otherwise, I will use the PDF-extracted images and optimize them as best as possible.

### Safety Approach
- Each step is isolated to visual properties only
- No translation keys, API calls, routes, or logic touched
- All changes are CSS variables, Tailwind config, image paths, and SVG markup
- The Georgian font (BPG Glaho WEB Caps) remains untouched for Georgian language support

