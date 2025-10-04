
import { supabase } from "@/lib/supabase";
import { addDays } from "date-fns";
import { SubscriptionPlan } from "@/types/subscription-types";

export const getSubscriptionPlan = async (planType: 'monthly' | 'yearly' | 'ultimate'): Promise<SubscriptionPlan> => {
  const { data: plans, error } = await supabase
    .from('subscription_plans')
    .select('*')
    .eq('type', planType)
    .maybeSingle();

  if (error) {
    console.error('Error fetching subscription plan:', error);
    throw new Error(`Failed to fetch subscription plan: ${error.message}`);
  }

  if (!plans) {
    console.error('No subscription plan found for type:', planType);
    throw new Error(`No subscription plan found for type: ${planType}`);
  }

  return plans as SubscriptionPlan;
};

export const createSubscription = async (userId: string, planType: 'monthly' | 'yearly' | 'ultimate') => {
  try {
    console.log('Creating subscription for user:', userId, 'with plan type:', planType);
    
    // First, fetch the subscription plan
    const plan = await getSubscriptionPlan(planType);
    
    if (!plan || !plan.id) {
      console.error('Invalid subscription plan:', plan);
      throw new Error('Invalid subscription plan');
    }
    
    console.log('Found plan:', plan);
    
    // Calculate dates based on plan type
    let trialEndDate, currentPeriodStart, currentPeriodEnd;
    
    if (planType === 'ultimate') {
      // Ultimate plan has no trial or end date
      trialEndDate = null;
      currentPeriodStart = new Date();
      currentPeriodEnd = null;
    } else {
      // Regular trial for monthly/yearly
      trialEndDate = addDays(new Date(), 14);
      currentPeriodStart = new Date();
      currentPeriodEnd = addDays(currentPeriodStart, planType === 'monthly' ? 30 : 365);
    }

    console.log('Creating subscription with dates:', {
      trialEndDate,
      currentPeriodStart,
      currentPeriodEnd
    });

    // Create the subscription using the database function
    const { error } = await supabase.rpc('create_subscription', {
      p_user_id: userId,
      p_plan_id: plan.id,
      p_plan_type: planType,
      p_trial_end_date: trialEndDate?.toISOString() || null,
      p_current_period_start: currentPeriodStart.toISOString(),
      p_current_period_end: currentPeriodEnd?.toISOString() || null
    });

    if (error) {
      console.error('Error creating subscription:', error);
      throw new Error(`Failed to create subscription: ${error.message}`);
    }

    return { success: true };
  } catch (error: any) {
    console.error('Error in createSubscription:', error);
    throw new Error(error.message || 'Failed to create subscription');
  }
};

// Updated function to redeem a code and upgrade subscription
export const redeemCode = async (code: string): Promise<{ success: boolean; message: string }> => {
  try {
    console.log('=== REDEEM CODE PROCESS START ===');
    console.log('Code to redeem:', code);
    
    // Step 1: Check authentication
    const { data: userData, error: userError } = await supabase.auth.getUser();
    
    if (userError || !userData?.user) {
      console.error('Authentication failed:', userError);
      return { success: false, message: 'Please log in to redeem codes.' };
    }

    const userId = userData.user.id;
    console.log('User authenticated:', userId);

    // Step 2: Validate code format
    if (!code || code.trim().length === 0) {
      console.log('Empty code provided');
      return { success: false, message: 'Please enter a valid code.' };
    }

    const trimmedCode = code.trim();
    console.log('Trimmed code:', trimmedCode);

    // Step 3: Check if user already has ultimate subscription
    console.log('Checking existing subscription...');
    const { data: existingSub, error: subError } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (subError) {
      console.error('Error checking existing subscription:', subError);
      return { success: false, message: 'Database error. Please try again.' };
    }

    if (existingSub && existingSub.plan_type === 'ultimate') {
      console.log('User already has ultimate subscription');
      return { success: false, message: 'You already have unlimited access.' };
    }

    console.log('Existing subscription:', existingSub);

    // Step 4: Use the database function to validate and redeem code
    // This function now handles both validation AND subscription creation atomically
    console.log('Redeeming code using database function...');
    
    const { data: redeemResult, error: redeemError } = await supabase
      .rpc('validate_and_use_redeem_code', {
        p_code: trimmedCode,
        p_user_id: userId
      });

    if (redeemError) {
      console.error('Error calling redeem function:', redeemError);
      return { success: false, message: `Database error: ${redeemError.message}` };
    }

    console.log('Redeem function result:', redeemResult);

    if (!redeemResult) {
      console.log('Code redemption failed - function returned false');
      return { success: false, message: 'Invalid code or code has already been used.' };
    }

    // Success! The database function has already created the ultimate subscription
    console.log('=== REDEEM CODE PROCESS SUCCESS ===');
    return { 
      success: true, 
      message: 'Code redeemed successfully! You now have unlimited access.' 
    };

  } catch (error: any) {
    console.error('=== REDEEM CODE PROCESS ERROR ===');
    console.error('Unexpected error in redeemCode:', error);
    return { 
      success: false, 
      message: error.message || 'An unexpected error occurred. Please try again.' 
    };
  }
};
