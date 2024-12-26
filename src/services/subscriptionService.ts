import { supabase } from "@/lib/supabase";
import { SubscriptionPlan, Subscription } from "@/types/subscription";

export const subscriptionService = {
  async getPlans(): Promise<SubscriptionPlan[]> {
    const { data, error } = await supabase
      .from('subscription_plans')
      .select('*')
      .order('price', { ascending: true });

    if (error) {
      console.error('Error fetching subscription plans:', error);
      throw error;
    }

    return data;
  },

  async getCurrentSubscription(userId: string): Promise<Subscription | null> {
    const { data, error } = await supabase
      .from('subscriptions')
      .select(`
        *,
        subscription_plans (
          id,
          name,
          type,
          price,
          description
        )
      `)
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      console.error('Error fetching current subscription:', error);
      throw error;
    }

    return data;
  },

  async createTrialSubscription(
    userId: string,
    planId: string,
    planType: string
  ): Promise<void> {
    const trialEndDate = new Date();
    trialEndDate.setDate(trialEndDate.getDate() + 14);
    const currentDate = new Date();

    const { error } = await supabase.rpc('create_subscription', {
      p_user_id: userId,
      p_plan_id: planId,
      p_plan_type: planType,
      p_trial_end_date: trialEndDate.toISOString(),
      p_current_period_start: currentDate.toISOString(),
      p_current_period_end: trialEndDate.toISOString()
    });

    if (error) {
      console.error('Error creating trial subscription:', error);
      throw error;
    }
  }
};