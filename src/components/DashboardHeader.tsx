
import { Button } from "@/components/ui/button";
import { LogOut, User } from "lucide-react";
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
import { checkSubscriptionStatus } from "@/utils/stripeUtils";
import { differenceInDays } from "date-fns";

interface DashboardHeaderProps {
  username: string;
}

interface Subscription {
  plan_type: string;
  status: string;
  current_period_end: string | null;
  trial_end_date: string | null;
}

export const DashboardHeader = ({ username }: DashboardHeaderProps) => {
  const { user, signOut } = useAuth();
  const { toast } = useToast();
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const { theme } = useTheme();
  const { t, language } = useLanguage();
  const isGeorgian = language === 'ka';

  useEffect(() => {
    const fetchSubscription = async () => {
      if (user) {
        try {
          // First check the subscription status from Stripe
          const stripeStatus = await checkSubscriptionStatus();
          console.log('Stripe subscription status:', stripeStatus);
          
          // Then get the detailed subscription data from the database
          const { data, error } = await supabase
            .from('subscriptions')
            .select('plan_type, status, current_period_end, trial_end_date')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          if (error) {
            console.error('Error fetching subscription:', error);
            return;
          }

          console.log('Fetched subscription:', data);
          setSubscription(data);
        } catch (error) {
          console.error('Subscription fetch error:', error);
        }
      }
    };

    fetchSubscription();
  }, [user]);

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
                  <p className="text-sm font-medium">Subscription</p>
                  {subscription ? (
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">
                        {subscription.status === 'trial' ? 'Trial Plan' : formatPlanType(subscription.plan_type)}
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
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">Loading subscription details...</p>
                  )}
                </div>
                <div className="pt-4">
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
    </header>
  );
};
