-- Migration: Add text_layer_cleaned column to style_references table
-- Created: 2026-02-01

ALTER TABLE style_references
ADD COLUMN text_layer_cleaned BOOLEAN DEFAULT FALSE;

-- Update existing records to have the default value
UPDATE style_references
SET text_layer_cleaned = FALSE
WHERE text_layer_cleaned IS NULL;
