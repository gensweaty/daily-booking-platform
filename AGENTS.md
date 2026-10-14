# Architecture rules

- Keep the alternating public product showcase in FeatureSection and its repeated rows in FeatureCard; keep hero and feature screenshot framing opt-in in ImageCarousel to isolate presentation changes.
- Keep localized pricing questions in PricingFAQ and reuse the shared Accordion primitives so questions stay independent of checkout logic.
- Scope public-page surface, screenshot-stage, and elevation treatments with landing-prefixed classes and semantic tokens in index.css to avoid changing dashboard presentation.