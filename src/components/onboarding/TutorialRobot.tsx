import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bot, ChevronRight, X, HandMetal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';

interface TutorialRobotProps {
  selector: string;
  title: string;
  description: string;
  currentStep: number;
  totalSteps: number;
  onNext: () => void;
  onDismiss: () => void;
  isLast: boolean;
  clickToAdvance?: boolean;
}

type ArrowSide = 'top' | 'bottom' | 'left';

export const TutorialRobot = ({
  selector,
  title,
  description,
  currentStep,
  totalSteps,
  onNext,
  onDismiss,
  isLast,
  clickToAdvance,
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

    const viewportW = window.innerWidth;
    const viewportH = window.innerHeight;
    const bubbleW = Math.min(320, viewportW - 24);
    const bubbleH = 210;

    const centerLeft = Math.max(12, Math.min(rect.left + rect.width / 2 - bubbleW / 2, viewportW - bubbleW - 12));

    const candidates: Array<{ top: number; left: number; arrowSide: ArrowSide }> = [
      { top: rect.bottom + 14, left: centerLeft, arrowSide: 'top' },
      { top: rect.top - bubbleH - 14, left: centerLeft, arrowSide: 'bottom' },
      { top: Math.max(12, Math.min(rect.top - 10, viewportH - bubbleH - 12)), left: Math.min(rect.right + 14, viewportW - bubbleW - 12), arrowSide: 'left' },
    ];

    const intersects = (a: { top: number; left: number; width: number; height: number }, b: { top: number; left: number; width: number; height: number }) =>
      !(a.left + a.width < b.left || b.left + b.width < a.left || a.top + a.height < b.top || b.top + b.height < a.top);

    const chosen = candidates.find((c) => {
      const bubble = { top: c.top, left: c.left, width: bubbleW, height: bubbleH };
      const target = { top: rect.top - 8, left: rect.left - 8, width: rect.width + 16, height: rect.height + 16 };
      const insideViewport = c.top >= 8 && c.top + bubbleH <= viewportH - 8 && c.left >= 8 && c.left + bubbleW <= viewportW - 8;
      return insideViewport && !intersects(bubble, target);
    }) ?? candidates[0];

    setBubblePos(chosen);
  }, [selector]);

  useEffect(() => {
    const timer = setTimeout(updatePosition, 150);
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [updatePosition]);

  useEffect(() => {
    if (!clickToAdvance) return;
    const el = document.querySelector(selector);
    if (!el) return;
    const handleClick = () => setTimeout(onNext, 220);
    el.addEventListener('click', handleClick);
    return () => el.removeEventListener('click', handleClick);
  }, [selector, clickToAdvance, onNext]);

  if (!targetRect || !bubblePos) {
    return (
      <div className="fixed bottom-20 right-4 z-[14000] max-w-xs w-[85vw]">
        <div className="bg-background border border-border rounded-xl shadow-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Bot className="w-4 h-4 text-primary" />
              <h4 className="text-sm font-semibold text-foreground">{title}</h4>
            </div>
            <button onClick={onDismiss} className="text-muted-foreground hover:text-foreground"><X className="w-3.5 h-3.5" /></button>
          </div>
          <p className="text-xs text-muted-foreground mb-3">{description}</p>
          <div className="flex justify-end">
            <Button size="sm" onClick={onNext} className="h-7 text-xs">{isLast ? t('onboarding.finish') : t('onboarding.next')}</Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
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

      <AnimatePresence mode="wait">
        <motion.div
          key={`${currentStep}-${selector}`}
          className="fixed z-[14000]"
          style={{ top: bubblePos.top, left: bubblePos.left, maxWidth: Math.min(320, window.innerWidth - 24), width: '85vw' }}
          initial={{ opacity: 0, scale: 0.9, y: bubblePos.arrowSide === 'top' ? -8 : 8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9 }}
          transition={{ type: 'spring', stiffness: 320, damping: 24 }}
        >
          <div className="bg-background border border-border rounded-xl shadow-xl p-4 relative">
            {bubblePos.arrowSide === 'top' && <div className="absolute -top-[6px] left-8 w-3 h-3 bg-background border-l border-t border-border rotate-45" />}
            {bubblePos.arrowSide === 'bottom' && <div className="absolute -bottom-[6px] left-8 w-3 h-3 bg-background border-r border-b border-border rotate-45" />}

            <div className="flex items-start gap-3 mb-2">
              <motion.div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center shrink-0" animate={{ y: [0, -2, 0] }} transition={{ duration: 1.5, repeat: Infinity }}>
                <Bot className="w-4 h-4 text-primary-foreground" />
              </motion.div>
              <div className="flex-1 min-w-0"><h4 className="font-semibold text-foreground text-sm">{title}</h4></div>
              <button onClick={onDismiss} className="text-muted-foreground hover:text-foreground transition-colors p-0.5"><X className="w-3.5 h-3.5" /></button>
            </div>

            <p className="text-muted-foreground text-xs leading-relaxed mb-3 ml-11">{description}</p>

            {clickToAdvance && (
              <motion.div className="flex items-center gap-1.5 text-primary text-xs font-medium mb-3 ml-11" animate={{ x: [0, 4, 0] }} transition={{ duration: 1, repeat: Infinity }}>
                <HandMetal className="w-3.5 h-3.5" />
                {t('onboarding.clickToTry')}
              </motion.div>
            )}

            <div className="flex items-center justify-between ml-11">
              <div className="flex gap-1">
                {Array.from({ length: totalSteps }).map((_, i) => (
                  <div key={i} className={`w-1.5 h-1.5 rounded-full ${i < currentStep ? 'bg-primary' : 'bg-muted-foreground/25'}`} />
                ))}
              </div>
              <div className="flex items-center gap-1.5">
                <Button variant="ghost" size="sm" onClick={onDismiss} className="text-xs h-7 px-2">{t('onboarding.skip')}</Button>
                {!clickToAdvance && (
                  <Button variant="default" size="sm" onClick={onNext} className="h-7 px-3 text-xs gap-1">
                    {isLast ? t('onboarding.finish') : t('onboarding.next')}
                    <ChevronRight className="w-3 h-3" />
                  </Button>
                )}
              </div>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    </>
  );
};
