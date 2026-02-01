CREATE OR REPLACE FUNCTION deduct_credits(p_user_id BIGINT, p_amount INT)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    current_credits INT;
    new_credits INT;
BEGIN
    SELECT credits INTO current_credits
    FROM users
    WHERE id = p_user_id
    FOR UPDATE;

    IF current_credits IS NULL OR current_credits < p_amount THEN
        RETURN NULL;
    END IF;

    UPDATE users
    SET credits = credits - p_amount,
        updated_at = NOW()
    WHERE id = p_user_id
      AND credits >= p_amount
    RETURNING credits INTO new_credits;

    RETURN new_credits;
END;
$$;
