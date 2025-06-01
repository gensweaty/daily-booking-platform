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
import { AvatarUpload } from "./profile/AvatarUpload";

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
  const [isSyncing, setIsSyncing] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string>('');

  // Fetch subscription data function
  const fetchSubscription = async () => {
    if (!user) return;
    
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
  };

  // Check for payment return in URL
  const checkForPaymentReturn = () => {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.has('session_id') || urlParams.has('subscription');
  };

  useEffect(() => {
    // Only fetch on initial load or when returning from payment
    if (user) {
      const isPaymentReturn = checkForPaymentReturn();
      if (isPaymentReturn) {
        console.log('Detected payment return, fetching subscription data');
      }
      fetchSubscription();
    }
  }, [user]);

  // Fetch user avatar
  useEffect(() => {
    const fetchAvatar = async () => {
      if (!user) return;
      
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('avatar_url')
          .eq('id', user.id)
          .maybeSingle();
        
        if (error) {
          console.error('Error fetching avatar:', error);
          return;
        }
        
        if (data?.avatar_url) {
          setAvatarUrl(data.avatar_url);
        }
      } catch (error) {
        console.error('Avatar fetch error:', error);
      }
    };

    fetchAvatar();
  }, [user]);

  // Fetch when dialog opens
  const handleDialogOpenChange = (open: boolean) => {
    setDialogOpen(open);
    if (open && user && !isLoading) {
      console.log('Profile dialog opened, refreshing subscription data');
      fetchSubscription();
    }
  };

  const handleManualSync = async () => {
    if (!user || isSyncing) return;
    
    setIsSyncing(true);
    try {
      console.log('Starting manual sync for user:', user.email);
      const result = await manualSyncSubscription();
      console.log('Manual sync result:', result);
      
      if (result && result.success && result.status === 'active') {
        setSubscription({
          plan_type: result.planType || 'monthly',
          status: result.status,
          current_period_end: result.currentPeriodEnd || null,
          trial_end_date: result.trialEnd || null,
          stripe_customer_id: null,
          stripe_subscription_id: result.stripe_subscription_id || null
        });
        
        toast({
          title: t('profile.syncSuccessful'),
          description: t('profile.subscriptionUpdatedFromStripe'),
        });
      } else if (result && result.status === 'trial_expired') {
        toast({
          title: t('profile.syncComplete'),
          description: t('profile.noActiveSubscription'),
        });
      } else {
        const errorMsg = result?.error || "Sync completed but no active subscription found";
        toast({
          title: t('profile.syncComplete'),
          description: result.status === 'trial_expired' ? t('profile.noActiveSubscription') : t('profile.subscriptionStatusVerified'),
        });
      }
    } catch (error) {
      console.error('Error syncing subscription:', error);
      toast({
        title: t('profile.syncError'),
        description: t('profile.failedSyncWithStripe'),
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
        title: t('profile.signOutError'),
        description: t('profile.pleaseTryAgain'),
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
        title: t('profile.passwordResetEmailSent'),
        description: t('profile.checkEmailForResetLink'),
      });
    } catch (error: any) {
      console.error('Password reset error:', error);
      toast({
        title: t('common.error'),
        description: t('profile.failedSendPasswordReset'),
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
    return planType === 'monthly' ? t('subscription.monthlyPlan') : t('subscription.annualPlan');
  };

  const handleAvatarUpdate = (url: string) => {
    setAvatarUrl(url);
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
          <Dialog open={dialogOpen} onOpenChange={handleDialogOpenChange}>
            <DialogTrigger asChild>
              <Button 
                variant="purple" 
                size="icon"
                className="text-foreground"
              >
                <User className="w-4 h-4" />
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[600px] p-0 max-h-[90vh] overflow-y-auto">
              <div className="bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600 p-8 text-white relative overflow-hidden">
                <div className="absolute inset-0 bg-black/10"></div>
                <div className="relative z-10">
                  <DialogHeader>
                    <DialogTitle className="text-3xl font-bold mb-2 text-center">
                      <LanguageText>{t('profile.userProfile')}</LanguageText>
                    </DialogTitle>
                  </DialogHeader>
                  <div className="text-center">
                    <AvatarUpload 
                      avatarUrl={avatarUrl}
                      onAvatarUpdate={handleAvatarUpdate}
                    />
                    <p className="text-white/90 text-lg mt-2">
                      {isGeorgian ? (
                        <GeorgianAuthText>{t('profile.welcomeBack')}</GeorgianAuthText>
                      ) : (
                        <LanguageText>{t('profile.welcomeBack')}</LanguageText>
                      )}
                    </p>
                  </div>
                </div>
              </div>

              <div className="p-8 space-y-8">
                {/* User Information Section */}
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-xl p-6 border border-blue-200/50 dark:border-blue-800/50">
                  <h3 className="text-xl font-semibold mb-4 text-gray-800 dark:text-gray-200 flex items-center gap-2">
                    <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                    <LanguageText>{t('profile.accountInformation')}</LanguageText>
                  </h3>
                  <div className="grid grid-cols-1 gap-4">
                    <div className="bg-white/70 dark:bg-gray-800/70 rounded-lg p-4 backdrop-blur-sm">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900/50 rounded-full flex items-center justify-center">
                          <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                        </div>
                        <p className="text-sm font-medium text-gray-600 dark:text-gray-300">
                          <LanguageText>{t('profile.emailAddress')}</LanguageText>
                        </p>
                      </div>
                      <p className="text-lg font-semibold text-gray-800 dark:text-gray-200 pl-11">{user?.email}</p>
                    </div>
                    <div className="bg-white/70 dark:bg-gray-800/70 rounded-lg p-4 backdrop-blur-sm">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="w-8 h-8 bg-green-100 dark:bg-green-900/50 rounded-full flex items-center justify-center">
                          <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                        </div>
                        <p className="text-sm font-medium text-gray-600 dark:text-gray-300">
                          <LanguageText>{t('profile.username')}</LanguageText>
                        </p>
                      </div>
                      <p className="text-lg font-semibold text-gray-800 dark:text-gray-200 pl-11">{username}</p>
                    </div>
                  </div>
                </div>

                {/* Subscription Section */}
                <div className="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 rounded-xl p-6 border border-purple-200/50 dark:border-purple-800/50">
                  <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-semibold text-gray-800 dark:text-gray-200 flex items-center gap-2">
                      <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                      <LanguageText>{t('profile.subscriptionStatus')}</LanguageText>
                    </h3>
                    {!isLoading && (
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="h-9 px-4 text-sm border-purple-200 hover:bg-purple-50 dark:border-purple-800 dark:hover:bg-purple-900/50"
                        onClick={handleManualSync}
                        disabled={isSyncing}
                      >
                        {isSyncing ? (
                          <span className="flex items-center gap-2">
                            <RefreshCw className="h-4 w-4 animate-spin" />
                            <LanguageText>{t('profile.syncing')}</LanguageText>
                          </span>
                        ) : (
                          <span className="flex items-center gap-2">
                            <RefreshCw className="h-4 w-4" />
                            <LanguageText>{t('profile.sync')}</LanguageText>
                          </span>
                        )}
                      </Button>
                    )}
                  </div>
                  
                  {isLoading ? (
                    <div className="bg-white/70 dark:bg-gray-800/70 rounded-lg p-6 backdrop-blur-sm">
                      <div className="animate-pulse flex space-x-4">
                        <div className="rounded-full bg-purple-200 dark:bg-purple-700 h-12 w-12"></div>
                        <div className="flex-1 space-y-3 py-1">
                          <div className="h-4 bg-purple-200 dark:bg-purple-700 rounded w-3/4"></div>
                          <div className="h-4 bg-purple-200 dark:bg-purple-700 rounded w-1/2"></div>
                        </div>
                      </div>
                    </div>
                  ) : subscription ? (
                    <div className="space-y-6">
                      <div className="bg-white/80 dark:bg-gray-800/80 rounded-lg p-6 backdrop-blur-sm border border-white/50 dark:border-gray-700/50">
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center gap-3">
                            <div className={`w-4 h-4 rounded-full flex-shrink-0 ${
                              subscription.status === 'active' ? 'bg-green-500' :
                              subscription.status === 'trial' ? 'bg-blue-500' :
                              'bg-red-500'
                            }`}></div>
                            <span className="text-xl font-bold text-gray-800 dark:text-gray-200">
                              <LanguageText>
                                {subscription.status === 'trial' ? t('profile.trialPlan') : 
                                 subscription.status === 'active' ? formatPlanType(subscription.plan_type) :
                                 subscription.status === 'trial_expired' ? t('profile.trialExpired') : 
                                 t('profile.noActiveSubscription')}
                              </LanguageText>
                            </span>
                          </div>
                          <span className={`px-4 py-2 rounded-full text-sm font-semibold uppercase tracking-wide ${
                            subscription.status === 'active' ? 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-400' :
                            subscription.status === 'trial' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-400' :
                            'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-400'
                          }`}>
                            <LanguageText>{t(`profile.${subscription.status.replace('_', '')}`)}</LanguageText>
                          </span>
                        </div>
                        
                        {/* Countdown Component */}
                        {(subscription.status === 'trial' || subscription.status === 'active') && (
                          <div className="bg-gradient-to-r from-indigo-50 to-blue-50 dark:from-indigo-900/30 dark:to-blue-900/30 rounded-lg p-4 border border-indigo-200/50 dark:border-indigo-800/50">
                            <SubscriptionCountdown
                              status={subscription.status as 'trial' | 'active'}
                              currentPeriodEnd={subscription.current_period_end}
                              trialEnd={subscription.trial_end_date}
                              planType={subscription.plan_type as 'monthly' | 'yearly'}
                            />
                          </div>
                        )}
                      </div>
                      
                      <Button 
                        className="w-full h-14 text-lg font-semibold bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 text-white border-0 hover:from-purple-700 hover:via-indigo-700 hover:to-blue-700 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-[1.02]"
                        onClick={handleManageSubscription}
                      >
                        <span className="flex items-center gap-2">
                          <LanguageText>{t('subscription.manageSubscription')}</LanguageText>
                        </span>
                      </Button>
                    </div>
                  ) : (
                    <div className="bg-white/70 dark:bg-gray-800/70 rounded-lg p-6 backdrop-blur-sm text-center space-y-4">
                      <div className="w-16 h-16 bg-gray-200 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto">
                        <User className="w-8 h-8 text-gray-500 dark:text-gray-400" />
                      </div>
                      <p className="text-lg text-gray-600 dark:text-gray-300">
                        <LanguageText>{t('profile.noSubscriptionInfo')}</LanguageText>
                      </p>
                      <Button 
                        className="w-full h-14 text-lg font-semibold bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 text-white border-0 hover:from-purple-700 hover:via-indigo-700 hover:to-blue-700 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-[1.02]"
                        onClick={() => setIsManageSubscriptionOpen(true)}
                      >
                        <LanguageText>{t('profile.getSubscription')}</LanguageText>
                      </Button>
                    </div>
                  )}
                </div>

                {/* Change Password Section */}
                <div className="bg-gradient-to-r from-orange-50 to-red-50 dark:from-orange-900/20 dark:to-red-900/20 rounded-xl p-6 border border-orange-200/50 dark:border-orange-800/50">
                  <h3 className="text-xl font-semibold mb-4 text-gray-800 dark:text-gray-200 flex items-center gap-2">
                    <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                    <LanguageText>{t('profile.securitySettings')}</LanguageText>
                  </h3>
                  <Button 
                    variant="outline"
                    className="w-full h-12 text-lg font-medium border-orange-200 hover:bg-orange-50 dark:border-orange-800 dark:hover:bg-orange-900/50"
                    onClick={handleChangePassword}
                  >
                    <LanguageText>{t('profile.changePassword')}</LanguageText>
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
