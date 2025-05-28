
import { useState, useEffect } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { checkSubscriptionStatus, manualSyncSubscription } from '@/utils/stripeUtils';

interface SubscriptionCountdownProps {
  status: 'trial' | 'trial_expired' | 'active' | 'expired' | 'canceled';
  currentPeriodEnd?: string;
  trialEnd?: string;
  planType?: 'monthly' | 'yearly';
  compact?: boolean;
}

export const SubscriptionCountdown = ({ 
  status, 
  currentPeriodEnd, 
  trialEnd, 
  planType,
  compact = false
}: SubscriptionCountdownProps) => {
  const { t } = useLanguage();
  const [timeLeft, setTimeLeft] = useState<{
    days: number;
    hours: number;
    minutes: number;
    seconds: number;
  }>({ days: 0, hours: 0, minutes: 0, seconds: 0 });
  const [actualPeriodEnd, setActualPeriodEnd] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Fetch fresh subscription data to get accurate period end
  useEffect(() => {
    const fetchLatestSubscription = async () => {
      try {
        const data = await checkSubscriptionStatus();
        console.log('Fresh subscription data for countdown:', data);
        
        if (data.currentPeriodEnd) {
          setActualPeriodEnd(data.currentPeriodEnd);
        } else if (data.trialEnd && status === 'trial') {
          setActualPeriodEnd(data.trialEnd);
        }
      } catch (error) {
        console.error('Error fetching subscription for countdown:', error);
        // Fallback to props
        setActualPeriodEnd(currentPeriodEnd || trialEnd || null);
      }
    };

    fetchLatestSubscription();
  }, [status, currentPeriodEnd, trialEnd]);

  useEffect(() => {
    const calculateTimeLeft = () => {
      let targetDate: Date | null = null;
      
      // Use the latest fetched data first, then fallback to props
      if (status === 'active' && actualPeriodEnd) {
        targetDate = new Date(actualPeriodEnd);
      } else if (status === 'trial' && (actualPeriodEnd || trialEnd)) {
        targetDate = new Date(actualPeriodEnd || trialEnd!);
      }
      
      if (!targetDate) {
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0 });
        return;
      }
      
      const now = new Date().getTime();
      const target = targetDate.getTime();
      const difference = target - now;
      
      console.log('Countdown calculation:', {
        now: new Date(now).toISOString(),
        target: targetDate.toISOString(),
        difference,
        differenceInDays: difference / (1000 * 60 * 60 * 24)
      });
      
      if (difference > 0) {
        const days = Math.floor(difference / (1000 * 60 * 60 * 24));
        const hours = Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((difference % (1000 * 60)) / 1000);
        
        setTimeLeft({ days, hours, minutes, seconds });
      } else {
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0 });
        
        // If countdown reaches 0 for an active subscription, trigger a sync
        if (status === 'active' && !isRefreshing) {
          handleExpiredActiveSubscription();
        }
      }
    };

    // Calculate immediately
    calculateTimeLeft();
    
    // Update every second
    const timer = setInterval(calculateTimeLeft, 1000);
    
    return () => clearInterval(timer);
  }, [status, actualPeriodEnd, trialEnd, isRefreshing]);

  const handleExpiredActiveSubscription = async () => {
    console.log('Active subscription appears expired, syncing with Stripe...');
    setIsRefreshing(true);
    
    try {
      const result = await manualSyncSubscription();
      console.log('Sync result for expired active subscription:', result);
      
      if (result && result.currentPeriodEnd) {
        setActualPeriodEnd(result.currentPeriodEnd);
        // Trigger a subscription updated event
        window.dispatchEvent(new CustomEvent('subscriptionUpdated', { detail: result }));
      }
    } catch (error) {
      console.error('Error syncing expired active subscription:', error);
    } finally {
      setIsRefreshing(false);
    }
  };

  const getStatusMessage = () => {
    if (status === 'trial') {
      return t('subscription.trialPeriod') || 'Trial Period';
    } else if (status === 'active') {
      if (planType === 'monthly') {
        return t('subscription.monthlySubscription') || 'Monthly Subscription';
      } else if (planType === 'yearly') {
        return t('subscription.yearlySubscription') || 'Yearly Subscription';
      }
      return t('subscription.activeSubscription') || 'Active Subscription';
    } else if (status === 'trial_expired') {
      return t('subscription.trialExpired') || 'Trial Expired';
    } else if (status === 'expired') {
      return t('subscription.subscriptionExpired') || 'Subscription Expired';
    }
    return '';
  };

  const getStatusColor = () => {
    if (status === 'trial') {
      return timeLeft.days <= 3 ? 'text-orange-600' : 'text-blue-600';
    } else if (status === 'active') {
      // If refreshing, show neutral color
      if (isRefreshing) return 'text-gray-600';
      return timeLeft.days <= 7 ? 'text-orange-600' : 'text-green-600';
    } else if (status === 'trial_expired' || status === 'expired') {
      return 'text-red-600';
    }
    return 'text-gray-600';
  };

  const getBorderColor = () => {
    if (status === 'trial') {
      return timeLeft.days <= 3 ? 'border-orange-200 bg-orange-50' : 'border-blue-200 bg-blue-50';
    } else if (status === 'active') {
      if (isRefreshing) return 'border-gray-200 bg-gray-50';
      return timeLeft.days <= 7 ? 'border-orange-200 bg-orange-50' : 'border-green-200 bg-green-50';
    } else if (status === 'trial_expired' || status === 'expired') {
      return 'border-red-200 bg-red-50';
    }
    return 'border-gray-200 bg-gray-50';
  };

  // Handle expired states
  if (status === 'trial_expired' || status === 'expired') {
    return (
      <div className={`text-center p-4 rounded-lg border-2 ${getBorderColor()}`}>
        <p className={`font-semibold ${getStatusColor()}`}>{getStatusMessage()}</p>
        <p className="text-sm mt-1">{t('subscription.pleaseUpgrade') || 'Please upgrade to continue using premium features'}</p>
      </div>
    );
  }

  // Show refreshing state for active subscriptions being synced
  if (isRefreshing) {
    return (
      <div className="text-center p-4 rounded-lg border-2 border-gray-200 bg-gray-50">
        <p className="text-gray-600 font-semibold">Syncing subscription...</p>
        <p className="text-sm text-gray-600 mt-1">Checking latest billing information</p>
      </div>
    );
  }

  // Handle case when no valid dates are available
  if (timeLeft.days === 0 && timeLeft.hours === 0 && timeLeft.minutes === 0 && timeLeft.seconds === 0) {
    // If we have an active status but no time left and we're not refreshing, 
    // it might mean the subscription period just ended but Stripe hasn't updated yet
    if (status === 'active') {
      return (
        <div className="text-center p-4 rounded-lg border-2 border-orange-200 bg-orange-50">
          <p className="text-orange-600 font-semibold">Subscription Period Ended</p>
          <p className="text-sm text-orange-600 mt-1">Checking for renewal...</p>
        </div>
      );
    }
    
    if (status === 'trial') {
      return (
        <div className="text-center p-4 rounded-lg border-2 border-red-200 bg-red-50">
          <p className="text-red-600 font-semibold">Trial Expired</p>
          <p className="text-sm text-red-600 mt-1">Please upgrade to continue</p>
        </div>
      );
    }

    return (
      <div className="text-center p-4 rounded-lg border-2 border-gray-200 bg-gray-50">
        <p className="text-gray-600">{t('subscription.noActiveSubscription') || 'No active subscription'}</p>
      </div>
    );
  }

  if (compact) {
    return (
      <div className="text-center">
        <div className={`text-sm font-medium ${getStatusColor()}`}>
          {timeLeft.days > 0 ? (
            <span>{timeLeft.days} day{timeLeft.days !== 1 ? 's' : ''} left</span>
          ) : (
            <span>{timeLeft.hours}h {timeLeft.minutes}m left</span>
          )}
        </div>
        <p className="text-xs text-gray-500 mt-1">
          {status === 'trial' 
            ? (t('subscription.timeLeftInTrial') || 'Time left in trial') 
            : (t('subscription.timeLeftInSubscription') || 'Time left in subscription')
          }
        </p>
      </div>
    );
  }

  return (
    <div className="text-center">
      <div className={`mt-2 ${getStatusColor()}`}>
        <div className="flex justify-center space-x-4 text-sm font-mono">
          <div className="text-center">
            <div className="font-bold text-lg">{timeLeft.days}</div>
            <div className="text-xs">{t('subscription.days') || 'days'}</div>
          </div>
          <div className="text-center">
            <div className="font-bold text-lg">{timeLeft.hours}</div>
            <div className="text-xs">{t('subscription.hours') || 'hours'}</div>
          </div>
          <div className="text-center">
            <div className="font-bold text-lg">{timeLeft.minutes}</div>
            <div className="text-xs">{t('subscription.minutes') || 'minutes'}</div>
          </div>
          <div className="text-center">
            <div className="font-bold text-lg">{timeLeft.seconds}</div>
            <div className="text-xs">{t('subscription.seconds') || 'seconds'}</div>
          </div>
        </div>
        <p className="text-xs mt-2">
          {status === 'trial' 
            ? (t('subscription.timeLeftInTrial') || 'Time left in trial') 
            : (t('subscription.timeLeftInSubscription') || 'Time left in subscription')
          }
        </p>
      </div>
    </div>
  );
};
