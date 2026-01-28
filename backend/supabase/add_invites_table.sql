CREATE TABLE IF NOT EXISTS invites (
    id BIGSERIAL PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,
    created_by BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ,
    used_by_google_id TEXT
);

ALTER TABLE invites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own invites"
    ON invites
    FOR ALL
    USING (created_by = (
        SELECT id FROM users WHERE google_id = auth.uid()::text
    ))
    WITH CHECK (created_by = (
        SELECT id FROM users WHERE google_id = auth.uid()::text
    ));
