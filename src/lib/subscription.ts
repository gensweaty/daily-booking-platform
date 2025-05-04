
import { supabase } from "@/lib/supabase";
import { addDays } from "date-fns";
import { SubscriptionPlan } from "@/types/subscription-types";

export const getSubscriptionPlan = async (planType: 'monthly' | 'yearly'): Promise<SubscriptionPlan> => {
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

export const createSubscription = async (userId: string, planType: 'monthly' | 'yearly') => {
  try {
    console.log('Creating subscription for user:', userId, 'with plan type:', planType);
    
    // First, check if the user profile exists
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', userId)
      .maybeSingle();
      
    if (profileError || !profile) {
      console.error('User profile not found:', profileError || 'No profile returned');
      throw new Error('User profile not found. Please try again in a moment.');
    }
    
    // Then fetch the subscription plan
    const plan = await getSubscriptionPlan(planType);
    
    if (!plan || !plan.id) {
      console.error('Invalid subscription plan:', plan);
      throw new Error('Invalid subscription plan');
    }
    
    console.log('Found plan:', plan);
    
    // Calculate dates
    const trialEndDate = addDays(new Date(), 14); // 14-day trial
    const currentPeriodStart = new Date();
    const currentPeriodEnd = addDays(currentPeriodStart, planType === 'monthly' ? 30 : 365);

    console.log('Creating subscription with dates:', {
      trialEndDate,
      currentPeriodStart,
      currentPeriodEnd
    });

    // Create the subscription using the database function with retries
    let retries = 3;
    let error;
    
    while (retries > 0) {
      const result = await supabase.rpc('create_subscription', {
        p_user_id: userId,
        p_plan_id: plan.id,
        p_plan_type: planType,
        p_trial_end_date: trialEndDate.toISOString(),
        p_current_period_start: currentPeriodStart.toISOString(),
        p_current_period_end: currentPeriodEnd.toISOString()
      });
      
      if (!result.error) {
        return { success: true };
      }
      
      error = result.error;
      console.log(`Retry attempt ${4 - retries} failed:`, error);
      retries--;
      
      // Wait a bit before retrying
      if (retries > 0) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    throw new Error(`Failed to create subscription after retries: ${error?.message}`);
  } catch (error: any) {
    console.error('Error in createSubscription:', error);
    throw new Error(error.message || 'Failed to create subscription');
  }
};
