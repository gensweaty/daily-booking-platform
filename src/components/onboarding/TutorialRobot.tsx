import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bot, ChevronRight, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';

interface TutorialRobotProps {
  selector: string;
  title: string;
  description: string;
  currentStep: number;
  totalSteps: number;
  onNext: () => void;
  onPrev: () => void;
  onDismiss: () => void;
  isLast: boolean;
  isFirst: boolean;
}

type ArrowSide = 'top' | 'bottom' | 'left';

export const TutorialRobot = ({
  selector,
  title,
  description,
  currentStep,
  totalSteps,
  onNext,
  onPrev,
  onDismiss,
  isLast,
  isFirst,
}: TutorialRobotProps) => {
  const { t } = useLanguage();
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const [bubblePos, setBubblePos] = useState<{ top: number; left: number; arrowSide: ArrowSide } | null>(null);

  const updatePosition = useCallback(() => {
    const el = document.querySelector(selector);
    if (!el) {
      setTargetRect(null);
      setBubblePos(null);
      return;
    }

    const rect = el.getBoundingClientRect();
    setTargetRect(rect);

    const vW = window.innerWidth;
    const vH = window.innerHeight;
    const bW = Math.min(300, vW - 24);
    const bH = 200;

    const centerLeft = Math.max(12, Math.min(rect.left + rect.width / 2 - bW / 2, vW - bW - 12));

    // Try below, above, then right
    const candidates: Array<{ top: number; left: number; arrowSide: ArrowSide }> = [
      { top: rect.bottom + 14, left: centerLeft, arrowSide: 'top' },
      { top: rect.top - bH - 14, left: centerLeft, arrowSide: 'bottom' },
      { top: Math.max(12, Math.min(rect.top - 10, vH - bH - 12)), left: Math.min(rect.right + 14, vW - bW - 12), arrowSide: 'left' },
    ];

    const chosen = candidates.find((c) => {
      return c.top >= 8 && c.top + bH <= vH - 8 && c.left >= 8 && c.left + bW <= vW - 8;
    }) ?? candidates[0];

    setBubblePos(chosen);
  }, [selector]);

  useEffect(() => {
    // Small delay for DOM to settle after tab switch
    const timer = setTimeout(updatePosition, 250);
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [updatePosition]);

  // Fallback floating bubble when element not found
  if (!targetRect || !bubblePos) {
    return (
      <motion.div
        className="fixed bottom-20 right-4 z-[14000] max-w-[280px] w-[85vw]"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="bg-background border border-border rounded-xl shadow-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center">
                <Bot className="w-3.5 h-3.5 text-primary-foreground" />
              </div>
              <h4 className="text-sm font-semibold text-foreground">{title}</h4>
            </div>
            <button onClick={onDismiss} className="text-muted-foreground hover:text-foreground"><X className="w-3.5 h-3.5" /></button>
          </div>
          <p className="text-xs text-muted-foreground mb-3">{description}</p>
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-muted-foreground">{currentStep}/{totalSteps}</span>
            <div className="flex items-center gap-1.5">
              {!isFirst && (
                <Button variant="ghost" size="sm" onClick={onPrev} className="h-7 text-xs gap-1">
                  <ChevronRight className="w-3 h-3 rotate-180" />
                  {t('onboarding.previous')}
                </Button>
              )}
              <Button size="sm" onClick={onNext} className="h-7 text-xs gap-1">
                {isLast ? t('onboarding.finish') : t('onboarding.next')}
                {!isLast && <ChevronRight className="w-3 h-3" />}
              </Button>
            </div>
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <>
      {/* Pulsing highlight ring around target */}
      <motion.div
        className="fixed pointer-events-none z-[13500]"
        style={{ top: targetRect.top - 4, left: targetRect.left - 4, width: targetRect.width + 8, height: targetRect.height + 8, borderRadius: 10 }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      >
        <motion.div
          className="w-full h-full rounded-[10px] border-2 border-primary"
          animate={{ boxShadow: ['0 0 0 0 hsl(var(--primary) / 0.45)', '0 0 0 8px hsl(var(--primary) / 0)'] }}
          transition={{ duration: 1.25, repeat: Infinity }}
        />
      </motion.div>

      {/* Speech bubble */}
      <AnimatePresence mode="wait">
        <motion.div
          key={`step-${currentStep}`}
          className="fixed z-[14000]"
          style={{ top: bubblePos.top, left: bubblePos.left, maxWidth: Math.min(300, window.innerWidth - 24), width: '85vw' }}
          initial={{ opacity: 0, scale: 0.9, y: bubblePos.arrowSide === 'top' ? -8 : 8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9 }}
          transition={{ type: 'spring', stiffness: 320, damping: 24 }}
        >
          <div className="bg-background border border-border rounded-xl shadow-xl p-4 relative">
            {/* Arrow */}
            {bubblePos.arrowSide === 'top' && <div className="absolute -top-[6px] left-8 w-3 h-3 bg-background border-l border-t border-border rotate-45" />}
            {bubblePos.arrowSide === 'bottom' && <div className="absolute -bottom-[6px] left-8 w-3 h-3 bg-background border-r border-b border-border rotate-45" />}
            {bubblePos.arrowSide === 'left' && <div className="absolute top-6 -left-[6px] w-3 h-3 bg-background border-l border-b border-border rotate-45" />}

            {/* Header with robot */}
            <div className="flex items-start gap-2.5 mb-2">
              <motion.div
                className="w-8 h-8 rounded-full bg-primary flex items-center justify-center shrink-0"
                animate={{ y: [0, -2, 0] }}
                transition={{ duration: 1.5, repeat: Infinity }}
              >
                <Bot className="w-4 h-4 text-primary-foreground" />
              </motion.div>
              <div className="flex-1 min-w-0">
                <h4 className="font-semibold text-foreground text-sm leading-tight">{title}</h4>
              </div>
              <button onClick={onDismiss} className="text-muted-foreground hover:text-foreground transition-colors p-0.5 shrink-0">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Description */}
            <p className="text-muted-foreground text-xs leading-relaxed mb-3 ml-[42px]">{description}</p>

            {/* Footer */}
            <div className="flex items-center justify-between ml-[42px]">
              <div className="flex gap-1">
                {Array.from({ length: totalSteps }).map((_, i) => (
                  <div
                    key={i}
                    className={`w-1.5 h-1.5 rounded-full transition-colors ${i < currentStep ? 'bg-primary' : i === currentStep - 1 ? 'bg-primary' : 'bg-muted-foreground/25'}`}
                  />
                ))}
              </div>
              <div className="flex items-center gap-1.5">
                <Button variant="ghost" size="sm" onClick={onDismiss} className="text-xs h-7 px-2">
                  {t('onboarding.skip')}
                </Button>
                {!isFirst && (
                  <Button variant="outline" size="sm" onClick={onPrev} className="h-7 px-2 text-xs gap-1">
                    <ChevronRight className="w-3 h-3 rotate-180" />
                    {t('onboarding.previous')}
                  </Button>
                )}
                <Button variant="default" size="sm" onClick={onNext} className="h-7 px-3 text-xs gap-1">
                  {isLast ? t('onboarding.finish') : t('onboarding.next')}
                  {!isLast && <ChevronRight className="w-3 h-3" />}
                </Button>
              </div>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    </>
  );
};
