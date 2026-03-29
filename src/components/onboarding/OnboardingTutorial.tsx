
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { TutorialWelcomeDialog } from './TutorialWelcomeDialog';
import { TutorialRobot } from './TutorialRobot';
import { useLanguage } from '@/contexts/LanguageContext';

export interface TutorialStepData {
  selector: string;
  titleKey: string;
  descKey: string;
  clickToAdvance?: boolean; // If true, clicking the target element advances to next step
}

const TUTORIAL_STEPS: TutorialStepData[] = [
  {
    selector: '[data-tutorial-step="calendar"]',
    titleKey: 'onboarding.calendarTitle',
    descKey: 'onboarding.calendarDesc',
    clickToAdvance: true,
  },
  {
    selector: '[data-tutorial-step="statistics"]',
    titleKey: 'onboarding.statisticsTitle',
    descKey: 'onboarding.statisticsDesc',
    clickToAdvance: true,
  },
  {
    selector: '[data-tutorial-step="tasks"]',
    titleKey: 'onboarding.tasksTitle',
    descKey: 'onboarding.tasksDesc',
    clickToAdvance: true,
  },
  {
    selector: '[data-tutorial-step="crm"]',
    titleKey: 'onboarding.crmTitle',
    descKey: 'onboarding.crmDesc',
    clickToAdvance: true,
  },
  {
    selector: '[data-tutorial-step="business"]',
    titleKey: 'onboarding.businessTitle',
    descKey: 'onboarding.businessDesc',
    clickToAdvance: true,
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
  const [sessionDismissed, setSessionDismissed] = useState(false);

  useEffect(() => {
    if (!user || sessionDismissed) return;

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
        // Delay to let dashboard fully render
        setTimeout(() => setShowWelcome(true), 2000);
      }
    };

    checkLoginCount();
  }, [user, sessionDismissed]);

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
    setSessionDismissed(true);
    incrementLoginCount();
  };

  const handleNext = () => {
    if (currentStep < TUTORIAL_STEPS.length - 1) {
      setCurrentStep(prev => prev + 1);
    } else {
      // Tutorial complete
      setCurrentStep(-1);
      setSessionDismissed(true);
      incrementLoginCount();
    }
  };

  const handleDismiss = () => {
    setCurrentStep(-1);
    setSessionDismissed(true);
    incrementLoginCount();
  };

  if (showWelcome) {
    return <TutorialWelcomeDialog onStart={handleStart} onSkip={handleSkip} />;
  }

  if (currentStep >= 0 && currentStep < TUTORIAL_STEPS.length) {
    const step = TUTORIAL_STEPS[currentStep];
    return (
      <TutorialRobot
        key={currentStep}
        selector={step.selector}
        title={t(step.titleKey)}
        description={t(step.descKey)}
        currentStep={currentStep + 1}
        totalSteps={TUTORIAL_STEPS.length}
        onNext={handleNext}
        onDismiss={handleDismiss}
        isLast={currentStep === TUTORIAL_STEPS.length - 1}
        clickToAdvance={step.clickToAdvance}
      />
    );
  }

  return null;
};
