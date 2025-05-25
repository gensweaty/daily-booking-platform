
import { useState, useEffect } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';

interface SubscriptionCountdownProps {
  status: 'trial' | 'trial_expired' | 'active' | 'expired' | 'canceled';
  currentPeriodEnd?: string;
  trialEnd?: string;
  planType?: 'monthly' | 'yearly';
}

export const SubscriptionCountdown = ({ 
  status, 
  currentPeriodEnd, 
  trialEnd, 
  planType 
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
      
      if (status === 'trial' && trialEnd) {
        targetDate = new Date(trialEnd);
      } else if (status === 'active' && currentPeriodEnd) {
        targetDate = new Date(currentPeriodEnd);
      }
      
      if (!targetDate) {
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0 });
        return;
      }
      
      const now = new Date().getTime();
      const target = targetDate.getTime();
      const difference = target - now;
      
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
      return t('subscription.trialPeriod');
    } else if (status === 'active') {
      if (planType === 'monthly') {
        return t('subscription.monthlySubscription');
      } else if (planType === 'yearly') {
        return t('subscription.yearlySubscription');
      }
      return t('subscription.activeSubscription');
    } else if (status === 'trial_expired') {
      return t('subscription.trialExpired');
    } else if (status === 'expired') {
      return t('subscription.subscriptionExpired');
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

  if (status === 'trial_expired' || status === 'expired') {
    return (
      <div className={`text-center p-4 rounded-lg border-2 border-red-200 bg-red-50 ${getStatusColor()}`}>
        <p className="font-semibold">{getStatusMessage()}</p>
        <p className="text-sm">{t('subscription.pleaseUpgrade')}</p>
      </div>
    );
  }

  if (timeLeft.days === 0 && timeLeft.hours === 0 && timeLeft.minutes === 0 && timeLeft.seconds === 0) {
    return (
      <div className="text-center p-4 rounded-lg border-2 border-gray-200 bg-gray-50">
        <p className="text-gray-600">{t('subscription.noActiveSubscription')}</p>
      </div>
    );
  }

  return (
    <div className={`text-center p-4 rounded-lg border-2 ${
      timeLeft.days <= 7 ? 'border-orange-200 bg-orange-50' : 'border-green-200 bg-green-50'
    }`}>
      <p className={`font-semibold ${getStatusColor()}`}>{getStatusMessage()}</p>
      <div className={`mt-2 ${getStatusColor()}`}>
        <div className="flex justify-center space-x-4 text-lg font-mono">
          <div className="text-center">
            <div className="font-bold text-2xl">{timeLeft.days}</div>
            <div className="text-xs">{t('subscription.days')}</div>
          </div>
          <div className="text-center">
            <div className="font-bold text-2xl">{timeLeft.hours}</div>
            <div className="text-xs">{t('subscription.hours')}</div>
          </div>
          <div className="text-center">
            <div className="font-bold text-2xl">{timeLeft.minutes}</div>
            <div className="text-xs">{t('subscription.minutes')}</div>
          </div>
          <div className="text-center">
            <div className="font-bold text-2xl">{timeLeft.seconds}</div>
            <div className="text-xs">{t('subscription.seconds')}</div>
          </div>
        </div>
        <p className="text-sm mt-2">
          {status === 'trial' 
            ? t('subscription.timeLeftInTrial') 
            : t('subscription.timeLeftInSubscription')
          }
        </p>
      </div>
    </div>
  );
};
