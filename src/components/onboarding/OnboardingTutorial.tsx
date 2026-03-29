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
  /** Switch dashboard tab before highlighting */
  switchTab?: string;
  /** Switch business sub-tab when business tab is active */
  switchBusinessTab?: 'profile' | 'bookings';
  /** Move to next step when user clicks selector */
  advanceOnClickSelector?: string;
  /** Temporarily hide bubble/highlight while selector exists */
  suppressWhenSelector?: string;
}

const TUTORIAL_STEPS: TutorialStep[] = [
  {
    id: 'calendar-add',
    selector: '[data-tutorial="calendar-add-event"]',
    titleKey: 'onboarding.calendarAddTitle',
    descKey: 'onboarding.calendarAddDesc',
    switchTab: 'calendar',
    advanceOnClickSelector: '[data-tutorial="calendar-add-event"]',
    suppressWhenSelector: '[data-tutorial="event-dialog"][data-state="open"]',
  },
  {
    id: 'event-form',
    selector: '[data-tutorial="event-name-input"]',
    titleKey: 'onboarding.eventFormTitle',
    descKey: 'onboarding.eventFormDesc',
    switchTab: 'calendar',
  },
  {
    id: 'event-save',
    selector: '[data-tutorial="event-submit-btn"]',
    titleKey: 'onboarding.eventSaveTitle',
    descKey: 'onboarding.eventSaveDesc',
    switchTab: 'calendar',
  },
  {
    id: 'statistics-export',
    selector: '[data-tutorial="statistics-export-btn"]',
    titleKey: 'onboarding.statisticsTitle',
    descKey: 'onboarding.statisticsDesc',
    switchTab: 'statistics',
  },
  {
    id: 'tasks-add',
    selector: '[data-tutorial="tasks-add-btn"]',
    titleKey: 'onboarding.tasksAddTitle',
    descKey: 'onboarding.tasksAddDesc',
    switchTab: 'tasks',
    advanceOnClickSelector: '[data-tutorial="tasks-add-btn"]',
    suppressWhenSelector: '[data-tutorial="task-dialog"][data-state="open"]',
  },
  {
    id: 'task-form',
    selector: '[data-tutorial="task-title-input"]',
    titleKey: 'onboarding.taskFormTitle',
    descKey: 'onboarding.taskFormDesc',
    switchTab: 'tasks',
  },
  {
    id: 'task-save',
    selector: '[data-tutorial="task-submit-btn"]',
    titleKey: 'onboarding.taskSaveTitle',
    descKey: 'onboarding.taskSaveDesc',
    switchTab: 'tasks',
  },
  {
    id: 'crm-add',
    selector: '[data-tutorial="crm-add-btn"]',
    titleKey: 'onboarding.crmAddTitle',
    descKey: 'onboarding.crmAddDesc',
    switchTab: 'crm',
    advanceOnClickSelector: '[data-tutorial="crm-add-btn"]',
    suppressWhenSelector: '[data-tutorial="customer-dialog"][data-state="open"]',
  },
  {
    id: 'crm-form',
    selector: '[data-tutorial="customer-name-input"]',
    titleKey: 'onboarding.crmFormTitle',
    descKey: 'onboarding.crmFormDesc',
    switchTab: 'crm',
  },
  {
    id: 'crm-save',
    selector: '[data-tutorial="customer-submit-btn"]',
    titleKey: 'onboarding.crmSaveTitle',
    descKey: 'onboarding.crmSaveDesc',
    switchTab: 'crm',
  },
  {
    id: 'business-profile-tab',
    selector: '[data-tutorial="business-profile-tab"]',
    titleKey: 'onboarding.businessProfileTabTitle',
    descKey: 'onboarding.businessProfileTabDesc',
    switchTab: 'business',
    switchBusinessTab: 'profile',
  },
  {
    id: 'business-form',
    selector: '[data-tutorial="business-name-input"]',
    titleKey: 'onboarding.businessFormTitle',
    descKey: 'onboarding.businessFormDesc',
    switchTab: 'business',
    switchBusinessTab: 'profile',
  },
  {
    id: 'business-save',
    selector: '[data-tutorial="business-save-btn"]',
    titleKey: 'onboarding.businessSaveTitle',
    descKey: 'onboarding.businessSaveDesc',
    switchTab: 'business',
    switchBusinessTab: 'profile',
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
  const autoAdvanceStepRef = useRef<string | null>(null);

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

  const advanceStep = useCallback(() => {
    setCurrentStep((prev) => {
      if (prev < TUTORIAL_STEPS.length - 1) return prev + 1;
      setSessionDismissed(true);
      incrementLoginCount();
      return -1;
    });
  }, [incrementLoginCount]);

  // When step changes, switch tab if needed and make sure target tab is active
  useEffect(() => {
    if (!activeStep) return;

    if (activeStep.switchTab) {
      window.dispatchEvent(new CustomEvent('switch-dashboard-tab', { detail: { tab: activeStep.switchTab } }));

      const activateDashboardTab = () => {
        const tabEl = document.querySelector(`[data-tutorial-step="${activeStep.switchTab}"]`) as HTMLElement | null;
        if (tabEl) tabEl.click();
      };

      const timeouts = [60, 160, 320].map((delay) => window.setTimeout(activateDashboardTab, delay));

      return () => {
        timeouts.forEach((timeoutId) => clearTimeout(timeoutId));
      };
    }

    return;
  }, [activeStep]);

  // Ensure business sub-tab is correct for onboarding
  useEffect(() => {
    if (!activeStep?.switchBusinessTab) return;
    const timeoutId = window.setTimeout(() => {
      window.dispatchEvent(
        new CustomEvent('switch-business-tab', { detail: { tab: activeStep.switchBusinessTab } })
      );
    }, 220);

    return () => clearTimeout(timeoutId);
  }, [activeStep]);

  // Auto-advance steps that are click-driven
  useEffect(() => {
    if (!activeStep?.advanceOnClickSelector) return;

    autoAdvanceStepRef.current = null;
    const selectors = activeStep.advanceOnClickSelector
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean);

    const handleClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target) return;

      const matchesSelector = selectors.some((selector) => {
        try {
          return Boolean(target.closest(selector));
        } catch {
          return false;
        }
      });

      if (!matchesSelector || autoAdvanceStepRef.current === activeStep.id) return;
      autoAdvanceStepRef.current = activeStep.id;
      window.setTimeout(() => {
        advanceStep();
      }, 140);
    };

    document.addEventListener('click', handleClick, true);
    return () => {
      document.removeEventListener('click', handleClick, true);
    };
  }, [activeStep, advanceStep]);

  const handleNext = useCallback(() => {
    advanceStep();
  }, [advanceStep]);

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
      suppressWhenSelector={activeStep.suppressWhenSelector}
    />
  );
};
