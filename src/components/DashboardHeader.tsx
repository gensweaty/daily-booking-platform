import { Button } from "@/components/ui/button";
import { LogOut, RefreshCw } from "lucide-react";
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
import { AvatarUpload } from "./AvatarUpload";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { ProfileButton } from "./dashboard/ProfileButton";
import { PublicBoardSettings } from "./tasks/PublicBoardSettings";

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
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [userProfileName, setUserProfileName] = useState<string | null>(null);
  const [teamManagementOpen, setTeamManagementOpen] = useState(false);
  const isMobile = useMediaQuery("(max-width: 768px)");

  const fetchUserProfile = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('avatar_url, username')
        .eq('id', user.id)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        console.error('Error fetching profile:', error);
        return;
      }

      if (data?.avatar_url) {
        setAvatarUrl(data.avatar_url);
      }
      if (data?.username) {
        setUserProfileName(data.username);
      }
    } catch (error) {
      console.error('Error fetching user profile:', error);
    }
  };

  const fetchSubscription = async (clearCache = false) => {
    if (!user) return;
    
    try {
      setIsLoading(true);
      
      // Clear cache if requested (e.g., after real-time update)
      if (clearCache) {
        console.log('Clearing subscription cache before fetch...');
        const subscriptionCacheModule = await import('@/utils/subscriptionCache');
        subscriptionCacheModule.subscriptionCache.clearCache();
      }
      
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

  const checkForPaymentReturn = () => {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.has('session_id') || urlParams.has('subscription');
  };

  useEffect(() => {
    if (user) {
      const isPaymentReturn = checkForPaymentReturn();
      if (isPaymentReturn) {
        console.log('Detected payment return, fetching subscription data');
      }
      fetchSubscription();
      fetchUserProfile();

      // CRITICAL FIX: Listen for subscription updates in real-time
      console.log('Setting up real-time subscription listener for user:', user.id);
      
      const channel = supabase
        .channel(`subscription-changes-${user.id}`)
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'subscriptions',
            filter: `user_id=eq.${user.id}`
          },
          (payload) => {
            console.log('🔄 Subscription updated in real-time:', payload);
            
            // Only show toast if there's a meaningful change (status or plan_type change)
            const oldRecord = payload.old as any;
            const newRecord = payload.new as any;
            
            const hasStatusChange = oldRecord?.status !== newRecord?.status;
            const hasPlanChange = oldRecord?.plan_type !== newRecord?.plan_type;
            const hasEndDateChange = oldRecord?.subscription_end_date !== newRecord?.subscription_end_date;
            
            if (hasStatusChange || hasPlanChange || hasEndDateChange) {
              toast({
                title: "Subscription Updated",
                description: "Your subscription has been updated. Refreshing...",
              });
            }
            
            // Clear cache and refetch with fresh data
            fetchSubscription(true);
          }
        )
        .subscribe();

      return () => {
        console.log('Cleaning up subscription listener');
        supabase.removeChannel(channel);
      };
    }
  }, [user]);

  const handleDialogOpenChange = (open: boolean) => {
    setDialogOpen(open);
    if (open && user && !isLoading) {
      console.log('Profile dialog opened, refreshing subscription data');
      fetchSubscription();
      fetchUserProfile();
    }
  };

  const handleAvatarUpdate = (newAvatarUrl: string) => {
    setAvatarUrl(newAvatarUrl);
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
    if (!user?.email) {
      toast({
        title: t('common.error'),
        description: t('profile.noEmailFound'),
        variant: "destructive",
      });
      return;
    }

    try {
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/password-reset`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`
        },
        body: JSON.stringify({ email: user.email })
      });

      const result = await response.json();
      console.log("Password reset response:", result);

      if (!response.ok) {
        console.error("Password reset request failed:", result.error);
        
        if (result.error?.includes('rate limit') || result.error?.includes('too many requests')) {
          toast({
            title: "Too many attempts",
            description: "Please wait a moment before trying again",
            variant: "destructive"
          });
        } else {
          handlePasswordResetSuccess();
        }
      } else {
        console.log("Reset password email sent successfully");
        handlePasswordResetSuccess();
      }
    } catch (error: any) {
      console.error("Password reset request error:", error);
      handlePasswordResetSuccess();
    }
  };

  const handlePasswordResetSuccess = () => {
    toast({
      title: t('profile.passwordResetEmailSent'),
      description: t('profile.checkEmailForResetLink'),
    });
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
              <div>
                <ProfileButton 
                  onClick={() => {}} 
                  mobileVersion={isMobile}
                  avatarUrl={avatarUrl}
                  className="md:flex hidden"
                />
                <ProfileButton 
                  onClick={() => {}} 
                  mobileVersion={true}
                  avatarUrl={avatarUrl}
                  className="md:hidden flex"
                />
              </div>
            </DialogTrigger>
            <DialogContent 
              className={
                isMobile 
                  ? 'mobile-dialog w-screen h-screen max-w-none max-h-none p-0 border-0 rounded-none' 
                  : 'sm:max-w-[600px] max-h-[90vh] p-0'
              }
              style={isMobile ? {
                position: 'fixed',
                top: '0',
                left: '0',
                right: '0',
                bottom: '0',
                transform: 'none',
                margin: '0',
                borderRadius: '0'
              } : {}}
            >
              <style>{`
                .mobile-dialog[data-state="open"] {
                  position: fixed !important;
                  top: 0 !important;
                  left: 0 !important;
                  right: 0 !important;
                  bottom: 0 !important;
                  width: 100vw !important;
                  height: 100vh !important;
                  max-width: none !important;
                  max-height: none !important;
                  transform: none !important;
                  margin: 0 !important;
                  border-radius: 0 !important;
                  border: none !important;
                }
              `}</style>
              
              <div className="bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600 p-6 md:p-8 text-white relative overflow-hidden">
                <div className="absolute inset-0 bg-black/10"></div>
                <div className="relative z-10">
                  <DialogHeader>
                    <DialogTitle className={`${isMobile ? 'text-xl' : 'text-3xl'} font-bold mb-2 text-center`}>
                      <LanguageText>{t('profile.userProfile')}</LanguageText>
                    </DialogTitle>
                  </DialogHeader>
                  <div className="text-center">
                    <div className="mx-auto mb-4">
                      <AvatarUpload 
                        avatarUrl={avatarUrl}
                        onAvatarUpdate={handleAvatarUpdate}
                        size={isMobile ? "md" : "lg"}
                      />
                    </div>
                    <p className={`text-white/90 ${isMobile ? 'text-base' : 'text-lg'}`}>
                      <LanguageText>{t('profile.welcomeBack')}</LanguageText>
                    </p>
                  </div>
                </div>
              </div>

              <div className={`${isMobile ? 'p-4 space-y-6 overflow-y-auto flex-1' : 'p-8 space-y-8'}`}>
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-xl p-4 md:p-6 border border-blue-200/50 dark:border-blue-800/50">
                  <h3 className={`${isMobile ? 'text-lg' : 'text-xl'} font-semibold mb-4 text-gray-800 dark:text-gray-200 flex items-center gap-2`}>
                    <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                    <LanguageText>{t('profile.accountInformation')}</LanguageText>
                  </h3>
                  <div className="grid grid-cols-1 gap-4">
                    <div className="bg-white/70 dark:bg-gray-800/70 rounded-lg p-3 md:p-4 backdrop-blur-sm">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="w-6 h-6 md:w-8 md:h-8 bg-blue-100 dark:bg-blue-900/50 rounded-full flex items-center justify-center flex-shrink-0">
                          <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                        </div>
                        <p className={`${isMobile ? 'text-xs' : 'text-sm'} font-medium text-gray-600 dark:text-gray-300`}>
                          <LanguageText>{t('profile.emailAddress')}</LanguageText>
                        </p>
                      </div>
                      <p className={`${isMobile ? 'text-sm pl-9' : 'text-lg font-semibold pl-11'} text-gray-800 dark:text-gray-200 break-all`}>{user?.email}</p>
                    </div>
                    <div className="bg-white/70 dark:bg-gray-800/70 rounded-lg p-3 md:p-4 backdrop-blur-sm">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="w-6 h-6 md:w-8 md:h-8 bg-green-100 dark:bg-green-900/50 rounded-full flex items-center justify-center flex-shrink-0">
                          <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                        </div>
                        <p className={`${isMobile ? 'text-xs' : 'text-sm'} font-medium text-gray-600 dark:text-gray-300`}>
                          <LanguageText>{t('profile.username')}</LanguageText>
                        </p>
                      </div>
                      <p className={`${isMobile ? 'text-sm pl-9' : 'text-lg font-semibold pl-11'} text-gray-800 dark:text-gray-200 break-all`}>{username}</p>
                    </div>
                  </div>
                </div>

                {/* Dashboard and Team Management Button */}
                <div className="bg-gradient-to-r from-orange-50 to-yellow-50 dark:from-orange-900/20 dark:to-yellow-900/20 rounded-xl p-4 md:p-6 border border-orange-200/50 dark:border-orange-800/50">
                  <Button
                    onClick={() => setTeamManagementOpen(true)}
                    className="w-full bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 text-white font-semibold py-3 md:py-4 text-sm md:text-base"
                  >
                    <LanguageText>{t('publicBoard.dashboardAndTeamManagement')}</LanguageText>
                  </Button>
                </div>

                <div className="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 rounded-xl p-4 md:p-6 border border-purple-200/50 dark:border-purple-800/50">
                  <div className="flex justify-between items-center mb-4 md:mb-6">
                    <h3 className={`${isMobile ? 'text-lg' : 'text-xl'} font-semibold text-gray-800 dark:text-gray-200 flex items-center gap-2`}>
                      <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                      <LanguageText>{t('profile.subscriptionStatus')}</LanguageText>
                    </h3>
                    {!isLoading && (
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className={`${isMobile ? 'h-8 px-3 text-xs' : 'h-9 px-4 text-sm'} border-purple-200 hover:bg-purple-50 dark:border-purple-800 dark:hover:bg-purple-900/50`}
                        onClick={handleManualSync}
                        disabled={isSyncing}
                      >
                        {isSyncing ? (
                          <span className="flex items-center gap-1 md:gap-2">
                            <RefreshCw className={`${isMobile ? 'h-3 w-3' : 'h-4 w-4'} animate-spin`} />
                            <LanguageText>{t('profile.syncing')}</LanguageText>
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 md:gap-2">
                            <RefreshCw className={`${isMobile ? 'h-3 w-3' : 'h-4 w-4'}`} />
                            <LanguageText>{t('profile.sync')}</LanguageText>
                          </span>
                        )}
                      </Button>
                    )}
                  </div>
                  
                  {isLoading ? (
                    <div className="bg-white/70 dark:bg-gray-800/70 rounded-lg p-4 md:p-6 backdrop-blur-sm">
                      <div className="animate-pulse flex space-x-4">
                        <div className={`rounded-full bg-purple-200 dark:bg-purple-700 ${isMobile ? 'h-10 w-10' : 'h-12 w-12'}`}></div>
                        <div className="flex-1 space-y-3 py-1">
                          <div className="h-4 bg-purple-200 dark:bg-purple-700 rounded w-3/4"></div>
                          <div className="h-4 bg-purple-200 dark:bg-purple-700 rounded w-1/2"></div>
                        </div>
                      </div>
                    </div>
                  ) : subscription ? (
                    <div className="space-y-4 md:space-y-6">
                      <div className="bg-white/80 dark:bg-gray-800/80 rounded-lg p-4 md:p-6 backdrop-blur-sm border border-white/50 dark:border-gray-700/50">
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center gap-3">
                            <div className={`w-3 h-3 md:w-4 md:h-4 rounded-full flex-shrink-0 ${
                              subscription.status === 'active' ? 'bg-green-500' :
                              subscription.status === 'trial' ? 'bg-blue-500' :
                              'bg-red-500'
                            }`}></div>
                            <span className={`${isMobile ? 'text-lg' : 'text-xl'} font-bold text-gray-800 dark:text-gray-200`}>
                              <LanguageText>
                                {subscription.status === 'trial' ? t('profile.trialPlan') : 
                                 subscription.status === 'active' ? formatPlanType(subscription.plan_type) :
                                 subscription.status === 'trial_expired' ? t('profile.trialExpired') : 
                                 t('profile.noActiveSubscription')}
                              </LanguageText>
                            </span>
                          </div>
                          <span className={`px-2 md:px-4 py-1 md:py-2 rounded-full ${isMobile ? 'text-xs' : 'text-sm'} font-semibold uppercase tracking-wide ${
                            subscription.status === 'active' ? 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-400' :
                            subscription.status === 'trial' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-400' :
                            'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-400'
                          }`}>
                            <LanguageText>{t(`profile.${subscription.status.replace('_', '')}`)}</LanguageText>
                          </span>
                        </div>
                        
                        {(subscription.status === 'trial' || subscription.status === 'active') && (
                          <div className="bg-gradient-to-r from-indigo-50 to-blue-50 dark:from-indigo-900/30 dark:to-blue-900/30 rounded-lg p-3 md:p-4 border border-indigo-200/50 dark:border-indigo-800/50">
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
                        className={`w-full ${isMobile ? 'h-12 text-base' : 'h-14 text-lg'} font-semibold bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 text-white border-0 hover:from-purple-700 hover:via-indigo-700 hover:to-blue-700 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-[1.02]`}
                        onClick={handleManageSubscription}
                      >
                        <span className="flex items-center gap-2">
                          <LanguageText>{t('subscription.manageSubscription')}</LanguageText>
                        </span>
                      </Button>
                    </div>
                  ) : (
                    <div className="bg-white/70 dark:bg-gray-800/70 rounded-lg p-4 md:p-6 backdrop-blur-sm text-center space-y-4">
                      <div className={`${isMobile ? 'w-12 h-12' : 'w-16 h-16'} bg-gray-200 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto`}>
                        <ProfileButton onClick={() => {}} className="w-full h-full" />
                      </div>
                      <p className={`${isMobile ? 'text-base' : 'text-lg'} text-gray-600 dark:text-gray-300`}>
                        <LanguageText>{t('profile.noSubscriptionInfo')}</LanguageText>
                      </p>
                      <Button 
                        className={`w-full ${isMobile ? 'h-12 text-base' : 'h-14 text-lg'} font-semibold bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 text-white border-0 hover:from-purple-700 hover:via-indigo-700 hover:to-blue-700 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-[1.02]`}
                        onClick={() => setIsManageSubscriptionOpen(true)}
                      >
                        <LanguageText>{t('profile.getSubscription')}</LanguageText>
                      </Button>
                    </div>
                  )}
                </div>

                <div className="bg-gradient-to-r from-orange-50 to-red-50 dark:from-orange-900/20 dark:to-red-900/20 rounded-xl p-4 md:p-6 border border-orange-200/50 dark:border-orange-800/50">
                  <h3 className={`${isMobile ? 'text-lg' : 'text-xl'} font-semibold mb-4 text-gray-800 dark:text-gray-200 flex items-center gap-2`}>
                    <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                    <LanguageText>{t('profile.securitySettings')}</LanguageText>
                  </h3>
                  <Button 
                    variant="outline"
                    className={`w-full ${isMobile ? 'h-10 text-base' : 'h-12 text-lg'} font-medium border-orange-200 hover:bg-orange-50 dark:border-orange-800 dark:hover:bg-orange-900/50`}
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
            className="hidden md:flex items-center gap-2 text-white"
            onClick={handleSignOut}
          >
            <LogOut className="w-4 h-4" />
            {isGeorgian ? (
              <GeorgianAuthText fontWeight="bold">გამოსვლა</GeorgianAuthText>
            ) : (
              t('dashboard.signOut')
            )}
          </Button>
          <Button 
            variant="orange" 
            size="icon"
            className="md:hidden flex h-10 w-10 rounded-full text-white"
            onClick={handleSignOut}
          >
            <LogOut className="w-4 h-4" />
          </Button>
        </div>
      </div>
      
      <div className="text-center mb-2 relative">
        <div className="relative rounded-xl bg-gradient-to-r from-background/90 to-background/70 backdrop-blur-sm border border-border/30 p-4 shadow-sm">
          <div className="space-y-1">
            <h1 className="text-lg sm:text-xl md:text-2xl font-bold text-foreground">
              {isGeorgian ? (
                <GeorgianAuthText fontWeight="bold">მოგესალმებით</GeorgianAuthText>
              ) : (
                <LanguageText>{t('dashboard.welcome')}</LanguageText>
              )}
            </h1>
            <p className="text-xs sm:text-sm md:text-base font-medium text-muted-foreground">
              {isGeorgian ? (
                <GeorgianAuthText fontWeight="medium">თქვენი პროდუქტიულობის ცენტრი</GeorgianAuthText>
              ) : (
                <LanguageText>{t('dashboard.subtitle')}</LanguageText>
              )}
            </p>
          </div>
        </div>
      </div>

      <ManageSubscriptionDialog 
        open={isManageSubscriptionOpen} 
        onOpenChange={setIsManageSubscriptionOpen} 
      />
      
      <PublicBoardSettings
        isOpen={teamManagementOpen}
        onOpenChange={setTeamManagementOpen}
        hideTrigger={true}
      />
    </header>
  );
};
