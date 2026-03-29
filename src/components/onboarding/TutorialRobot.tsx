import { useState, useEffect, useCallback, useRef, useLayoutEffect } from 'react';
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

type Placement = 'top' | 'bottom' | 'left' | 'right';

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
  const [placement, setPlacement] = useState<Placement>('bottom');
  const [isSuppressed, setIsSuppressed] = useState(false);
  const bubbleRef = useRef<HTMLDivElement>(null);
  const [bubbleSize, setBubbleSize] = useState({ w: 320, h: 200 });

  // Suppression logic
  useEffect(() => {
    if (!suppressWhenSelector) { setIsSuppressed(false); return; }
    const check = () => {
      try { setIsSuppressed(Boolean(document.querySelector(suppressWhenSelector))); } catch { setIsSuppressed(false); }
    };
    check();
    const iv = setInterval(check, 200);
    const obs = new MutationObserver(check);
    obs.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-state'] });
    return () => { clearInterval(iv); obs.disconnect(); };
  }, [suppressWhenSelector]);

  const findElement = useCallback(() => {
    for (const sel of selector.split(',').map(s => s.trim())) {
      try { const el = document.querySelector(sel); if (el) return el as HTMLElement; } catch {}
    }
    return null;
  }, [selector]);

  const updatePosition = useCallback(() => {
    const el = findElement();
    if (!el) {
      setTargetRect((prev) => (prev ? null : prev));
      return;
    }

    const rect = el.getBoundingClientRect();
    setTargetRect((prev) => {
      if (
        prev &&
        Math.abs(prev.top - rect.top) < 0.5 &&
        Math.abs(prev.left - rect.left) < 0.5 &&
        Math.abs(prev.width - rect.width) < 0.5 &&
        Math.abs(prev.height - rect.height) < 0.5
      ) {
        return prev;
      }
      return rect;
    });

    const vW = window.innerWidth;
    const vH = window.innerHeight;
    const bW = bubbleSize.w;
    const bH = bubbleSize.h;
    const GAP = 14;

    const spaceBelow = vH - rect.bottom - GAP;
    const spaceAbove = rect.top - GAP;
    const spaceRight = vW - rect.right - GAP;
    const spaceLeft = rect.left - GAP;

    let nextPlacement: Placement = 'bottom';
    if (spaceBelow >= bH) nextPlacement = 'bottom';
    else if (spaceAbove >= bH) nextPlacement = 'top';
    else if (spaceRight >= bW) nextPlacement = 'right';
    else if (spaceLeft >= bW) nextPlacement = 'left';

    setPlacement((prev) => (prev === nextPlacement ? prev : nextPlacement));
  }, [findElement, bubbleSize.h, bubbleSize.w]);

  // Measure bubble size only when it meaningfully changes
  useLayoutEffect(() => {
    if (!bubbleRef.current) return;
    const r = bubbleRef.current.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0) return;

    const nextW = Math.round(r.width);
    const nextH = Math.round(r.height);
    setBubbleSize((prev) => (prev.w === nextW && prev.h === nextH ? prev : { w: nextW, h: nextH }));
  }, [currentStep, title, description, placement, targetRect]);

  const hasAutoScrolledRef = useRef(false);

  useEffect(() => {
    hasAutoScrolledRef.current = false;
  }, [selector, currentStep]);

  useEffect(() => {
    const el = findElement();
    if (!el || hasAutoScrolledRef.current) return;

    hasAutoScrolledRef.current = true;
    el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
    const id = window.setTimeout(updatePosition, 220);

    return () => clearTimeout(id);
  }, [findElement, updatePosition, currentStep]);

  useEffect(() => {
    const timers = [120, 320, 620].map((d) => setTimeout(updatePosition, d));
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      timers.forEach(clearTimeout);
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [updatePosition]);

  if (isSuppressed) return null;

  // Calculate bubble position
  const getBubbleStyle = (): React.CSSProperties => {
    if (!targetRect) {
      return { position: 'fixed', bottom: 80, right: 16, zIndex: 14000, maxWidth: 'min(90vw, 340px)' };
    }

    const GAP = 14;
    const vW = window.innerWidth;
    const vH = window.innerHeight;

    let top: number | undefined;
    let left: number | undefined;

    const centerX = targetRect.left + targetRect.width / 2;
    const centerY = targetRect.top + targetRect.height / 2;

    switch (placement) {
      case 'bottom':
        top = targetRect.bottom + GAP;
        left = Math.max(8, Math.min(centerX - bubbleSize.w / 2, vW - bubbleSize.w - 8));
        break;
      case 'top':
        top = targetRect.top - GAP - bubbleSize.h;
        left = Math.max(8, Math.min(centerX - bubbleSize.w / 2, vW - bubbleSize.w - 8));
        break;
      case 'right':
        top = Math.max(8, Math.min(centerY - bubbleSize.h / 2, vH - bubbleSize.h - 8));
        left = targetRect.right + GAP;
        break;
      case 'left':
        top = Math.max(8, Math.min(centerY - bubbleSize.h / 2, vH - bubbleSize.h - 8));
        left = targetRect.left - GAP - bubbleSize.w;
        break;
    }

    // Clamp to viewport
    top = Math.max(8, Math.min(top!, vH - bubbleSize.h - 8));
    left = Math.max(8, Math.min(left!, vW - bubbleSize.w - 8));

    return { position: 'fixed', top, left, zIndex: 14000, maxWidth: 'min(90vw, 340px)', width: 340 };
  };

  // Arrow styles
  const getArrowStyle = (): React.CSSProperties | null => {
    if (!targetRect) return null;
    const size = 8;
    const centerX = targetRect.left + targetRect.width / 2;
    const centerY = targetRect.top + targetRect.height / 2;
    const style = getBubbleStyle();
    const bubbleLeft = (style.left as number) || 0;
    const bubbleTop = (style.top as number) || 0;

    switch (placement) {
      case 'bottom': {
        const offset = Math.max(16, Math.min(centerX - bubbleLeft, bubbleSize.w - 16));
        return {
          position: 'absolute', top: -size, left: offset - size,
          width: 0, height: 0,
          borderLeft: `${size}px solid transparent`,
          borderRight: `${size}px solid transparent`,
          borderBottom: `${size}px solid hsl(var(--border))`,
        };
      }
      case 'top': {
        const offset = Math.max(16, Math.min(centerX - bubbleLeft, bubbleSize.w - 16));
        return {
          position: 'absolute', bottom: -size, left: offset - size,
          width: 0, height: 0,
          borderLeft: `${size}px solid transparent`,
          borderRight: `${size}px solid transparent`,
          borderTop: `${size}px solid hsl(var(--border))`,
        };
      }
      case 'right': {
        const offset = Math.max(16, Math.min(centerY - bubbleTop, bubbleSize.h - 16));
        return {
          position: 'absolute', left: -size, top: offset - size,
          width: 0, height: 0,
          borderTop: `${size}px solid transparent`,
          borderBottom: `${size}px solid transparent`,
          borderRight: `${size}px solid hsl(var(--border))`,
        };
      }
      case 'left': {
        const offset = Math.max(16, Math.min(centerY - bubbleTop, bubbleSize.h - 16));
        return {
          position: 'absolute', right: -size, top: offset - size,
          width: 0, height: 0,
          borderTop: `${size}px solid transparent`,
          borderBottom: `${size}px solid transparent`,
          borderLeft: `${size}px solid hsl(var(--border))`,
        };
      }
    }
  };

  const arrowStyle = getArrowStyle();

  return (
    <>
      {/* Highlight ring around target */}
      {targetRect && (
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
            animate={{ boxShadow: ['0 0 0 0 hsl(var(--primary) / 0.4)', '0 0 0 6px hsl(var(--primary) / 0)'] }}
            transition={{ duration: 1.2, repeat: Infinity }}
          />
        </motion.div>
      )}

      {/* Bubble */}
      <AnimatePresence mode="wait">
        <motion.div
          ref={bubbleRef}
          key={`step-${currentStep}`}
          style={getBubbleStyle() as any}
          initial={{ opacity: 0, scale: 0.92 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.92 }}
          transition={{ type: 'spring', stiffness: 350, damping: 28 }}
        >
          <div className="bg-background border border-border rounded-xl shadow-2xl p-3.5 relative overflow-hidden">
            {/* Arrow */}
            {arrowStyle && <div style={arrowStyle} />}

            {/* Header */}
            <div className="flex items-start gap-2 mb-2">
              <motion.div
                className="w-7 h-7 rounded-full bg-primary flex items-center justify-center shrink-0"
                animate={{ y: [0, -2, 0] }}
                transition={{ duration: 1.5, repeat: Infinity }}
              >
                <Bot className="w-3.5 h-3.5 text-primary-foreground" />
              </motion.div>
              <div className="flex-1 min-w-0">
                <h4 className="font-semibold text-foreground text-sm leading-snug">{title}</h4>
              </div>
              <button onClick={onDismiss} className="text-muted-foreground hover:text-foreground p-0.5 shrink-0">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Description */}
            <p className="text-muted-foreground text-xs leading-relaxed mb-3 ml-9">{description}</p>

            {/* Footer - fully contained */}
            <div className="ml-9 flex flex-col gap-2">
              {/* Progress dots */}
              <div className="flex items-center gap-0.5 flex-wrap">
                {Array.from({ length: totalSteps }).map((_, i) => (
                  <div
                    key={i}
                    className={`w-1.5 h-1.5 rounded-full ${i < currentStep ? 'bg-primary' : 'bg-muted-foreground/25'}`}
                  />
                ))}
                <span className="text-[10px] text-muted-foreground ml-1">{currentStep}/{totalSteps}</span>
              </div>

              {/* Navigation buttons - all inside the box */}
              <div className="flex items-center justify-between gap-1.5">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onDismiss}
                  className="text-[11px] h-7 px-2 text-muted-foreground"
                >
                  {t('onboarding.skip')}
                </Button>
                <div className="flex gap-1">
                  {!isFirst && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={onPrev}
                      className="h-7 px-2 text-[11px] gap-0.5"
                    >
                      <ChevronLeft className="w-3 h-3" />
                      {t('onboarding.previous')}
                    </Button>
                  )}
                  <Button
                    variant="default"
                    size="sm"
                    onClick={onNext}
                    className="h-7 px-3 text-[11px] gap-0.5"
                  >
                    {isLast ? t('onboarding.finish') : t('onboarding.next')}
                    {!isLast && <ChevronRight className="w-3 h-3" />}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    </>
  );
};
