-- Migration: Add two_step_generation column to generations table
-- Created: 2026-01-31

ALTER TABLE generations
ADD COLUMN two_step_generation BOOLEAN DEFAULT TRUE;

-- Update existing records to have the default value
UPDATE generations
SET two_step_generation = TRUE
WHERE two_step_generation IS NULL;