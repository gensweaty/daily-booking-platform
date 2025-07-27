
CREATE OR REPLACE FUNCTION public.validate_and_use_redeem_code(
    p_code TEXT,
    p_user_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER 
SET search_path = 'public'
AS $$
DECLARE
  v_code_record redeem_codes%ROWTYPE;
  v_plan_id UUID;
  v_subscription_id UUID;
  v_rows_updated INTEGER;
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

  -- Find the user's most recent subscription and update it
  SELECT id INTO v_subscription_id
  FROM subscriptions
  WHERE user_id = p_user_id
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_subscription_id IS NOT NULL THEN
    -- Update the existing subscription to ultimate
    UPDATE subscriptions
    SET 
      plan_id = v_plan_id,
      plan_type = 'ultimate',
      status = 'active',
      subscription_start_date = NOW(),
      current_period_start = NOW(),
      current_period_end = NULL,
      trial_end_date = NULL,
      updated_at = NOW()
    WHERE id = v_subscription_id;
    
    GET DIAGNOSTICS v_rows_updated = ROW_COUNT;
    
    IF v_rows_updated = 0 THEN
      RAISE NOTICE 'Failed to update subscription: %', v_subscription_id;
      RETURN FALSE;
    END IF;
    
    RAISE NOTICE 'Updated existing subscription % to ultimate plan', v_subscription_id;
  ELSE
    -- No existing subscription, create a new one
    INSERT INTO subscriptions (
      user_id, 
      plan_id, 
      plan_type, 
      status,
      subscription_start_date,
      current_period_start, 
      current_period_end, 
      trial_end_date, 
      created_at
    ) VALUES (
      p_user_id, 
      v_plan_id, 
      'ultimate', 
      'active',
      NOW(),
      NOW(),
      NULL,
      NULL,
      NOW()
    );
    
    RAISE NOTICE 'Created new ultimate subscription for user %', p_user_id;
  END IF;

  RETURN TRUE;
END;
$$;
