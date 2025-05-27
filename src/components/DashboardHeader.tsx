
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
import { SubscriptionCountdown } from "./subscription/SubscriptionCountdown";

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
          
          const statusResult = await checkSubscriptionStatus();
          console.log('Subscription status result:', statusResult);
          
          if (statusResult && statusResult.status) {
            setSubscription({
              plan_type: statusResult.planType || 'monthly',
              status: statusResult.status,
              current_period_end: statusResult.currentPeriodEnd || null,
              trial_end_date: statusResult.trialEnd || null,
              stripe_customer_id: null,
              stripe_subscription_id: statusResult.stripe_subscription_id || null
            });
          } else {
            setSubscription(null);
          }
        } catch (error) {
          console.error('Subscription fetch error:', error);
          setSubscription(null);
        } finally {
          setIsLoading(false);
        }
      }
    };

    fetchSubscription();
    
    const intervalId = setInterval(fetchSubscription, 30000); // Check every 30 seconds
    
    return () => clearInterval(intervalId);
  }, [user]);

  const handleRefreshSubscription = async () => {
    if (!user || isRefreshingSubscription) return;
    
    setIsRefreshingSubscription(true);
    try {
      const result = await checkSubscriptionStatus();
      
      if (result && result.status) {
        setSubscription({
          plan_type: result.planType || 'monthly',
          status: result.status,
          current_period_end: result.currentPeriodEnd || null,
          stripe_customer_id: null,
          stripe_subscription_id: result.stripe_subscription_id || null
        });
      }
      
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

  const handleManualSync = async () => {
    if (!user || isSyncing) return;
    
    setIsSyncing(true);
    try {
      const result = await manualSyncSubscription();
      
      if (result.success && result.status === 'active') {
        setSubscription({
          plan_type: result.planType || 'monthly',
          status: result.status,
          current_period_end: result.currentPeriodEnd || null,
          stripe_customer_id: null,
          stripe_subscription_id: result.stripe_subscription_id || null
        });
        
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
            <DialogContent className="sm:max-w-[500px] p-0">
              <DialogHeader className="p-6 pb-4 bg-gradient-to-r from-purple-500 to-indigo-600 text-white">
                <DialogTitle className="text-2xl font-bold">Profile</DialogTitle>
              </DialogHeader>
              <div className="p-6 space-y-6">
                {/* User Information Section */}
                <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4 space-y-4">
                  <div className="grid grid-cols-1 gap-4">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                        <p className="text-sm font-semibold text-gray-600 dark:text-gray-300">Email</p>
                      </div>
                      <p className="text-base font-medium pl-4">{user?.email}</p>
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                        <p className="text-sm font-semibold text-gray-600 dark:text-gray-300">Username</p>
                      </div>
                      <p className="text-base font-medium pl-4">{username}</p>
                    </div>
                  </div>
                </div>

                {/* Subscription Section */}
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                      <p className="text-lg font-semibold">Subscription</p>
                    </div>
                    {!isLoading && (
                      <div className="flex gap-2">
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="h-8 px-3 text-xs"
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
                          className="h-8 px-3 text-xs"
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
                    <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4">
                      <div className="animate-pulse flex space-x-4">
                        <div className="rounded-full bg-gray-300 h-10 w-10"></div>
                        <div className="flex-1 space-y-2 py-1">
                          <div className="h-4 bg-gray-300 rounded w-3/4"></div>
                          <div className="h-4 bg-gray-300 rounded w-1/2"></div>
                        </div>
                      </div>
                    </div>
                  ) : subscription ? (
                    <div className="space-y-4">
                      <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-lg p-4 border border-blue-200 dark:border-blue-800">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <div className={`w-3 h-3 rounded-full ${
                              subscription.status === 'active' ? 'bg-green-500' :
                              subscription.status === 'trial' ? 'bg-blue-500' :
                              'bg-red-500'
                            }`}></div>
                            <span className="font-semibold text-lg">
                              {subscription.status === 'trial' ? 'Trial Plan' : 
                               subscription.status === 'active' ? formatPlanType(subscription.plan_type) :
                               subscription.status === 'trial_expired' ? 'Trial Expired' : 
                               'No active subscription'}
                            </span>
                          </div>
                          <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                            subscription.status === 'active' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' :
                            subscription.status === 'trial' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400' :
                            'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                          }`}>
                            {subscription.status.replace('_', ' ')}
                          </span>
                        </div>
                        
                        {/* Countdown Component */}
                        {(subscription.status === 'trial' || subscription.status === 'active') && (
                          <SubscriptionCountdown
                            status={subscription.status as 'trial' | 'active'}
                            currentPeriodEnd={subscription.current_period_end}
                            trialEnd={subscription.trial_end_date}
                            planType={subscription.plan_type as 'monthly' | 'yearly'}
                          />
                        )}
                      </div>
                      
                      <Button 
                        variant="outline" 
                        className="w-full h-12 font-medium bg-gradient-to-r from-purple-500 to-indigo-600 text-white border-0 hover:from-purple-600 hover:to-indigo-700"
                        onClick={handleManageSubscription}
                      >
                        Manage Subscription
                      </Button>
                    </div>
                  ) : (
                    <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4 space-y-3">
                      <p className="text-center text-gray-600 dark:text-gray-300">No subscription information available</p>
                      <Button 
                        variant="outline" 
                        className="w-full h-12 font-medium bg-gradient-to-r from-purple-500 to-indigo-600 text-white border-0 hover:from-purple-600 hover:to-indigo-700"
                        onClick={() => setIsManageSubscriptionOpen(true)}
                      >
                        Get Subscription
                      </Button>
                    </div>
                  )}
                </div>

                {/* Change Password Section */}
                <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                  <Button 
                    variant="info" 
                    className="w-full h-12 font-medium"
                    onClick={handleChangePassword}
                  >
                    Change Password
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
