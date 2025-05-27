
import { useState, useEffect } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';

interface SubscriptionCountdownProps {
  status: 'trial' | 'trial_expired' | 'active' | 'expired' | 'canceled';
  currentPeriodEnd?: string | null;
  trialEnd?: string | null;
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

  useEffect(() => {
    const calculateTimeLeft = () => {
      let targetDate: Date | null = null;
      
      // Determine the target date based on status
      if (status === 'trial' && trialEnd) {
        targetDate = new Date(trialEnd);
      } else if (status === 'active' && currentPeriodEnd) {
        targetDate = new Date(currentPeriodEnd);
      }
      
      if (!targetDate || isNaN(targetDate.getTime())) {
        console.log('Invalid or missing target date:', { status, currentPeriodEnd, trialEnd, targetDate });
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0 });
        return;
      }
      
      const now = new Date().getTime();
      const target = targetDate.getTime();
      const difference = target - now;
      
      console.log('Countdown calculation:', { 
        status, 
        targetDate: targetDate.toISOString(), 
        now: new Date(now).toISOString(), 
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
      }
    };

    // Calculate immediately
    calculateTimeLeft();
    
    // Update every second
    const timer = setInterval(calculateTimeLeft, 1000);
    
    return () => clearInterval(timer);
  }, [status, currentPeriodEnd, trialEnd]);

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

  // Check if subscription has valid dates but time has expired
  const hasValidDate = (status === 'trial' && trialEnd) || (status === 'active' && currentPeriodEnd);
  const isExpired = timeLeft.days === 0 && timeLeft.hours === 0 && timeLeft.minutes === 0 && timeLeft.seconds === 0;
  
  if (hasValidDate && isExpired) {
    return (
      <div className="text-center p-4 rounded-lg border-2 border-red-200 bg-red-50">
        <p className="text-red-600 font-semibold">
          {status === 'trial' ? 'Trial Expired' : 'Subscription Expired'}
        </p>
        <p className="text-sm text-red-600 mt-1">Please upgrade to continue</p>
      </div>
    );
  }

  // Handle case when no valid dates are available
  if (!hasValidDate) {
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
