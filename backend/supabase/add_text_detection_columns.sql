-- Migration: Add text detection columns to style_references table
-- Created: 2026-02-01

ALTER TABLE style_references
ADD COLUMN detected_text JSONB DEFAULT '[]'::jsonb;

ALTER TABLE style_references
ADD COLUMN selected_text_ids JSONB DEFAULT '[]'::jsonb;

-- Update existing records to have the default values
UPDATE style_references
SET detected_text = '[]'::jsonb
WHERE detected_text IS NULL;

UPDATE style_references
SET selected_text_ids = '[]'::jsonb
WHERE selected_text_ids IS NULL;
