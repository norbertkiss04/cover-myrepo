CREATE OR REPLACE FUNCTION refund_credits(p_user_id BIGINT, p_amount INT)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    new_credits INT;
BEGIN
    UPDATE users
    SET credits = credits + p_amount,
        updated_at = NOW()
    WHERE id = p_user_id
    RETURNING credits INTO new_credits;

    RETURN new_credits;
END;
$$;
