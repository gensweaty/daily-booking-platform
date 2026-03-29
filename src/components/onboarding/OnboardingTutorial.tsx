import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { TutorialWelcomeDialog } from './TutorialWelcomeDialog';
import { TutorialRobot } from './TutorialRobot';
import { useLanguage } from '@/contexts/LanguageContext';

interface TutorialStep {
  id: string;
  selector: string;
  titleKey: string;
  descKey: string;
  /** If set, clicking this tab value switches the dashboard tab before highlighting */
  switchTab?: string;
}

const TUTORIAL_STEPS: TutorialStep[] = [
  {
    id: 'calendar',
    selector: '[data-tutorial-step="calendar"]',
    titleKey: 'onboarding.calendarTitle',
    descKey: 'onboarding.calendarDesc',
    switchTab: 'calendar',
  },
  {
    id: 'statistics',
    selector: '[data-tutorial-step="statistics"]',
    titleKey: 'onboarding.statisticsTitle',
    descKey: 'onboarding.statisticsDesc',
    switchTab: 'statistics',
  },
  {
    id: 'tasks',
    selector: '[data-tutorial-step="tasks"]',
    titleKey: 'onboarding.tasksTitle',
    descKey: 'onboarding.tasksDesc',
    switchTab: 'tasks',
  },
  {
    id: 'crm',
    selector: '[data-tutorial-step="crm"]',
    titleKey: 'onboarding.crmTitle',
    descKey: 'onboarding.crmDesc',
    switchTab: 'crm',
  },
  {
    id: 'business',
    selector: '[data-tutorial-step="business"]',
    titleKey: 'onboarding.businessTitle',
    descKey: 'onboarding.businessDesc',
    switchTab: 'business',
  },
  {
    id: 'chat',
    selector: '[data-tutorial="chat-icon"]',
    titleKey: 'onboarding.chatTitle',
    descKey: 'onboarding.chatDesc',
  },
  {
    id: 'profile',
    selector: '[data-tutorial="profile-area"]',
    titleKey: 'onboarding.profileTitle',
    descKey: 'onboarding.profileDesc',
  },
];

export const OnboardingTutorial = () => {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [showWelcome, setShowWelcome] = useState(false);
  const [currentStep, setCurrentStep] = useState(-1);
  const [loginCount, setLoginCount] = useState<number | null>(null);
  const [sessionDismissed, setSessionDismissed] = useState(false);

  const activeStep = useMemo(
    () => (currentStep >= 0 && currentStep < TUTORIAL_STEPS.length ? TUTORIAL_STEPS[currentStep] : null),
    [currentStep]
  );

  // Check login count on mount
  useEffect(() => {
    if (!user || sessionDismissed) return;
    const check = async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('login_count')
        .eq('id', user.id)
        .maybeSingle();
      if (error || !data) return;
      const count = (data as any).login_count ?? 0;
      setLoginCount(count);
      if (count < 3) {
        setTimeout(() => setShowWelcome(true), 1500);
      }
    };
    check();
  }, [user, sessionDismissed]);

  const incrementLoginCount = useCallback(async () => {
    if (!user || loginCount === null) return;
    await supabase.from('profiles').update({ login_count: loginCount + 1 } as any).eq('id', user.id);
  }, [user, loginCount]);

  // When step changes, switch tab if needed
  useEffect(() => {
    if (!activeStep?.switchTab) return;
    // Click the tab to switch
    const tabEl = document.querySelector(`[data-tutorial-step="${activeStep.switchTab}"]`) as HTMLElement;
    if (tabEl) {
      tabEl.click();
    }
  }, [activeStep]);

  const handleNext = useCallback(() => {
    setCurrentStep((prev) => {
      if (prev < TUTORIAL_STEPS.length - 1) return prev + 1;
      // Finished
      setSessionDismissed(true);
      incrementLoginCount();
      return -1;
    });
  }, [incrementLoginCount]);

  const handlePrev = useCallback(() => {
    setCurrentStep((prev) => (prev > 0 ? prev - 1 : prev));
  }, []);

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

  if (showWelcome) return <TutorialWelcomeDialog onStart={handleStart} onSkip={handleSkip} />;
  if (!activeStep) return null;

  return (
    <TutorialRobot
      key={activeStep.id}
      selector={activeStep.selector}
      title={t(activeStep.titleKey)}
      description={t(activeStep.descKey)}
      currentStep={currentStep + 1}
      totalSteps={TUTORIAL_STEPS.length}
      onNext={handleNext}
      onPrev={handlePrev}
      onDismiss={handleSkip}
      isLast={currentStep === TUTORIAL_STEPS.length - 1}
      isFirst={currentStep === 0}
    />
  );
};
