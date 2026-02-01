import logging
from app.config import LLM_CALL_COST, IMAGE_CALL_COST
from app.utils.db import get_supabase

logger = logging.getLogger(__name__)


class InsufficientCreditsError(Exception):
    def __init__(self, required: int, available: int):
        self.required = required
        self.available = available
        super().__init__(f"Insufficient credits: need {required}, have {available}")


def is_admin(user) -> bool:
    return bool(getattr(user, 'is_admin', False))


def get_user_credits(user_id: int) -> int:
    sb = get_supabase()
    result = sb.table('users').select('credits').eq('id', user_id).execute()
    if result.data:
        return result.data[0]['credits']
    return 0


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


def deduct_llm_credit(user) -> dict:
    return deduct_credits(user, LLM_CALL_COST)


def deduct_image_credit(user) -> dict:
    return deduct_credits(user, IMAGE_CALL_COST)


def check_can_afford(user, amount: int) -> bool:
    if is_admin(user):
        return True
    current_credits = get_user_credits(user.id)
    return current_credits >= amount


def calculate_style_ref_upload_cost() -> dict:
    llm_calls = 2
    image_calls = 0
    total = llm_calls * LLM_CALL_COST + image_calls * IMAGE_CALL_COST
    return {
        'llm_calls': llm_calls,
        'image_calls': image_calls,
        'total': total,
    }


def calculate_generation_cost(
    use_style_image: bool,
    base_image_only: bool,
    reference_mode: str,
    text_blending_mode: str,
    style_ref_has_clean: bool = False,
    style_ref_has_text: bool = False,
    two_step_generation: bool = True,
) -> dict:
    llm_calls = 0
    image_calls = 0

    if base_image_only:
        llm_calls = 1
        image_calls = 1
    elif use_style_image:
        if two_step_generation:
            llm_calls = 2
            image_calls = 2

            if reference_mode in ('both', 'background') and not style_ref_has_clean:
                image_calls += 1

            if reference_mode in ('both', 'text') and not style_ref_has_text:
                image_calls += 1
                llm_calls += 1
                image_calls += 1

            if text_blending_mode == 'ai' and reference_mode in ('both', 'text'):
                llm_calls += 1
                image_calls += 2
            elif text_blending_mode == 'programmatic' and reference_mode in ('both', 'text'):
                image_calls += 1
            else:
                pass
        else:
            llm_calls = 1
            image_calls = 1

            if reference_mode in ('both', 'background') and not style_ref_has_clean:
                image_calls += 1

            if reference_mode in ('both', 'text') and not style_ref_has_text:
                image_calls += 1
                llm_calls += 1
                image_calls += 1
    else:
        llm_calls = 2
        image_calls = 2

    total = llm_calls * LLM_CALL_COST + image_calls * IMAGE_CALL_COST

    return {
        'llm_calls': llm_calls,
        'image_calls': image_calls,
        'total': total,
        'breakdown': {
            'llm_cost_per_call': LLM_CALL_COST,
            'image_cost_per_call': IMAGE_CALL_COST,
        }
    }


def validate_generation_credits(
    user,
    use_style_image: bool,
    base_image_only: bool,
    reference_mode: str,
    text_blending_mode: str,
    style_ref_has_clean: bool = False,
    style_ref_has_text: bool = False,
    two_step_generation: bool = True,
) -> dict:
    cost_info = calculate_generation_cost(
        use_style_image=use_style_image,
        base_image_only=base_image_only,
        reference_mode=reference_mode,
        text_blending_mode=text_blending_mode,
        style_ref_has_clean=style_ref_has_clean,
        style_ref_has_text=style_ref_has_text,
        two_step_generation=two_step_generation,
    )

    if is_admin(user):
        return {
            'can_afford': True,
            'user_credits': user.credits,
            **cost_info,
        }

    current_credits = get_user_credits(user.id)
    can_afford = current_credits >= cost_info['total']

    return {
        'can_afford': can_afford,
        'user_credits': current_credits,
        **cost_info,
    }
