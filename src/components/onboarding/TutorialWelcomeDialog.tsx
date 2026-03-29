
import { motion, AnimatePresence } from 'framer-motion';
import { Bot, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';

interface TutorialWelcomeDialogProps {
  onStart: () => void;
  onSkip: () => void;
}

export const TutorialWelcomeDialog = ({ onStart, onSkip }: TutorialWelcomeDialogProps) => {
  const { t } = useLanguage();

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-[15000] flex items-center justify-center bg-black/60 backdrop-blur-sm"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.3 }}
      >
        <motion.div
          className="bg-background border border-border rounded-2xl p-8 max-w-md w-[90vw] shadow-2xl text-center"
          initial={{ scale: 0.8, opacity: 0, y: 30 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.8, opacity: 0, y: 30 }}
          transition={{ type: 'spring', stiffness: 300, damping: 25, delay: 0.1 }}
        >
          {/* Robot mascot */}
          <motion.div
            className="mx-auto w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mb-5"
            animate={{ y: [0, -6, 0] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
          >
            <Bot className="w-10 h-10 text-primary" />
          </motion.div>

          <div className="flex items-center justify-center gap-2 mb-3">
            <Sparkles className="w-5 h-5 text-primary" />
            <h2 className="text-xl font-bold text-foreground">
              {t('onboarding.welcomeTitle')}
            </h2>
          </div>

          <p className="text-muted-foreground text-sm mb-8 leading-relaxed">
            {t('onboarding.welcomeDescription')}
          </p>

          <div className="flex flex-col gap-3">
            <Button
              variant="purple"
              size="lg"
              onClick={onStart}
              className="w-full"
            >
              {t('onboarding.startTour')}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={onSkip}
              className="text-muted-foreground"
            >
              {t('onboarding.skipTour')}
            </Button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};
