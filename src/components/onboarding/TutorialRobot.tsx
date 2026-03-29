
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
  const [bubblePos, setBubblePos] = useState<{ top: number; left: number; arrowSide: 'top' | 'bottom' | 'left' } | null>(null);

  const updatePosition = useCallback(() => {
    const el = document.querySelector(selector);
    if (!el) {
      console.warn('Tutorial: element not found for selector:', selector);
      return;
    }

    const rect = el.getBoundingClientRect();
    setTargetRect(rect);

    // Position the speech bubble near the element
    const viewportW = window.innerWidth;
    const viewportH = window.innerHeight;
    const bubbleW = Math.min(300, viewportW - 24);
    const bubbleH = 180;

    // Default: below the element
    let top = rect.bottom + 16;
    let left = Math.max(12, Math.min(rect.left + rect.width / 2 - bubbleW / 2, viewportW - bubbleW - 12));
    let arrowSide: 'top' | 'bottom' | 'left' = 'top';

    // If not enough space below, put above
    if (top + bubbleH > viewportH - 20) {
      top = rect.top - bubbleH - 16;
      arrowSide = 'bottom';
    }

    // If still off screen (too high), put to the right
    if (top < 12) {
      top = Math.max(12, rect.top);
      left = rect.right + 16;
      arrowSide = 'left';
      if (left + bubbleW > viewportW - 12) {
        left = rect.left - bubbleW - 16;
      }
    }

    setBubblePos({ top, left, arrowSide });
  }, [selector]);

  useEffect(() => {
    // Delay slightly so DOM is ready
    const timer = setTimeout(updatePosition, 200);
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [updatePosition]);

  // Listen for clicks on target element to advance
  useEffect(() => {
    if (!clickToAdvance) return;

    const el = document.querySelector(selector);
    if (!el) return;

    const handleClick = () => {
      // Small delay so the tab actually switches
      setTimeout(onNext, 300);
    };

    el.addEventListener('click', handleClick);
    return () => el.removeEventListener('click', handleClick);
  }, [selector, clickToAdvance, onNext]);

  if (!targetRect || !bubblePos) return null;

  return (
    <>
      {/* Pulsing highlight ring around target element */}
      <motion.div
        className="fixed pointer-events-none z-[13500]"
        style={{
          top: targetRect.top - 4,
          left: targetRect.left - 4,
          width: targetRect.width + 8,
          height: targetRect.height + 8,
          borderRadius: 10,
        }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      >
        <motion.div
          className="w-full h-full rounded-[10px] border-2 border-primary"
          animate={{ 
            boxShadow: [
              '0 0 0 0 hsl(var(--primary) / 0.4)',
              '0 0 0 6px hsl(var(--primary) / 0)',
            ]
          }}
          transition={{ duration: 1.2, repeat: Infinity }}
        />
      </motion.div>

      {/* Robot + Speech Bubble */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentStep}
          className="fixed z-[14000]"
          style={{
            top: bubblePos.top,
            left: bubblePos.left,
            maxWidth: Math.min(300, window.innerWidth - 24),
            width: '85vw',
          }}
          initial={{ opacity: 0, scale: 0.85, y: bubblePos.arrowSide === 'top' ? -10 : 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.85 }}
          transition={{ type: 'spring', stiffness: 350, damping: 28 }}
        >
          {/* Speech bubble */}
          <div className="bg-background border border-border rounded-xl shadow-xl p-4 relative">
            {/* Arrow */}
            {bubblePos.arrowSide === 'top' && (
              <div className="absolute -top-[6px] left-8 w-3 h-3 bg-background border-l border-t border-border rotate-45" />
            )}
            {bubblePos.arrowSide === 'bottom' && (
              <div className="absolute -bottom-[6px] left-8 w-3 h-3 bg-background border-r border-b border-border rotate-45" />
            )}

            {/* Header with robot avatar */}
            <div className="flex items-start gap-3 mb-2">
              <motion.div
                className="w-8 h-8 rounded-full bg-primary flex items-center justify-center flex-shrink-0"
                animate={{ y: [0, -2, 0] }}
                transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
              >
                <Bot className="w-4 h-4 text-primary-foreground" />
              </motion.div>
              <div className="flex-1 min-w-0">
                <h4 className="font-semibold text-foreground text-sm">{title}</h4>
              </div>
              <button
                onClick={onDismiss}
                className="text-muted-foreground hover:text-foreground transition-colors p-0.5"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Description */}
            <p className="text-muted-foreground text-xs leading-relaxed mb-3 ml-11">
              {description}
            </p>

            {/* Click hint for tab steps */}
            {clickToAdvance && (
              <motion.div
                className="flex items-center gap-1.5 text-primary text-xs font-medium mb-3 ml-11"
                animate={{ x: [0, 4, 0] }}
                transition={{ duration: 1, repeat: Infinity }}
              >
                <HandMetal className="w-3.5 h-3.5" />
                {t('onboarding.clickToTry')}
              </motion.div>
            )}

            {/* Footer */}
            <div className="flex items-center justify-between ml-11">
              {/* Step dots */}
              <div className="flex gap-1">
                {Array.from({ length: totalSteps }).map((_, i) => (
                  <div
                    key={i}
                    className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${
                      i < currentStep
                        ? 'bg-primary'
                        : 'bg-muted-foreground/25'
                    }`}
                  />
                ))}
              </div>

              <div className="flex items-center gap-1.5">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onDismiss}
                  className="text-xs h-7 px-2"
                >
                  {t('onboarding.skip')}
                </Button>
                {!clickToAdvance && (
                  <Button
                    variant="default"
                    size="sm"
                    onClick={onNext}
                    className="h-7 px-3 text-xs gap-1"
                  >
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
