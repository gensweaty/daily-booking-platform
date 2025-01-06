import { supabase } from "@/lib/supabase";

export const updateSubscriptionStatus = async (planType: 'monthly' | 'yearly') => {
  const currentDate = new Date();
  const nextPeriodEnd = new Date(currentDate);
  
  if (planType === 'monthly') {
    nextPeriodEnd.setMonth(nextPeriodEnd.getMonth() + 1);
  } else {
    nextPeriodEnd.setFullYear(nextPeriodEnd.getFullYear() + 1);
  }

  const { error } = await supabase
    .from('subscriptions')
    .update({
      status: 'active',
      current_period_start: currentDate.toISOString(),
      current_period_end: nextPeriodEnd.toISOString(),
      plan_type: planType
    })
    .eq('status', 'expired');

  if (error) throw error;
};