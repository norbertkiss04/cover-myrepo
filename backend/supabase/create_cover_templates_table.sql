CREATE TABLE cover_templates (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    aspect_ratio TEXT NOT NULL DEFAULT '2:3',
    title_box JSONB NOT NULL,
    author_box JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_cover_templates_user_id_created_at
    ON cover_templates(user_id, created_at DESC);

ALTER TABLE cover_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can only access own cover templates"
    ON cover_templates
    FOR ALL
    USING (user_id = (
        SELECT id FROM users WHERE google_id = auth.uid()::text
    ));
