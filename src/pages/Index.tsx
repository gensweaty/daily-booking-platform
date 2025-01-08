import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { AuthUI } from "@/components/AuthUI";
import { DashboardHeader } from "@/components/DashboardHeader";
import { TrialExpiredDialog } from "@/components/TrialExpiredDialog";
import { SubscriptionHandler } from "@/components/subscription/SubscriptionHandler";
import { DashboardContent } from "@/components/dashboard/DashboardContent";
import { useSearchParams } from "react-router-dom";

const Index = () => {
  const [username, setUsername] = useState("");
  const [showTrialExpired, setShowTrialExpired] = useState(false);
  const { user } = useAuth();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const checkSubscriptionStatus = async () => {
      if (!user) return;

      try {
        console.log('Checking subscription status for user:', user.email);
        
        // Don't show trial expired dialog if there's a subscription parameter
        const subscriptionParam = searchParams.get('subscription');
        if (subscriptionParam) {
          console.log('Subscription parameter found:', subscriptionParam);
          setShowTrialExpired(false);
          return;
        }

        const { data: subscription, error } = await supabase
          .from('subscriptions')
          .select('status, current_period_end, trial_end_date')
          .eq('user_id', user.id)
          .eq('status', 'active')
          .maybeSingle();

        console.log('Fetched subscription:', subscription);

        if (error && !error.message.includes('Results contain 0 rows')) {
          console.error('Error checking subscription:', error);
          return;
        }

        if (!subscription || 
            subscription.status === 'expired' || 
            (subscription.current_period_end && new Date(subscription.current_period_end) < new Date())) {
          console.log('Subscription expired or not found');
          setShowTrialExpired(true);
        } else {
          setShowTrialExpired(false);
        }
      } catch (error) {
        console.error('Subscription check error:', error);
      }
    };

    checkSubscriptionStatus();
  }, [user, searchParams]);

  useEffect(() => {
    const getProfile = async () => {
      if (user) {
        try {
          const { data, error } = await supabase
            .from('profiles')
            .select('username')
            .eq('id', user.id)
            .single();
          
          if (error) throw error;
          if (data) setUsername(data.username);
        } catch (error) {
          console.error('Profile fetch error:', error);
        }
      }
    };

    getProfile();
  }, [user]);

  if (!user) {
    return <AuthUI />;
  }

  return (
    <div className="min-h-screen bg-background p-4">
      <SubscriptionHandler />
      {showTrialExpired && <TrialExpiredDialog />}
      <DashboardHeader username={username} />
      <DashboardContent username={username} />
    </div>
  );
};

export default Index;