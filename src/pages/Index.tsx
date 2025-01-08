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
        
        // Get the most recent active subscription
        const { data: subscription, error } = await supabase
          .from('subscriptions')
          .select('status, current_period_end, trial_end_date')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        if (error && !error.message.includes('Results contain 0 rows')) {
          console.error('Error checking subscription:', error);
          return;
        }

        // Log the subscription data for debugging
        console.log('Fetched subscription:', subscription);

        // Don't show trial expired dialog if there's a subscription parameter in the URL
        const subscriptionParam = searchParams.get('subscription');
        if (subscriptionParam) {
          console.log('Subscription parameter found:', subscriptionParam);
          setShowTrialExpired(false);
          return;
        }

        // Check subscription status
        if (!subscription || 
            subscription.status === 'expired' || 
            (subscription.current_period_end && new Date(subscription.current_period_end) < new Date())) {
          console.log('Subscription expired or not found');
          setShowTrialExpired(true);
        } else {
          console.log('Active subscription found');
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
            .maybeSingle();
          
          if (error) {
            console.error('Error fetching profile:', error);
            return;
          }
          
          if (data) {
            setUsername(data.username);
          }
        } catch (error: any) {
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