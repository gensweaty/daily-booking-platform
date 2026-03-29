
import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bot, ArrowRight, X, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';

interface TutorialStepProps {
  selector: string;
  title: string;
  description: string;
  currentStep: number;
  totalSteps: number;
  onNext: () => void;
  onSkip: () => void;
  isLast: boolean;
}

interface Position {
  top: number;
  left: number;
  width: number;
  height: number;
}

export const TutorialStep = ({
  selector,
  title,
  description,
  currentStep,
  totalSteps,
  onNext,
  onSkip,
  isLast,
}: TutorialStepProps) => {
  const { t } = useLanguage();
  const [targetRect, setTargetRect] = useState<Position | null>(null);
  const [tooltipPos, setTooltipPos] = useState<'bottom' | 'top'>('bottom');
  const tooltipRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const findElement = () => {
      const el = document.querySelector(selector);
      if (!el) return;

      const rect = el.getBoundingClientRect();
      const padding = 6;
      setTargetRect({
        top: rect.top - padding,
        left: rect.left - padding,
        width: rect.width + padding * 2,
        height: rect.height + padding * 2,
      });

      // Decide tooltip position
      const spaceBelow = window.innerHeight - rect.bottom;
      setTooltipPos(spaceBelow > 220 ? 'bottom' : 'top');
    };

    // Small delay to let DOM settle
    const timer = setTimeout(findElement, 100);
    window.addEventListener('resize', findElement);
    window.addEventListener('scroll', findElement, true);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', findElement);
      window.removeEventListener('scroll', findElement, true);
    };
  }, [selector]);

  if (!targetRect) return null;

  // Calculate tooltip position
  const tooltipStyle: React.CSSProperties = {
    position: 'fixed',
    zIndex: 15002,
    maxWidth: '340px',
    width: '90vw',
  };

  if (tooltipPos === 'bottom') {
    tooltipStyle.top = targetRect.top + targetRect.height + 14;
    tooltipStyle.left = Math.max(
      12,
      Math.min(
        targetRect.left + targetRect.width / 2 - 170,
        window.innerWidth - 352
      )
    );
  } else {
    tooltipStyle.bottom = window.innerHeight - targetRect.top + 14;
    tooltipStyle.left = Math.max(
      12,
      Math.min(
        targetRect.left + targetRect.width / 2 - 170,
        window.innerWidth - 352
      )
    );
  }

  // Create overlay with cutout using box-shadow
  const overlayStyle: React.CSSProperties = {
    position: 'fixed',
    top: targetRect.top,
    left: targetRect.left,
    width: targetRect.width,
    height: targetRect.height,
    zIndex: 15001,
    borderRadius: '10px',
    boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.65)',
    pointerEvents: 'none',
    transition: 'all 0.3s ease',
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[15000]" onClick={onSkip}>
        {/* Spotlight cutout */}
        <div style={overlayStyle} />

        {/* Pulsing ring around target */}
        <motion.div
          className="border-2 border-primary rounded-[10px] pointer-events-none"
          style={{
            position: 'fixed',
            top: targetRect.top,
            left: targetRect.left,
            width: targetRect.width,
            height: targetRect.height,
            zIndex: 15001,
          }}
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 1.5, repeat: Infinity }}
        />

        {/* Tooltip card */}
        <motion.div
          ref={tooltipRef}
          style={tooltipStyle}
          className="bg-background border border-border rounded-xl shadow-2xl p-5"
          initial={{ opacity: 0, y: tooltipPos === 'bottom' ? -10 : 10, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ type: 'spring', stiffness: 300, damping: 25 }}
          onClick={(e) => e.stopPropagation()}
          key={currentStep}
        >
          {/* Header */}
          <div className="flex items-start gap-3 mb-3">
            <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
              <Bot className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-foreground text-sm leading-tight">
                {title}
              </h3>
            </div>
            <button
              onClick={onSkip}
              className="text-muted-foreground hover:text-foreground transition-colors p-1 -mt-1 -mr-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Description */}
          <p className="text-muted-foreground text-sm leading-relaxed mb-4 pl-12">
            {description}
          </p>

          {/* Footer */}
          <div className="flex items-center justify-between pl-12">
            <span className="text-xs text-muted-foreground">
              {currentStep} / {totalSteps}
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={onSkip}
                className="text-xs h-8"
              >
                {t('onboarding.skip')}
              </Button>
              <Button
                variant="default"
                size="sm"
                onClick={onNext}
                className="h-8 gap-1"
              >
                {isLast ? t('onboarding.finish') : t('onboarding.next')}
                <ChevronRight className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>

          {/* Step dots */}
          <div className="flex justify-center gap-1.5 mt-3">
            {Array.from({ length: totalSteps }).map((_, i) => (
              <div
                key={i}
                className={`w-1.5 h-1.5 rounded-full transition-colors ${
                  i < currentStep
                    ? 'bg-primary'
                    : i === currentStep - 1
                    ? 'bg-primary'
                    : 'bg-muted-foreground/30'
                }`}
              />
            ))}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
