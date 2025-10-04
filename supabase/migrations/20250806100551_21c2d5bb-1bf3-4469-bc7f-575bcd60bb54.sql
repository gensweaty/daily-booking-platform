-- Add slug column to public_boards table
ALTER TABLE public_boards ADD COLUMN slug TEXT;

-- Create unique index on slug to prevent duplicates
CREATE UNIQUE INDEX idx_public_boards_slug ON public_boards(slug) WHERE slug IS NOT NULL;