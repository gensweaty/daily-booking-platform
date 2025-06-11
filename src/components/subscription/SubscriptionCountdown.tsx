
import { useState, useEffect } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';

interface SubscriptionCountdownProps {
  status: 'trial' | 'trial_expired' | 'active' | 'expired' | 'canceled';
  currentPeriodEnd?: string;
  trialEnd?: string;
  subscription_end_date?: string;
  planType?: 'monthly' | 'yearly' | 'ultimate';
  compact?: boolean;
}

export const SubscriptionCountdown = ({ 
  status, 
  currentPeriodEnd, 
  trialEnd, 
  subscription_end_date,
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

  useEffect(() => {
    // If it's an ultimate plan, no countdown needed
    if (planType === 'ultimate') {
      return;
    }

    const calculateTimeLeft = () => {
      let targetDate: Date | null = null;
      
      // Priority 1: Use subscription_end_date for active subscriptions (most reliable)
      if (status === 'active' && subscription_end_date) {
        targetDate = new Date(subscription_end_date);
        console.log('[SubscriptionCountdown] Using subscription_end_date:', subscription_end_date);
      } 
      // Priority 2: Use trial end date for trials
      else if (status === 'trial' && trialEnd) {
        targetDate = new Date(trialEnd);
        console.log('[SubscriptionCountdown] Using trialEnd:', trialEnd);
      } 
      // Fallback: Use current period end (legacy support)
      else if ((status === 'trial' || status === 'active') && currentPeriodEnd) {
        targetDate = new Date(currentPeriodEnd);
        console.log('[SubscriptionCountdown] Using currentPeriodEnd:', currentPeriodEnd);
      }
      
      if (!targetDate) {
        console.log('[SubscriptionCountdown] No valid target date found');
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0 });
        return;
      }
      
      const now = new Date().getTime();
      const target = targetDate.getTime();
      const difference = target - now;
      
      console.log('[SubscriptionCountdown] Time calculation:', {
        now: new Date(now).toISOString(),
        target: targetDate.toISOString(),
        difference: difference,
        differenceInDays: Math.floor(difference / (1000 * 60 * 60 * 24))
      });
      
      if (difference > 0) {
        const days = Math.floor(difference / (1000 * 60 * 60 * 24));
        const hours = Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((difference % (1000 * 60)) / 1000);
        
        setTimeLeft({ days, hours, minutes, seconds });
      } else {
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0 });
      }
    };

    // Calculate immediately
    calculateTimeLeft();
    
    // Update every second
    const timer = setInterval(calculateTimeLeft, 1000);
    
    return () => clearInterval(timer);
  }, [status, currentPeriodEnd, trialEnd, subscription_end_date, planType]);

  const getStatusMessage = () => {
    if (planType === 'ultimate') {
      return t('subscription.ultimateSubscription') || 'Ultimate Subscription';
    } else if (status === 'trial') {
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
    if (planType === 'ultimate') {
      return 'text-purple-600';
    } else if (status === 'trial') {
      return timeLeft.days <= 3 ? 'text-orange-600' : 'text-blue-600';
    } else if (status === 'active') {
      return timeLeft.days <= 7 ? 'text-orange-600' : 'text-green-600';
    } else if (status === 'trial_expired' || status === 'expired') {
      return 'text-red-600';
    }
    return 'text-gray-600';
  };

  const getBorderColor = () => {
    if (planType === 'ultimate') {
      return 'border-purple-200 bg-purple-50';
    } else if (status === 'trial') {
      return timeLeft.days <= 3 ? 'border-orange-200 bg-orange-50' : 'border-blue-200 bg-blue-50';
    } else if (status === 'active') {
      return timeLeft.days <= 7 ? 'border-orange-200 bg-orange-50' : 'border-green-200 bg-green-50';
    } else if (status === 'trial_expired' || status === 'expired') {
      return 'border-red-200 bg-red-50';
    }
    return 'border-gray-200 bg-gray-50';
  };

  // Ultimate plan - show unlimited status
  if (planType === 'ultimate') {
    return (
      <div className={`text-center p-4 rounded-lg border-2 ${getBorderColor()}`}>
        <p className={`font-semibold ${getStatusColor()}`}>{getStatusMessage()}</p>
        <p className="text-sm mt-1 text-purple-600">
          {t('subscription.unlimitedAccess') || 'Unlimited Access - No Expiration'}
        </p>
      </div>
    );
  }

  // Handle expired states
  if (status === 'trial_expired' || status === 'expired') {
    return (
      <div className={`text-center p-4 rounded-lg border-2 ${getBorderColor()}`}>
        <p className={`font-semibold ${getStatusColor()}`}>{getStatusMessage()}</p>
        <p className="text-sm mt-1">{t('subscription.pleaseUpgrade') || 'Please upgrade to continue using premium features'}</p>
      </div>
    );
  }

  // CRITICAL FIX: Handle active subscriptions with missing dates gracefully
  if (status === 'active' && timeLeft.days === 0 && timeLeft.hours === 0 && timeLeft.minutes === 0 && timeLeft.seconds === 0) {
    // If we have an active status but no countdown data, show a positive active message instead of "expired"
    if (!subscription_end_date && !currentPeriodEnd) {
      return (
        <div className="text-center p-4 rounded-lg border-2 border-green-200 bg-green-50">
          <p className="text-green-600 font-semibold">
            {getStatusMessage()}
          </p>
          <p className="text-sm text-green-600 mt-1">
            {t('subscription.subscriptionActive') || 'Your subscription is active'}
          </p>
        </div>
      );
    }
  }

  // Handle case when the subscription has ended (countdown reached zero) for trials only
  if ((status === 'trial') && timeLeft.days === 0 && timeLeft.hours === 0 && timeLeft.minutes === 0 && timeLeft.seconds === 0) {
    return (
      <div className="text-center p-4 rounded-lg border-2 border-red-200 bg-red-50">
        <p className="text-red-600 font-semibold">Trial Expired</p>
        <p className="text-sm text-red-600 mt-1">Please upgrade to continue</p>
      </div>
    );
  }

  // If no status at all
  if (!status) {
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
          {t('subscription.timeLeft') || 'Time left'}
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
          {t('subscription.timeLeft') || 'Time left'}
        </p>
      </div>
    </div>
  );
};
