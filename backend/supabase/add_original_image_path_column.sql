-- Migration: Add original_image_path column to style_references table
-- Created: 2026-02-01

ALTER TABLE style_references
ADD COLUMN original_image_path TEXT;
