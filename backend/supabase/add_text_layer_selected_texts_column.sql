-- Migration: Add text_layer_selected_texts column to style_references table
-- Stores the text elements that were selected when the text layer was generated

ALTER TABLE style_references
ADD COLUMN text_layer_selected_texts JSONB;
