
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { TutorialWelcomeDialog } from './TutorialWelcomeDialog';
import { TutorialStep } from './TutorialStep';
import { useLanguage } from '@/contexts/LanguageContext';

const TUTORIAL_STEPS = [
  {
    selector: '[data-value="calendar"]',
    titleKey: 'onboarding.calendarTitle',
    descKey: 'onboarding.calendarDesc',
  },
  {
    selector: '[data-value="statistics"]',
    titleKey: 'onboarding.statisticsTitle',
    descKey: 'onboarding.statisticsDesc',
  },
  {
    selector: '[data-value="tasks"]',
    titleKey: 'onboarding.tasksTitle',
    descKey: 'onboarding.tasksDesc',
  },
  {
    selector: '[data-value="crm"]',
    titleKey: 'onboarding.crmTitle',
    descKey: 'onboarding.crmDesc',
  },
  {
    selector: '[data-value="business"]',
    titleKey: 'onboarding.businessTitle',
    descKey: 'onboarding.businessDesc',
  },
  {
    selector: '[data-tutorial="chat-icon"]',
    titleKey: 'onboarding.chatTitle',
    descKey: 'onboarding.chatDesc',
  },
  {
    selector: '[data-tutorial="profile-area"]',
    titleKey: 'onboarding.profileTitle',
    descKey: 'onboarding.profileDesc',
  },
];

export const OnboardingTutorial = () => {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [showWelcome, setShowWelcome] = useState(false);
  const [currentStep, setCurrentStep] = useState(-1); // -1 = not started
  const [loginCount, setLoginCount] = useState<number | null>(null);

  useEffect(() => {
    if (!user) return;

    const checkLoginCount = async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('login_count')
        .eq('id', user.id)
        .maybeSingle();

      if (error || !data) return;

      const count = (data as any).login_count ?? 0;
      setLoginCount(count);

      if (count < 3) {
        // Small delay so dashboard renders first
        setTimeout(() => setShowWelcome(true), 1500);
      }
    };

    checkLoginCount();
  }, [user]);

  const incrementLoginCount = useCallback(async () => {
    if (!user || loginCount === null) return;
    await supabase
      .from('profiles')
      .update({ login_count: (loginCount + 1) } as any)
      .eq('id', user.id);
  }, [user, loginCount]);

  const handleStart = () => {
    setShowWelcome(false);
    setCurrentStep(0);
  };

  const handleSkip = () => {
    setShowWelcome(false);
    setCurrentStep(-1);
    incrementLoginCount();
  };

  const handleNext = () => {
    if (currentStep < TUTORIAL_STEPS.length - 1) {
      setCurrentStep(prev => prev + 1);
    } else {
      // Tutorial complete
      setCurrentStep(-1);
      incrementLoginCount();
    }
  };

  const handleStepSkip = () => {
    setCurrentStep(-1);
    incrementLoginCount();
  };

  if (showWelcome) {
    return <TutorialWelcomeDialog onStart={handleStart} onSkip={handleSkip} />;
  }

  if (currentStep >= 0 && currentStep < TUTORIAL_STEPS.length) {
    const step = TUTORIAL_STEPS[currentStep];
    return (
      <TutorialStep
        selector={step.selector}
        title={t(step.titleKey)}
        description={t(step.descKey)}
        currentStep={currentStep + 1}
        totalSteps={TUTORIAL_STEPS.length}
        onNext={handleNext}
        onSkip={handleStepSkip}
        isLast={currentStep === TUTORIAL_STEPS.length - 1}
      />
    );
  }

  return null;
};
