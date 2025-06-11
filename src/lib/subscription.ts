
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

// New function to redeem a code and upgrade subscription
export const redeemCode = async (code: string): Promise<{ success: boolean; message: string }> => {
  try {
    const { data: userData, error: userError } = await supabase.auth.getUser();
    
    if (userError || !userData?.user) {
      throw new Error("User not authenticated");
    }

    // Call the validate_and_use_redeem_code function
    const { data: result, error } = await supabase.rpc('validate_and_use_redeem_code', {
      p_code: code,
      p_user_id: userData.user.id
    });

    if (error) {
      console.error('Error redeeming code:', error);
      throw new Error('Failed to redeem code');
    }

    if (result) {
      return { success: true, message: 'Code redeemed successfully! You now have unlimited access.' };
    } else {
      return { success: false, message: 'Invalid or already used code.' };
    }
  } catch (error: any) {
    console.error('Error in redeemCode:', error);
    return { success: false, message: error.message || 'Failed to redeem code' };
  }
};
