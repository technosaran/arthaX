-- Add gemini_api_key and gemini_enabled to the Telegram user context RPC
-- so the AI engine can use the key stored in the user's profile

CREATE OR REPLACE FUNCTION public.get_telegram_user_context(p_chat_id TEXT)
RETURNS JSONB AS $$
DECLARE
    v_profile RECORD;
    v_accounts JSONB;
    v_family JSONB;
    v_goals JSONB;
    v_acc_count INT;
BEGIN
    SELECT id, username, base_currency, default_accounts, gemini_api_key, gemini_enabled INTO v_profile
    FROM public.profiles
    WHERE telegram_chat_id = p_chat_id;

    IF v_profile.id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Telegram account not linked');
    END IF;

    SELECT COUNT(*) INTO v_acc_count FROM public.accounts WHERE user_id = v_profile.id;
    IF v_acc_count = 0 THEN
        INSERT INTO public.accounts (user_id, name, type, balance, currency, notes)
        VALUES (v_profile.id, 'Main Account', 'Checking', 100000, COALESCE(v_profile.base_currency, 'INR'), 'Default primary account');
    END IF;

    SELECT COALESCE(jsonb_agg(t), '[]'::jsonb) INTO v_accounts
    FROM (SELECT id, name, notes, balance, type FROM public.accounts WHERE user_id = v_profile.id ORDER BY balance DESC) t;

    SELECT COALESCE(jsonb_agg(t), '[]'::jsonb) INTO v_family
    FROM (SELECT id, name, relationship, balance FROM public.family_members WHERE user_id = v_profile.id) t;

    SELECT COALESCE(jsonb_agg(t), '[]'::jsonb) INTO v_goals
    FROM (SELECT id, name, target_amount, current_amount FROM public.goals WHERE user_id = v_profile.id) t;

    RETURN jsonb_build_object(
        'success', true,
        'profile', jsonb_build_object(
            'id', v_profile.id,
            'username', v_profile.username,
            'base_currency', v_profile.base_currency,
            'default_accounts', v_profile.default_accounts,
            'gemini_api_key', v_profile.gemini_api_key,
            'gemini_enabled', v_profile.gemini_enabled
        ),
        'accounts', v_accounts,
        'familyMembers', v_family,
        'goals', v_goals
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
