import { useState } from 'react';
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";
import { useNavigate } from 'react-router-dom';

export const usePayPalSubscription = (planType: 'monthly' | 'yearly' | 'test', onSuccess?: (subscriptionId: string) => void) => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [isProcessing, setIsProcessing] = useState(false);

  const handlePaymentSuccess = async (orderId: string, subscriptionId: string) => {
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
      } else if (planType === 'yearly') {
        nextPeriodEnd.setFullYear(nextPeriodEnd.getFullYear() + 1);
      } else {
        // Test plan - 1 hour
        nextPeriodEnd.setHours(nextPeriodEnd.getHours() + 1);
      }

      // Update subscription status
      const { error: updateError } = await supabase
        .from('subscriptions')
        .update({
          status: 'active',
          current_period_start: currentDate.toISOString(),
          current_period_end: nextPeriodEnd.toISOString(),
          last_payment_id: orderId
        })
        .eq('id', subscriptionId);

      if (updateError) throw updateError;

      if (onSuccess) {
        onSuccess(subscriptionId);
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