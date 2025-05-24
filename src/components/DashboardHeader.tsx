import { Button } from "@/components/ui/button";
import { LogOut, User, RefreshCw } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useToast } from "@/components/ui/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useTheme } from "next-themes";
import { Link } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { GeorgianAuthText } from "@/components/shared/GeorgianAuthText";
import { LanguageText } from "@/components/shared/LanguageText";
import { checkSubscriptionStatus, openStripeCustomerPortal, manualSyncSubscription } from "@/utils/stripeUtils";
import { differenceInDays } from "date-fns";
import { ManageSubscriptionDialog } from "./subscription/ManageSubscriptionDialog";

interface DashboardHeaderProps {
  username: string;
}

interface Subscription {
  plan_type: string;
  status: string;
  current_period_end: string | null;
  trial_end_date: string | null;
  stripe_customer_id?: string | null;
  stripe_subscription_id?: string | null;
}

export const DashboardHeader = ({ username }: DashboardHeaderProps) => {
  const { user, signOut } = useAuth();
  const { toast } = useToast();
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { theme } = useTheme();
  const { t, language } = useLanguage();
  const isGeorgian = language === 'ka';
  const [isManageSubscriptionOpen, setIsManageSubscriptionOpen] = useState(false);
  const [isRefreshingSubscription, setIsRefreshingSubscription] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    const fetchSubscription = async () => {
      if (user) {
        try {
          setIsLoading(true);
          console.log('Checking subscription status for user:', user.email);
          
          const stripeStatus = await checkSubscriptionStatus();
          console.log('Stripe subscription status:', stripeStatus);
          
          if (stripeStatus && stripeStatus.status === 'active') {
            console.log('Active subscription found via Stripe check');
            setSubscription({
              plan_type: stripeStatus.planType || 'monthly',
              status: stripeStatus.status,
              current_period_end: stripeStatus.currentPeriodEnd || null,
              trial_end_date: null,
              stripe_customer_id: stripeStatus.stripe_customer_id || null,
              stripe_subscription_id: stripeStatus.stripe_subscription_id || null
            });
            setIsLoading(false);
            return;
          }
          
          const { data, error } = await supabase
            .from('subscriptions')
            .select('plan_type, status, current_period_end, trial_end_date, stripe_customer_id, stripe_subscription_id')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          if (error) {
            console.error('Error fetching subscription:', error);
            setIsLoading(false);
            return;
          }

          console.log('Fetched subscription from database:', data);
          
          if (data && data.status === 'active') {
            setSubscription(data);
          } else if (data) {
            if (data.stripe_subscription_id) {
              try {
                const refreshedStatus = await supabase.functions.invoke('verify-stripe-subscription', {
                  body: { 
                    user_id: user.id, 
                    subscription_id: data.stripe_subscription_id
                  }
                });
                
                console.log('Re-verified subscription with Stripe:', refreshedStatus);
                
                if (refreshedStatus.data && refreshedStatus.data.status === 'active') {
                  setSubscription({
                    ...data,
                    status: 'active',
                    current_period_end: refreshedStatus.data.currentPeriodEnd || data.current_period_end
                  });
                } else {
                  setSubscription(data);
                }
              } catch (verifyError) {
                console.error('Error re-verifying with Stripe:', verifyError);
                setSubscription(data);
              }
            } else {
              setSubscription(data);
            }
          } else {
            setSubscription(null);
          }
        } catch (error) {
          console.error('Subscription fetch error:', error);
        } finally {
          setIsLoading(false);
        }
      }
    };

    fetchSubscription();
    
    const intervalId = setInterval(fetchSubscription, 10000);
    
    return () => clearInterval(intervalId);
  }, [user]);

  const handleRefreshSubscription = async () => {
    if (!user || isRefreshingSubscription) return;
    
    setIsRefreshingSubscription(true);
    try {
      const result = await checkSubscriptionStatus();
      
      toast({
        title: "Subscription Status",
        description: `Status refreshed: ${result.status}`,
      });
      
      console.log('Manual subscription refresh result:', result);
    } catch (error) {
      console.error('Error refreshing subscription:', error);
      toast({
        title: "Error",
        description: "Failed to refresh subscription status",
        variant: "destructive",
      });
    } finally {
      setIsRefreshingSubscription(false);
    }
  };

  // NEW: Manual sync with Stripe
  const handleManualSync = async () => {
    if (!user || isSyncing) return;
    
    setIsSyncing(true);
    try {
      const result = await manualSyncSubscription();
      
      if (result.success && result.status === 'active') {
        setSubscription(prev => ({
          ...prev,
          status: 'active',
          plan_type: result.planType || prev?.plan_type || 'monthly',
          current_period_end: result.currentPeriodEnd || prev?.current_period_end || null
        }));
        
        toast({
          title: "Sync Successful",
          description: "Your subscription status has been updated from Stripe",
        });
      } else {
        toast({
          title: "Sync Complete",
          description: result.status === 'trial_expired' ? "No active subscription found" : "Subscription status verified",
        });
      }
    } catch (error) {
      console.error('Error syncing subscription:', error);
      toast({
        title: "Sync Error",
        description: "Failed to sync with Stripe. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSyncing(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (error) {
      console.error('Sign out error:', error);
      toast({
        title: "Error during sign out",
        description: "Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleChangePassword = async () => {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(user?.email || '', {
        redirectTo: 'https://daily-booking-platform.lovable.app/reset-password',
      });

      if (error) throw error;

      toast({
        title: "Password Reset Email Sent",
        description: "Please check your email for the password reset link.",
      });
    } catch (error: any) {
      console.error('Password reset error:', error);
      toast({
        title: "Error",
        description: "Failed to send password reset email. Please try again.",
        variant: "destructive",
      });
    }
  };
  
  const handleManageSubscription = async () => {
    try {
      const result = await openStripeCustomerPortal();
      if (!result) {
        setIsManageSubscriptionOpen(true);
      }
    } catch (error) {
      console.error('Error opening customer portal:', error);
      setIsManageSubscriptionOpen(true);
    }
  };

  const formatPlanType = (planType: string) => {
    return planType === 'monthly' ? 'Monthly Plan' : 'Yearly Plan';
  };

  const formatTimeLeft = (endDate: string | null, isTrialPeriod: boolean = false) => {
    if (!endDate) return '';
    
    const end = new Date(endDate);
    const now = new Date();
    const daysLeft = Math.max(0, differenceInDays(end, now));
    
    if (isTrialPeriod) {
      return `${daysLeft} days left in trial`;
    }
    
    return `${daysLeft} days left in ${subscription?.plan_type === 'monthly' ? 'monthly' : 'yearly'} plan`;
  };

  return (
    <header className="mb-4">
      <div className="flex items-center justify-between mb-3">
        <Link to="/" className="flex items-center gap-2">
          <img 
            src={theme === 'dark' 
              ? "/lovable-uploads/cfb84d8d-bdf9-4515-9179-f707416ece03.png"
              : "/lovable-uploads/d1ee79b8-2af0-490e-969d-9101627c9e52.png"
            }
            alt="SmartBookly Logo" 
            className="h-8 md:h-10 w-auto"
          />
        </Link>
        <div className="flex items-center gap-2">
          <LanguageSwitcher />
          <Dialog>
            <DialogTrigger asChild>
              <Button 
                variant="purple" 
                size="icon"
                className="text-foreground"
              >
                <User className="w-4 h-4" />
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>{t('dashboard.profile')}</DialogTitle>
              </DialogHeader>
              <div className="py-4 space-y-4">
                <div className="space-y-2">
                  <p className="text-sm font-medium">
                    {isGeorgian ? (
                      <GeorgianAuthText fontWeight="medium">ელექტრონული ფოსტა</GeorgianAuthText>
                    ) : (
                      t('auth.emailLabel')
                    )}
                  </p>
                  <p className="text-sm text-muted-foreground">{user?.email}</p>
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-medium">{t('auth.usernameLabel')}</p>
                  <p className="text-sm text-muted-foreground">{username}</p>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <p className="text-sm font-medium">Subscription</p>
                    {!isLoading && (
                      <div className="flex gap-1">
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="h-7 px-2 text-xs"
                          onClick={handleRefreshSubscription}
                          disabled={isRefreshingSubscription}
                        >
                          {isRefreshingSubscription ? (
                            <span className="flex items-center gap-1">
                              <div className="h-3 w-3 rounded-full border-2 border-t-transparent border-primary animate-spin"></div>
                              Refreshing...
                            </span>
                          ) : (
                            'Refresh'
                          )}
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="h-7 px-2 text-xs"
                          onClick={handleManualSync}
                          disabled={isSyncing}
                        >
                          {isSyncing ? (
                            <span className="flex items-center gap-1">
                              <RefreshCw className="h-3 w-3 animate-spin" />
                              Syncing...
                            </span>
                          ) : (
                            <span className="flex items-center gap-1">
                              <RefreshCw className="h-3 w-3" />
                              Sync
                            </span>
                          )}
                        </Button>
                      </div>
                    )}
                  </div>
                  {isLoading ? (
                    <p className="text-sm text-muted-foreground">Loading subscription details...</p>
                  ) : subscription ? (
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">
                        {subscription.status === 'trial' ? 'Trial Plan' : 
                         subscription.status === 'active' ? formatPlanType(subscription.plan_type) :
                         subscription.status === 'trial_expired' ? 'Trial Expired' : 
                         'No active subscription'}
                      </p>
                      {subscription.status === 'trial' ? (
                        <p className="text-xs text-muted-foreground">
                          {formatTimeLeft(subscription.trial_end_date, true)}
                        </p>
                      ) : subscription.status === 'active' && (
                        <p className="text-xs text-muted-foreground">
                          {formatTimeLeft(subscription.current_period_end)}
                        </p>
                      )}
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="mt-2 w-full"
                        onClick={handleManageSubscription}
                      >
                        Manage Subscription
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">No subscription information available</p>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="mt-2 w-full"
                        onClick={() => setIsManageSubscriptionOpen(true)}
                      >
                        Get Subscription
                      </Button>
                    </div>
                  )}
                </div>
                <div className="pt-4 space-y-2">
                  <Button 
                    variant="info" 
                    className="w-full"
                    onClick={handleChangePassword}
                  >
                    {t('dashboard.changePassword')}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
          <ThemeToggle />
          <Button 
            variant="orange" 
            className="flex items-center gap-2 text-white"
            onClick={handleSignOut}
          >
            <LogOut className="w-4 h-4" />
            {isGeorgian ? (
              <GeorgianAuthText fontWeight="bold">გამოსვლა</GeorgianAuthText>
            ) : (
              t('dashboard.signOut')
            )}
          </Button>
        </div>
      </div>
      <div className="text-center mb-2">
        <h1 className="text-xl sm:text-2xl font-bold text-primary">
          {isGeorgian ? (
            <GeorgianAuthText>მოგესალმებით</GeorgianAuthText>
          ) : (
            <LanguageText>{t('dashboard.welcome')}</LanguageText>
          )}
        </h1>
        <p className="text-sm text-foreground/80 font-bold">
          {isGeorgian ? (
            <GeorgianAuthText>თქვენი პროდუქტიულობის ცენტრი</GeorgianAuthText>
          ) : (
            <LanguageText>{t('dashboard.subtitle')}</LanguageText>
          )}
        </p>
      </div>

      <ManageSubscriptionDialog 
        open={isManageSubscriptionOpen} 
        onOpenChange={setIsManageSubscriptionOpen} 
      />
    </header>
  );
};
