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
    console.log('Starting redeem code process for code:', code);
    
    const { data: userData, error: userError } = await supabase.auth.getUser();
    
    if (userError || !userData?.user) {
      console.error('User authentication error:', userError);
      throw new Error("User not authenticated");
    }

    console.log('User authenticated:', userData.user.id);

    // First check if the code exists and is valid
    const { data: codeCheck, error: codeCheckError } = await supabase
      .from('redeem_codes')
      .select('*')
      .eq('code', code.trim())
      .eq('is_used', false)
      .maybeSingle();

    if (codeCheckError) {
      console.error('Error checking redeem code:', codeCheckError);
      return { success: false, message: 'Error validating code. Please try again.' };
    }

    if (!codeCheck) {
      console.log('Code not found or already used');
      return { success: false, message: 'Invalid or already used code.' };
    }

    console.log('Code is valid, proceeding with redemption');

    // Call the validate_and_use_redeem_code function
    const { data: result, error } = await supabase.rpc('validate_and_use_redeem_code', {
      p_code: code.trim(),
      p_user_id: userData.user.id
    });

    console.log('Database function result:', result, 'Error:', error);

    if (error) {
      console.error('Error calling validate_and_use_redeem_code:', error);
      return { success: false, message: 'Failed to process redeem code. Please try again.' };
    }

    if (result) {
      console.log('Code redeemed successfully');
      return { success: true, message: 'Code redeemed successfully! You now have unlimited access.' };
    } else {
      console.log('Code redemption failed - function returned false');
      return { success: false, message: 'Failed to redeem code. Please contact support.' };
    }
  } catch (error: any) {
    console.error('Error in redeemCode:', error);
    return { success: false, message: error.message || 'Failed to redeem code' };
  }
};
