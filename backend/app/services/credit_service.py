import logging
from flask import current_app

logger = logging.getLogger(__name__)


def is_owner(user) -> bool:
    owner_email = current_app.config.get('OWNER_EMAIL', '')
    return bool(owner_email and user.email == owner_email)


def deduct_credits(user, amount: int) -> dict:
    if is_owner(user):
        logger.info("Owner user id=%s: skipping credit deduction (%d)", user.id, amount)
        return {'success': True, 'remaining': user.credits}

    sb = current_app.supabase
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
    if is_owner(user):
        return user.credits

    sb = current_app.supabase
    result = sb.table('users').update(
        {'credits': user.credits + amount}
    ).eq('id', user.id).execute()

    new_credits = result.data[0]['credits'] if result.data else user.credits + amount
    logger.info("Refunded %d credits to user id=%s (now=%s)", amount, user.id, new_credits)
    return new_credits
