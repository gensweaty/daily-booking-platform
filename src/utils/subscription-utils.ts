import { supabase } from "@/lib/supabase";
import { PayPalPlanType } from "@/types/paypal-types";

export const updateSubscription = async (
  userId: string,
  planType: PayPalPlanType,
  orderId: string
) => {
  const currentDate = new Date();
  const nextPeriodEnd = new Date(currentDate);
  
  switch (planType) {
    case 'monthly':
      nextPeriodEnd.setMonth(nextPeriodEnd.getMonth() + 1);
      break;
    case 'yearly':
      nextPeriodEnd.setFullYear(nextPeriodEnd.getFullYear() + 1);
      break;
    case 'test':
      // Test subscription lasts for 1 hour
      nextPeriodEnd.setHours(nextPeriodEnd.getHours() + 1);
      break;
  }

  // First try to update existing subscription
  const { data: existingSubscription, error: fetchError } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (existingSubscription) {
    const { error: updateError } = await supabase
      .from('subscriptions')
      .update({
        status: 'active',
        current_period_start: currentDate.toISOString(),
        current_period_end: nextPeriodEnd.toISOString(),
        plan_type: planType,
        last_payment_id: orderId
      })
      .eq('user_id', userId);

    if (updateError) throw updateError;
  } else {
    // If no subscription exists, create a new one
    const { error: insertError } = await supabase
      .from('subscriptions')
      .insert({
        user_id: userId,
        plan_type: planType,
        status: 'active',
        current_period_start: currentDate.toISOString(),
        current_period_end: nextPeriodEnd.toISOString(),
        last_payment_id: orderId
      });

    if (insertError) throw insertError;
  }
};