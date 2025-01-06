import { supabase } from "@/lib/supabase";

export const updateSubscriptionStatus = async (
  planType: 'monthly' | 'yearly',
  onSuccess?: (orderId: string) => void,
  orderId?: string
) => {
  const currentDate = new Date();
  const nextChargeDate = new Date(currentDate);
  
  if (planType === 'monthly') {
    nextChargeDate.setMonth(nextChargeDate.getMonth() + 1);
  } else {
    nextChargeDate.setFullYear(nextChargeDate.getFullYear() + 1);
  }

  console.log('Updating subscription with dates:', {
    currentDate: currentDate.toISOString(),
    nextChargeDate: nextChargeDate.toISOString()
  });

  const { error } = await supabase
    .from('subscriptions')
    .update({
      status: 'active',
      current_period_start: currentDate.toISOString(),
      current_period_end: nextChargeDate.toISOString(),
      plan_type: planType,
      last_payment_id: orderId
    })
    .eq('status', 'expired');

  if (error) {
    console.error('Error updating subscription:', error);
    throw error;
  }

  console.log('Subscription updated successfully');

  if (onSuccess && orderId) {
    onSuccess(orderId);
  }
};