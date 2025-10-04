
CREATE OR REPLACE FUNCTION public.validate_and_use_redeem_code(p_code TEXT, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_code_record redeem_codes%ROWTYPE;
  v_plan_id UUID;
BEGIN
  -- Lock code and check validity
  SELECT * INTO v_code_record
  FROM redeem_codes
  WHERE code = p_code
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE NOTICE 'Code not found: %', p_code;
    RETURN FALSE;
  END IF;

  IF v_code_record.is_used THEN
    RAISE NOTICE 'Code already used: %', p_code;
    RETURN FALSE;
  END IF;

  -- Get the "ultimate" plan ID
  SELECT id INTO v_plan_id
  FROM subscription_plans
  WHERE type = 'ultimate'
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ultimate plan not found';
  END IF;

  -- Mark code as used
  UPDATE redeem_codes
  SET is_used = TRUE, used_by = p_user_id, used_at = NOW()
  WHERE id = v_code_record.id;

  -- Create/overwrite subscription
  INSERT INTO subscriptions (
    user_id, plan_id, plan_type, current_period_start, current_period_end, trial_end_date, created_at
  ) VALUES (
    p_user_id, v_plan_id, 'ultimate', NOW(), NULL, NULL, NOW()
  )
  ON CONFLICT (user_id) DO UPDATE SET
    plan_id = EXCLUDED.plan_id,
    plan_type = EXCLUDED.plan_type,
    current_period_start = EXCLUDED.current_period_start,
    current_period_end = NULL,
    trial_end_date = NULL,
    updated_at = NOW();

  RETURN TRUE;
END;
$$;
