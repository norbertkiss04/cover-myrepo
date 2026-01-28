CREATE OR REPLACE FUNCTION consume_invite(p_code TEXT, p_google_id TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    invite_id BIGINT;
BEGIN
    UPDATE invites
    SET used_at = NOW(),
        used_by_google_id = p_google_id
    WHERE code = p_code
      AND used_at IS NULL
      AND expires_at > NOW()
    RETURNING id INTO invite_id;

    RETURN invite_id IS NOT NULL;
END;
$$;
