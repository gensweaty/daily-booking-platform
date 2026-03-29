import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
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
  switchTab?: string;
  switchBusinessTab?: 'profile' | 'bookings';
  advanceOnClickSelector?: string;
  suppressWhenSelector?: string;
}

const TUTORIAL_STEPS: TutorialStep[] = [
  // 1. Calendar - show Add Event button
  {
    id: 'calendar-add',
    selector: '[data-tutorial="calendar-add-event"]',
    titleKey: 'onboarding.calendarAddTitle',
    descKey: 'onboarding.calendarAddDesc',
    switchTab: 'calendar',
  },
  // 2. Statistics - show Export Excel button
  {
    id: 'statistics-export',
    selector: '[data-tutorial="statistics-export-btn"]',
    titleKey: 'onboarding.statisticsTitle',
    descKey: 'onboarding.statisticsDesc',
    switchTab: 'statistics',
  },
  // 3. Tasks - show Add Task button
  {
    id: 'tasks-add',
    selector: '[data-tutorial="tasks-add-btn"]',
    titleKey: 'onboarding.tasksAddTitle',
    descKey: 'onboarding.tasksAddDesc',
    switchTab: 'tasks',
  },
  // 4. CRM - show Add Customer button
  {
    id: 'crm-add',
    selector: '[data-tutorial="crm-add-btn"]',
    titleKey: 'onboarding.crmAddTitle',
    descKey: 'onboarding.crmAddDesc',
    switchTab: 'crm',
  },
  // 5. Business - show profile tab
  {
    id: 'business-profile',
    selector: '[data-tutorial="business-profile-tab"]',
    titleKey: 'onboarding.businessProfileTabTitle',
    descKey: 'onboarding.businessProfileTabDesc',
    switchTab: 'business',
    switchBusinessTab: 'profile',
  },
  // 6. Chat icon
  {
    id: 'chat',
    selector: '[data-tutorial="chat-icon"]',
    titleKey: 'onboarding.chatTitle',
    descKey: 'onboarding.chatDesc',
  },
  // 7. Profile button
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

  // Check login count
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

  const advanceStep = useCallback(() => {
    setCurrentStep((prev) => {
      if (prev < TUTORIAL_STEPS.length - 1) return prev + 1;
      setSessionDismissed(true);
      incrementLoginCount();
      return -1;
    });
  }, [incrementLoginCount]);

  // Switch tab when step changes
  useEffect(() => {
    if (!activeStep) return;

    if (activeStep.switchTab) {
      window.dispatchEvent(new CustomEvent('switch-dashboard-tab', { detail: { tab: activeStep.switchTab } }));
      // Also click the tab trigger as backup
      const timeouts = [80, 200, 400].map((delay) =>
        setTimeout(() => {
          const tabEl = document.querySelector(`[data-tutorial-step="${activeStep.switchTab}"]`) as HTMLElement;
          if (tabEl) tabEl.click();
        }, delay)
      );
      return () => timeouts.forEach(clearTimeout);
    }
  }, [activeStep]);

  // Switch business sub-tab
  useEffect(() => {
    if (!activeStep?.switchBusinessTab) return;
    const id = setTimeout(() => {
      window.dispatchEvent(new CustomEvent('switch-business-tab', { detail: { tab: activeStep.switchBusinessTab } }));
    }, 300);
    return () => clearTimeout(id);
  }, [activeStep]);

  const handleNext = useCallback(() => advanceStep(), [advanceStep]);
  const handlePrev = useCallback(() => setCurrentStep((prev) => (prev > 0 ? prev - 1 : prev)), []);

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
      suppressWhenSelector={activeStep.suppressWhenSelector}
    />
  );
};
