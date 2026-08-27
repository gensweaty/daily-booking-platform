# Surface the last 3 months of features on the public site

Audit result: several shipped capabilities appear nowhere in public copy, SEO metadata or `llms.txt`. Verified gaps (searched `src/translations/en.ts`, landing components, `index.html`, `src/utils/seo/seoConfig.ts`, `public/llms.txt`, `public/sitemap.xml`):

| Shipped feature | Public site status |
| --- | --- |
| Telegram AI channel (chat, voice, files, reminders, screenshots) | one clause inside the hero paragraph only — no card, no button, no keywords |
| Embeddable booking widget (`/embed/business/:slug`) | not mentioned anywhere (no "embed" string in translations) |
| Working-hours-aware booking + booking-request approval with owner comment | website card only says "Email appointment approval" |
| AI voice/document analysis, Excel reports, dashboard screenshots | partially in `aiAssistant` list, not in metadata or llms.txt |
| Email campaigns / signature | already covered (card + button exist) |
| SEO metadata, sitemap `lastmod` (2025-01-05), llms.txt | all stale |

## What we will add

### 1. Two new landing feature cards (same `FeatureCard` pattern)
- **Telegram & Multi-Channel AI** (`id="telegram-ai"`, MessageSquare icon): talk to your assistant from Telegram, send voice notes and documents for analysis, get every reminder in Telegram + email + dashboard, ask for a screenshot of any board.
- **Embed Booking on Your Own Website** (`id="embed-booking"`, Code icon): one-line iframe snippet, theme/language/branding options, working-hours-aware slots, no code required.
- Both get quick-jump buttons in `FeatureButtons.tsx` (rebalanced grid so no orphan button in the last row).

### 2. Strengthen existing copy
- `website` card: add working-hours enforcement and request-approval-with-message bullets.
- `aiAssistant` card: add Telegram/voice/screenshot bullets and reword description to say "works in the dashboard and in Telegram".
- Hero subtitle: append `· Telegram` and `· Embed` so the one-line value prop matches the product.

### 3. Visuals
- Generate two screenshots-style assets (`src/assets/telegram-ai-screenshot.jpg`, `src/assets/embed-booking-screenshot.jpg`) matching the existing card imagery, lazy-loaded with descriptive alt text.

### 4. Translations
- Add `telegramAi` and `embedBooking` blocks plus new `features.*` button labels to `en.ts`, `es.ts`, `ka.ts` and `types.ts`, and extend the `translationPrefix` union in `FeatureCard.tsx`. Georgian strings use the existing font handling via `LanguageText`.

### 5. SEO
- `index.html`: refresh title/description/keywords and og/twitter description to include AI assistant, Telegram, embeddable booking (title stays under 60 chars, description under 160).
- `src/utils/seo/seoConfig.ts`: same refresh for `en`, `es`, `ka` titles/descriptions/keywords.
- `src/utils/seo/structuredData.ts`: extend the `SoftwareApplication`/Organization `featureList` with the new capabilities.
- `public/sitemap.xml`: bump `lastmod` on the homepage/language variants to today.
- `public/llms.txt`: add a Features section listing all current capabilities so AI crawlers describe the product correctly.

### 6. UI/UX consistency
- Keep the current card rhythm (alternating `reverse`), reuse existing glass-morphism button styling, keep animations within the project's 0.2-0.3s CSS transition rule, and verify the new sections on the 384px mobile viewport.

## Technical notes
- No backend, schema or business-logic changes — this is copy, assets, translation keys and metadata only.
- Files touched: `FeatureSection.tsx`, `FeatureButtons.tsx`, `FeatureCard.tsx`, `HeroContent`/hero translations, `src/translations/{en,es,ka,types}.ts`, `index.html`, `src/utils/seo/seoConfig.ts`, `src/utils/seo/structuredData.ts`, `public/llms.txt`, `public/sitemap.xml`, plus two new asset files.
- Build check after the edits; no changes to dashboard, CRM, email or AI functionality.
