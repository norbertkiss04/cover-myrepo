ALTER TABLE generations
ADD COLUMN cover_template_id BIGINT REFERENCES cover_templates(id) ON DELETE SET NULL;

CREATE INDEX idx_generations_cover_template_id
    ON generations(cover_template_id);
