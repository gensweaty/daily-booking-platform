import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Navigate } from "react-router-dom";
import { DashboardContent, DashboardView } from "@/components/dashboard/DashboardContent";
import { SubscriptionCountdown } from "@/components/subscription/SubscriptionCountdown";
import { TrialExpiredDialog } from "@/components/TrialExpiredDialog";
import { RedeemCodeDialog } from "@/components/subscription/RedeemCodeDialog";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { SEOManager } from "@/components/SEOManager";

const Index = () => {
  const { user, isLoading } = useAuth();
  const [currentView, setCurrentView] = useState<DashboardView>("calendar");
  const [showTrialExpired, setShowTrialExpired] = useState(false);
  const [showRedeemDialog, setShowRedeemDialog] = useState(false);

  const { data: subscriptionData, isLoading: isLoadingSubscription } = useQuery(
    ['subscription'],
    async () => {
      if (!user?.id) return null;

      const { data, error } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (error) {
        console.error("Error fetching subscription:", error);
        return null;
      }

      return data;
    },
    {
      enabled: !!user?.id,
      refetchOnMount: true,
      refetchOnReconnect: true,
      refetchOnWindowFocus: true,
    }
  );

  useEffect(() => {
    if (user && subscriptionData?.trial_ends_at) {
      const trialEndsAt = new Date(subscriptionData.trial_ends_at);
      const now = new Date();

      if (trialEndsAt < now) {
        setShowTrialExpired(true);
      }
    }
  }, [user, subscriptionData]);

  const isSubscriptionActive = subscriptionData?.status === 'active' || subscriptionData?.status === 'trialing';

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/signin" replace />;
  }

  if (showTrialExpired) {
    return (
      <>
        <TrialExpiredDialog
          isOpen={showTrialExpired}
          onClose={() => setShowTrialExpired(false)}
          onRedeemCode={() => {
            setShowTrialExpired(false);
            setShowRedeemDialog(true);
          }}
        />
      </>
    );
  }

  return (
    <>
      <SEOManager 
        title="Dashboard - SmartBookly" 
        description="Manage your calendar, tasks, and bookings in one place"
      />
      
      {isSubscriptionActive && (
        <SubscriptionCountdown 
          subscriptionEndDate={subscriptionData?.subscription_end || null}
          isLoading={isLoadingSubscription}
        />
      )}

      <DashboardContent 
        currentView={currentView}
        onViewChange={setCurrentView}
      />

      <TrialExpiredDialog
        isOpen={showTrialExpired}
        onClose={() => setShowTrialExpired(false)}
        onRedeemCode={() => {
          setShowTrialExpired(false);
          setShowRedeemDialog(true);
        }}
      />

      <RedeemCodeDialog
        isOpen={showRedeemDialog}
        onClose={() => setShowRedeemDialog(false)}
      />
    </>
  );
};

export default Index;
