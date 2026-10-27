# Architecture rules
- Issue agent keys server-side, store only hashes, derive account identity from the key, and allow only explicitly supported owner-scoped operations; keep profile integration lazy-loaded to avoid dashboard overhead.

- Keep the alternating public product showcase in FeatureSection and its repeated rows in FeatureCard; keep hero and feature screenshot framing opt-in in ImageCarousel to isolate presentation changes.
- Keep localized pricing questions in PricingFAQ and reuse the shared Accordion primitives so questions stay independent of checkout logic.
- Scope public-page surface, screenshot-stage, and elevation treatments with landing-prefixed classes and semantic tokens in index.css to avoid changing dashboard presentation.
- Render the landing hero immediately and run screenshot carousel autoplay only while visible, active, and not being interacted with; respect reduced motion to avoid unnecessary loading delays and background work.
- Keep email history in stable Messages components with server pagination and metadata-only lists; load owner-scoped full bodies on demand and render them in an empty sandbox with remote content blocked, to protect privacy and keep polling light.