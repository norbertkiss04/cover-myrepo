import logging
from app.utils.db import get_supabase

logger = logging.getLogger(__name__)


def is_admin(user) -> bool:
    return bool(getattr(user, 'is_admin', False))


def deduct_credits(user, amount: int) -> dict:
    if is_admin(user):
        logger.info("Admin user id=%s: skipping credit deduction (%d)", user.id, amount)
        return {'success': True, 'remaining': user.credits}

    sb = get_supabase()
    result = sb.rpc('deduct_credits', {
        'p_user_id': user.id,
        'p_amount': amount,
    }).execute()

    if result.data is not None and result.data is not False:
        remaining = result.data
        logger.info("Deducted %d credits from user id=%s (remaining=%s)", amount, user.id, remaining)
        return {'success': True, 'remaining': remaining}

    logger.warning("Insufficient credits for user id=%s (needed=%d, has=%d)", user.id, amount, user.credits)
    return {'success': False, 'remaining': user.credits}


def refund_credits(user, amount: int) -> int:
    if is_admin(user):
        return user.credits

    sb = get_supabase()
    result = sb.rpc('refund_credits', {
        'p_user_id': user.id,
        'p_amount': amount,
    }).execute()

    new_credits = result.data if result.data is not None else user.credits + amount
    logger.info("Refunded %d credits to user id=%s (now=%s)", amount, user.id, new_credits)
    return new_credits
