ALTER TABLE generations ENABLE ROW LEVEL SECURITY;
ALTER TABLE style_references ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can only access own generations"
    ON generations
    FOR ALL
    USING (user_id = (
        SELECT id FROM users WHERE google_id = auth.uid()::text
    ));

CREATE POLICY "Users can only access own style references"
    ON style_references
    FOR ALL
    USING (user_id = (
        SELECT id FROM users WHERE google_id = auth.uid()::text
    ));

CREATE POLICY "Users can only access own profile"
    ON users
    FOR ALL
    USING (google_id = auth.uid()::text);
