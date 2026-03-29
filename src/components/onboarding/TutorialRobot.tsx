import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bot, ChevronLeft, ChevronRight, X } from 'lucide-react';
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
  suppressWhenSelector?: string;
}

type ArrowSide = 'top' | 'bottom' | 'left' | 'right';

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
  suppressWhenSelector,
}: TutorialRobotProps) => {
  const { t } = useLanguage();
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const [bubblePos, setBubblePos] = useState<{ top: number; left: number; arrowSide: ArrowSide; arrowOffset: number } | null>(null);
  const [isSuppressed, setIsSuppressed] = useState(false);
  const bubbleRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!suppressWhenSelector) {
      setIsSuppressed(false);
      return;
    }

    const checkSuppressed = () => {
      try {
        setIsSuppressed(Boolean(document.querySelector(suppressWhenSelector)));
      } catch {
        setIsSuppressed(false);
      }
    };

    checkSuppressed();
    const intervalId = window.setInterval(checkSuppressed, 180);
    const observer = new MutationObserver(checkSuppressed);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-state'] });

    return () => {
      clearInterval(intervalId);
      observer.disconnect();
    };
  }, [suppressWhenSelector]);

  // Try multiple selectors (comma-separated)
  const findElement = useCallback(() => {
    const selectors = selector.split(',').map(s => s.trim());
    for (const sel of selectors) {
      try {
        const el = document.querySelector(sel);
        if (el) return el;
      } catch { /* skip invalid selectors */ }
    }
    return null;
  }, [selector]);

  const updatePosition = useCallback(() => {
    const el = findElement();
    if (!el) {
      setTargetRect(null);
      setBubblePos(null);
      return;
    }

    const rect = el.getBoundingClientRect();
    setTargetRect(rect);

    const vW = window.innerWidth;
    const vH = window.innerHeight;
    const BUBBLE_W = Math.min(340, vW - 24);
    const BUBBLE_H = 260;
    const GAP = 12;

    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    // Calculate arrow offset to point at element center
    const clampLeft = (left: number) => Math.max(16, Math.min(left, vW - BUBBLE_W - 16));

    type Candidate = { top: number; left: number; arrowSide: ArrowSide; arrowOffset: number; score: number };
    const candidates: Candidate[] = [];

    // Below element
    const belowLeft = clampLeft(centerX - BUBBLE_W / 2);
    const belowArrow = Math.max(20, Math.min(centerX - belowLeft, BUBBLE_W - 20));
    if (rect.bottom + GAP + BUBBLE_H <= vH - 16) {
      candidates.push({ top: rect.bottom + GAP, left: belowLeft, arrowSide: 'top', arrowOffset: belowArrow, score: 0 });
    }

    // Above element
    const aboveLeft = clampLeft(centerX - BUBBLE_W / 2);
    const aboveArrow = Math.max(20, Math.min(centerX - aboveLeft, BUBBLE_W - 20));
    if (rect.top - GAP - BUBBLE_H >= 16) {
      candidates.push({ top: rect.top - GAP - BUBBLE_H, left: aboveLeft, arrowSide: 'bottom', arrowOffset: aboveArrow, score: 1 });
    }

    // Right of element
    if (rect.right + GAP + BUBBLE_W <= vW - 16) {
      const rightTop = Math.max(16, Math.min(centerY - BUBBLE_H / 2, vH - BUBBLE_H - 16));
      const rightArrow = Math.max(20, Math.min(centerY - rightTop, BUBBLE_H - 20));
      candidates.push({ top: rightTop, left: rect.right + GAP, arrowSide: 'left', arrowOffset: rightArrow, score: 2 });
    }

    // Left of element
    if (rect.left - GAP - BUBBLE_W >= 16) {
      const leftTop = Math.max(16, Math.min(centerY - BUBBLE_H / 2, vH - BUBBLE_H - 16));
      const leftArrow = Math.max(20, Math.min(centerY - leftTop, BUBBLE_H - 20));
      candidates.push({ top: leftTop, left: rect.left - GAP - BUBBLE_W, arrowSide: 'right', arrowOffset: leftArrow, score: 3 });
    }

    // Pick best candidate, or fallback to below with clamping
    const chosen = candidates.sort((a, b) => a.score - b.score)[0] ?? {
      top: Math.max(16, Math.min(rect.bottom + GAP, vH - BUBBLE_H - 16)),
      left: clampLeft(centerX - BUBBLE_W / 2),
      arrowSide: 'top' as ArrowSide,
      arrowOffset: Math.max(20, Math.min(centerX - clampLeft(centerX - BUBBLE_W / 2), BUBBLE_W - 20)),
    };

    setBubblePos(chosen);
  }, [findElement]);

  useEffect(() => {
    // Delay to allow DOM to settle after tab switch
    const timer = setTimeout(updatePosition, 350);
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [updatePosition]);

  // Scroll target into view if needed
  useEffect(() => {
    const el = findElement();
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      // Re-calc after scroll
      setTimeout(updatePosition, 400);
    }
  }, [findElement, updatePosition]);

  const renderBubbleContent = () => (
    <>
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
      <p className="text-muted-foreground text-xs leading-relaxed mb-3 pl-[42px]">{description}</p>

      {/* Footer */}
      <div className="pl-[42px] space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex gap-1 shrink-0 min-w-0">
            {Array.from({ length: totalSteps }).map((_, i) => (
              <div
                key={i}
                className={`w-1.5 h-1.5 rounded-full transition-colors ${
                  i < currentStep ? 'bg-primary' : 'bg-muted-foreground/25'
                }`}
              />
            ))}
          </div>
          <Button variant="ghost" size="sm" onClick={onDismiss} className="text-xs h-7 px-2 text-muted-foreground shrink-0">
            {t('onboarding.skip')}
          </Button>
        </div>
        <div className="flex items-center justify-end gap-1 flex-wrap">
          {!isFirst && (
            <Button variant="outline" size="sm" onClick={onPrev} className="h-7 px-2 text-xs gap-0.5 shrink-0">
              <ChevronLeft className="w-3 h-3" />
              {t('onboarding.previous')}
            </Button>
          )}
          <Button variant="default" size="sm" onClick={onNext} className="h-7 px-3 text-xs gap-0.5 shrink-0">
            {isLast ? t('onboarding.finish') : t('onboarding.next')}
            {!isLast && <ChevronRight className="w-3 h-3" />}
          </Button>
        </div>
      </div>
    </>
  );

  if (isSuppressed) return null;

  // Fallback floating bubble when element not found
  if (!targetRect || !bubblePos) {
    return (
      <motion.div
        className="fixed bottom-20 right-4 z-[14000]"
        style={{ maxWidth: Math.min(340, window.innerWidth - 24), width: 'min(90vw, 340px)' }}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="bg-background border border-border rounded-xl shadow-2xl p-4">
          {renderBubbleContent()}
        </div>
      </motion.div>
    );
  }

  const arrowSize = 8;

  return (
    <>
      {/* Pulsing highlight ring around target */}
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
          animate={{ boxShadow: ['0 0 0 0 hsl(var(--primary) / 0.45)', '0 0 0 8px hsl(var(--primary) / 0)'] }}
          transition={{ duration: 1.25, repeat: Infinity }}
        />
      </motion.div>

      {/* Speech bubble positioned next to target */}
      <AnimatePresence mode="wait">
        <motion.div
          ref={bubbleRef}
          key={`step-${currentStep}`}
          className="fixed z-[14000]"
          style={{
            top: bubblePos.top,
            left: bubblePos.left,
            width: Math.min(340, window.innerWidth - 24),
          }}
          initial={{ opacity: 0, scale: 0.92 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.92 }}
          transition={{ type: 'spring', stiffness: 350, damping: 28 }}
        >
          <div className="bg-background border border-border rounded-xl shadow-2xl p-4 relative overflow-visible">
            {/* Arrow pointing to target */}
            {bubblePos.arrowSide === 'top' && (
              <div
                className="absolute w-0 h-0"
                style={{
                  top: -arrowSize,
                  left: bubblePos.arrowOffset - arrowSize,
                  borderLeft: `${arrowSize}px solid transparent`,
                  borderRight: `${arrowSize}px solid transparent`,
                  borderBottom: `${arrowSize}px solid hsl(var(--border))`,
                }}
              />
            )}
            {bubblePos.arrowSide === 'top' && (
              <div
                className="absolute w-0 h-0"
                style={{
                  top: -arrowSize + 1,
                  left: bubblePos.arrowOffset - arrowSize,
                  borderLeft: `${arrowSize}px solid transparent`,
                  borderRight: `${arrowSize}px solid transparent`,
                  borderBottom: `${arrowSize}px solid hsl(var(--background))`,
                }}
              />
            )}
            {bubblePos.arrowSide === 'bottom' && (
              <div
                className="absolute w-0 h-0"
                style={{
                  bottom: -arrowSize,
                  left: bubblePos.arrowOffset - arrowSize,
                  borderLeft: `${arrowSize}px solid transparent`,
                  borderRight: `${arrowSize}px solid transparent`,
                  borderTop: `${arrowSize}px solid hsl(var(--border))`,
                }}
              />
            )}
            {bubblePos.arrowSide === 'bottom' && (
              <div
                className="absolute w-0 h-0"
                style={{
                  bottom: -arrowSize + 1,
                  left: bubblePos.arrowOffset - arrowSize,
                  borderLeft: `${arrowSize}px solid transparent`,
                  borderRight: `${arrowSize}px solid transparent`,
                  borderTop: `${arrowSize}px solid hsl(var(--background))`,
                }}
              />
            )}
            {bubblePos.arrowSide === 'left' && (
              <div
                className="absolute w-0 h-0"
                style={{
                  left: -arrowSize,
                  top: bubblePos.arrowOffset - arrowSize,
                  borderTop: `${arrowSize}px solid transparent`,
                  borderBottom: `${arrowSize}px solid transparent`,
                  borderRight: `${arrowSize}px solid hsl(var(--border))`,
                }}
              />
            )}
            {bubblePos.arrowSide === 'left' && (
              <div
                className="absolute w-0 h-0"
                style={{
                  left: -arrowSize + 1,
                  top: bubblePos.arrowOffset - arrowSize,
                  borderTop: `${arrowSize}px solid transparent`,
                  borderBottom: `${arrowSize}px solid transparent`,
                  borderRight: `${arrowSize}px solid hsl(var(--background))`,
                }}
              />
            )}
            {bubblePos.arrowSide === 'right' && (
              <div
                className="absolute w-0 h-0"
                style={{
                  right: -arrowSize,
                  top: bubblePos.arrowOffset - arrowSize,
                  borderTop: `${arrowSize}px solid transparent`,
                  borderBottom: `${arrowSize}px solid transparent`,
                  borderLeft: `${arrowSize}px solid hsl(var(--border))`,
                }}
              />
            )}
            {bubblePos.arrowSide === 'right' && (
              <div
                className="absolute w-0 h-0"
                style={{
                  right: -arrowSize + 1,
                  top: bubblePos.arrowOffset - arrowSize,
                  borderTop: `${arrowSize}px solid transparent`,
                  borderBottom: `${arrowSize}px solid transparent`,
                  borderLeft: `${arrowSize}px solid hsl(var(--background))`,
                }}
              />
            )}

            {renderBubbleContent()}
          </div>
        </motion.div>
      </AnimatePresence>
    </>
  );
};
