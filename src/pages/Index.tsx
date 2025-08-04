
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

interface SubscriptionData {
  status: string;
  trial_ends_at: string;
  subscription_end: string;
}

const Index = () => {
  const { user } = useAuth();
  const [currentView, setCurrentView] = useState<DashboardView>("calendar");
  const [showTrialExpired, setShowTrialExpired] = useState(false);
  const [showRedeemDialog, setShowRedeemDialog] = useState(false);

  const { data: subscriptionData, isLoading: isLoadingSubscription } = useQuery({
    queryKey: ['subscription'],
    queryFn: async () => {
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

      return data as SubscriptionData;
    },
    enabled: !!user?.id,
    refetchOnMount: true,
    refetchOnReconnect: true,
    refetchOnWindowFocus: true,
  });

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

  if (!user) {
    return <Navigate to="/signin" replace />;
  }

  if (showTrialExpired) {
    return (
      <>
        <TrialExpiredDialog
          open={showTrialExpired}
          onOpenChange={setShowTrialExpired}
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
      <SEOManager />
      
      {isSubscriptionActive && (
        <SubscriptionCountdown 
          subscription_end_date={subscriptionData?.subscription_end || null}
          status={subscriptionData?.status || 'expired'}
        />
      )}

      <DashboardContent 
        currentView={currentView}
        onViewChange={setCurrentView}
      />

      <TrialExpiredDialog
        open={showTrialExpired}
        onOpenChange={setShowTrialExpired}
        onRedeemCode={() => {
          setShowTrialExpired(false);
          setShowRedeemDialog(true);
        }}
      />

      <RedeemCodeDialog
        open={showRedeemDialog}
        onOpenChange={setShowRedeemDialog}
      />
    </>
  );
};

export default Index;
