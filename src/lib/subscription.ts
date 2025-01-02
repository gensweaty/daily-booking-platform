import { supabase } from "@/lib/supabase";
import { addDays } from "date-fns";

export const createSubscription = async (userId: string, planType: string) => {
  try {
    // Get the subscription plan ID
    const { data: plans, error: planError } = await supabase
      .from('subscription_plans')
      .select('id')
      .eq('type', planType)
      .maybeSingle();

    if (planError) throw planError;
    if (!plans) throw new Error(`No subscription plan found for type: ${planType}`);

    const trialEndDate = addDays(new Date(), 14); // 14-day trial
    const currentPeriodStart = new Date();
    const currentPeriodEnd = addDays(currentPeriodStart, planType === 'monthly' ? 30 : 365);

    // Call the create_subscription function
    const { error } = await supabase.rpc('create_subscription', {
      p_user_id: userId,
      p_plan_id: plans.id,
      p_plan_type: planType,
      p_trial_end_date: trialEndDate.toISOString(),
      p_current_period_start: currentPeriodStart.toISOString(),
      p_current_period_end: currentPeriodEnd.toISOString()
    });

    if (error) throw error;
  } catch (error: any) {
    console.error('Error creating subscription:', error);
    throw error;
  }
};