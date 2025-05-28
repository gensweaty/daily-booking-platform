
import { useEffect, useState } from "react"
import { LanguageSwitcher } from "@/components/LanguageSwitcher"
import { ThemeToggle } from "@/components/ThemeToggle"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Skeleton } from "@/components/ui/skeleton"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import { checkSubscriptionStatus, manualSyncSubscription } from "@/utils/stripeUtils"
import { useLanguage } from "@/contexts/LanguageContext"
import { LogOut, Loader2, RefreshCw, Settings, User } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { SubscriptionCountdown } from "@/components/subscription/SubscriptionCountdown"
import { LanguageText } from "@/components/shared/LanguageText"
import { simulateTestPayment } from "@/utils/testPaymentSimulation"

export const DashboardHeader = () => {
  const { toast } = useToast()
  const [user, setUser] = useState<any>(null)
  const [subscriptionStatus, setSubscriptionStatus] = useState<{
    status: 'trial' | 'trial_expired' | 'active' | 'expired' | 'canceled';
    currentPeriodEnd?: string;
    trialEnd?: string;
    planType?: 'monthly' | 'yearly';
  }>({ status: 'trial' })
  const [isRefreshing, setIsRefreshing] = useState(false)
  const { t } = useLanguage()

  useEffect(() => {
    // Get current user
    const getCurrentUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      setUser(user)
    }
    getCurrentUser()
    
    handleRefreshSubscription()
  }, [])

  const handleRefreshSubscription = async () => {
    try {
      setIsRefreshing(true)
      const data = await checkSubscriptionStatus()
      console.log('Subscription status:', data)
      
      // Ensure we set the correct type for status
      const statusUpdate = {
        status: (data.status || 'trial') as 'trial' | 'trial_expired' | 'active' | 'expired' | 'canceled',
        currentPeriodEnd: data.currentPeriodEnd,
        trialEnd: data.trialEnd,
        planType: data.planType as 'monthly' | 'yearly' | undefined
      }
      
      setSubscriptionStatus(statusUpdate)
    } catch (error: any) {
      toast({
        title: t("dashboard.errorRefreshing"),
        description: error?.message || t("dashboard.unknownError"),
        variant: "destructive",
      })
    } finally {
      setIsRefreshing(false)
    }
  }

  const handleRepairSubscription = async () => {
    try {
      setIsRefreshing(true)
      const data = await manualSyncSubscription()
      console.log('Subscription repair result:', data)
      
      // Ensure we set the correct type for status
      const statusUpdate = {
        status: (data.status || 'trial') as 'trial' | 'trial_expired' | 'active' | 'expired' | 'canceled',
        currentPeriodEnd: data.currentPeriodEnd,
        trialEnd: data.trialEnd,
        planType: data.planType as 'monthly' | 'yearly' | undefined
      }
      
      setSubscriptionStatus(statusUpdate)
      toast({
        title: t("dashboard.subscriptionRepaired"),
        description: t("dashboard.subscriptionSynced"),
      })
    } catch (error: any) {
      toast({
        title: t("dashboard.errorRepairing"),
        description: error?.message || t("dashboard.unknownError"),
        variant: "destructive",
      })
    } finally {
      setIsRefreshing(false)
    }
  }

  const handleTestPayment = async () => {
    try {
      setIsRefreshing(true);
      console.log('Starting test payment simulation...');
      
      const result = await simulateTestPayment();
      console.log('Test payment simulation completed:', result);
      
      // Refresh subscription status after test
      await handleRefreshSubscription();
      
      toast({
        title: "Test Payment Simulated",
        description: `Successfully simulated payment for ${result.data?.email}`,
      });
    } catch (error) {
      console.error('Test payment simulation failed:', error);
      toast({
        title: "Test Payment Failed",
        description: error instanceof Error ? error.message : "An unknown error occurred",
        variant: "destructive",
      });
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <header className="bg-background border-b px-6 py-4">
      <div className="flex items-center justify-between">
        <a href="/" className="flex items-center gap-2 font-bold">
          <User className="h-6 w-6" />
          <span>{process.env.NEXT_PUBLIC_APP_NAME || "App"}</span>
        </a>

        <div className="flex items-center gap-4">
          {user ? (
            <SubscriptionCountdown
              status={subscriptionStatus.status}
              currentPeriodEnd={subscriptionStatus.currentPeriodEnd}
              trialEnd={subscriptionStatus.trialEnd}
              planType={subscriptionStatus.planType}
              compact
            />
          ) : (
            <Skeleton className="w-[150px] h-5 rounded-md" />
          )}

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefreshSubscription}
              disabled={isRefreshing}
              className="flex items-center gap-2"
            >
              {isRefreshing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              Refresh
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={handleRepairSubscription}
              disabled={isRefreshing}
              className="flex items-center gap-2"
            >
              {isRefreshing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Settings className="h-4 w-4" />
              )}
              Repair
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={handleTestPayment}
              disabled={isRefreshing}
              className="flex items-center gap-2 bg-purple-50 border-purple-200 text-purple-700 hover:bg-purple-100"
            >
              {isRefreshing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <span className="text-xs">🧪</span>
              )}
              Test Payment
            </Button>

            <LanguageSwitcher />
            <ThemeToggle />
            <Button
              onClick={() => supabase.auth.signOut()}
              variant="outline"
              size="sm"
            >
              <LogOut className="w-4 h-4 mr-2" />
              <LanguageText>{t("auth.signOut")}</LanguageText>
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
};
