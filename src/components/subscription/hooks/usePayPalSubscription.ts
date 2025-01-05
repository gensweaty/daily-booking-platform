import { useState } from 'react';
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";
import { useNavigate } from 'react-router-dom';

export const usePayPalSubscription = (planType: 'monthly' | 'yearly', onSuccess?: (subscriptionId: string) => void) => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [isProcessing, setIsProcessing] = useState(false);

  const handlePaymentSuccess = async (orderId: string) => {
    if (isProcessing) return;
    
    setIsProcessing(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        throw new Error('No authenticated user found');
      }

      const currentDate = new Date();
      const nextPeriodEnd = new Date(currentDate);
      
      if (planType === 'monthly') {
        nextPeriodEnd.setMonth(nextPeriodEnd.getMonth() + 1);
      } else {
        nextPeriodEnd.setFullYear(nextPeriodEnd.getFullYear() + 1);
      }

      // First try to update existing subscription
      const { data: existingSubscription, error: fetchError } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (fetchError && fetchError.code !== 'PGRST116') { // PGRST116 is "no rows returned"
        throw fetchError;
      }

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
          .eq('user_id', user.id);

        if (updateError) throw updateError;
      } else {
        // If no subscription exists, create a new one
        const { error: insertError } = await supabase
          .from('subscriptions')
          .insert({
            user_id: user.id,
            plan_type: planType,
            status: 'active',
            current_period_start: currentDate.toISOString(),
            current_period_end: nextPeriodEnd.toISOString(),
            last_payment_id: orderId
          });

        if (insertError) throw insertError;
      }

      if (onSuccess) {
        onSuccess(orderId);
      }

      toast({
        title: "Success",
        description: "Your subscription has been activated successfully!",
      });

      // Redirect to the dashboard with subscription parameter
      navigate(`/dashboard?subscription=${planType}`);
    } catch (error: any) {
      console.error('Payment processing error:', error);
      toast({
        title: "Error",
        description: "There was an error processing your payment. Please contact support.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return {
    handlePaymentSuccess,
    isProcessing
  };
};