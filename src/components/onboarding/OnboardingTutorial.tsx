import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { TutorialWelcomeDialog } from './TutorialWelcomeDialog';
import { TutorialRobot } from './TutorialRobot';
import { useLanguage } from '@/contexts/LanguageContext';

interface TutorialStepData {
  id: string;
  selector: string;
  titleKey: string;
  descKey: string;
  clickToAdvance?: boolean;
  advanceOn?: string;
}

const TUTORIAL_STEPS: TutorialStepData[] = [
  { id: 'calendar-tab', selector: '[data-tutorial-step="calendar"]', titleKey: 'onboarding.calendarTabTitle', descKey: 'onboarding.calendarTabDesc', clickToAdvance: true },
  { id: 'calendar-add', selector: '[data-tutorial="calendar-add-event"]', titleKey: 'onboarding.addEventTitle', descKey: 'onboarding.addEventDesc', clickToAdvance: true },
  { id: 'calendar-submit', selector: '[data-tutorial="event-submit"]', titleKey: 'onboarding.fillEventTitle', descKey: 'onboarding.fillEventDesc', advanceOn: 'event-created' },

  { id: 'stats-tab', selector: '[data-tutorial-step="statistics"]', titleKey: 'onboarding.statisticsTabTitle', descKey: 'onboarding.statisticsTabDesc', clickToAdvance: true },
  { id: 'stats-export', selector: '[data-tutorial="stats-export"]', titleKey: 'onboarding.exportTitle', descKey: 'onboarding.exportDesc', advanceOn: 'stats-exported' },

  { id: 'crm-tab', selector: '[data-tutorial-step="crm"]', titleKey: 'onboarding.crmTabTitle', descKey: 'onboarding.crmTabDesc', clickToAdvance: true },
  { id: 'crm-add', selector: '[data-tutorial="crm-add-customer"]', titleKey: 'onboarding.addCustomerTitle', descKey: 'onboarding.addCustomerDesc', clickToAdvance: true },
  { id: 'crm-submit', selector: '[data-tutorial="customer-submit"]', titleKey: 'onboarding.fillCustomerTitle', descKey: 'onboarding.fillCustomerDesc', advanceOn: 'customer-created' },

  { id: 'tasks-tab', selector: '[data-tutorial-step="tasks"]', titleKey: 'onboarding.tasksTabTitle', descKey: 'onboarding.tasksTabDesc', clickToAdvance: true },
  { id: 'tasks-add', selector: '[data-tutorial="tasks-add"]', titleKey: 'onboarding.addTaskTitle', descKey: 'onboarding.addTaskDesc', clickToAdvance: true },
  { id: 'tasks-submit', selector: '[data-tutorial="task-submit"]', titleKey: 'onboarding.fillTaskTitle', descKey: 'onboarding.fillTaskDesc', advanceOn: 'task-created' },
  { id: 'tasks-move', selector: '[data-tutorial="tasks-board"]', titleKey: 'onboarding.moveTaskTitle', descKey: 'onboarding.moveTaskDesc', advanceOn: 'task-moved-inprogress' },

  { id: 'business-tab', selector: '[data-tutorial-step="business"]', titleKey: 'onboarding.businessTabTitle', descKey: 'onboarding.businessTabDesc', clickToAdvance: true },
  { id: 'business-save', selector: '[data-tutorial="business-save"]', titleKey: 'onboarding.businessSaveTitle', descKey: 'onboarding.businessSaveDesc', advanceOn: 'business-updated' },

  { id: 'chat', selector: '[data-tutorial="chat-icon"]', titleKey: 'onboarding.chatTitle', descKey: 'onboarding.chatDesc', clickToAdvance: true },
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
        setTimeout(() => setShowWelcome(true), 1500);
      }
    };

    checkLoginCount();
  }, [user, sessionDismissed]);

  const incrementLoginCount = useCallback(async () => {
    if (!user || loginCount === null) return;
    await supabase.from('profiles').update({ login_count: loginCount + 1 } as any).eq('id', user.id);
  }, [user, loginCount]);

  const handleNext = useCallback(() => {
    setCurrentStep((prev) => {
      if (prev < TUTORIAL_STEPS.length - 1) return prev + 1;
      setSessionDismissed(true);
      incrementLoginCount();
      return -1;
    });
  }, [incrementLoginCount]);

  useEffect(() => {
    if (!activeStep?.advanceOn) return;

    const handler = (event: Event) => {
      const customEvent = event as CustomEvent<{ action?: string }>;
      if (customEvent.detail?.action === activeStep.advanceOn) {
        setTimeout(() => handleNext(), 250);
      }
    };

    window.addEventListener('tutorial-action', handler as EventListener);
    return () => window.removeEventListener('tutorial-action', handler as EventListener);
  }, [activeStep, handleNext]);

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
      onDismiss={handleSkip}
      isLast={currentStep === TUTORIAL_STEPS.length - 1}
      clickToAdvance={activeStep.clickToAdvance}
    />
  );
};
