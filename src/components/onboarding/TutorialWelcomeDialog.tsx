
import { motion } from 'framer-motion';
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
    <motion.div
      className="fixed bottom-20 right-4 z-[14000] max-w-xs w-[85vw]"
      initial={{ opacity: 0, y: 20, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 20, scale: 0.9 }}
      transition={{ type: 'spring', stiffness: 300, damping: 25 }}
    >
      {/* Robot character */}
      <motion.div
        className="flex justify-end mb-2 mr-2"
        animate={{ y: [0, -4, 0] }}
        transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
      >
        <div className="w-14 h-14 rounded-full bg-primary flex items-center justify-center shadow-lg border-2 border-primary-foreground/20">
          <Bot className="w-7 h-7 text-primary-foreground" />
        </div>
      </motion.div>

      {/* Speech bubble */}
      <div className="bg-background border border-border rounded-2xl p-5 shadow-xl relative">
        {/* Bubble arrow pointing to robot */}
        <div className="absolute -top-2 right-8 w-4 h-4 bg-background border-l border-t border-border rotate-45" />
        
        <div className="flex items-center gap-2 mb-2">
          <Sparkles className="w-4 h-4 text-primary" />
          <h3 className="text-base font-bold text-foreground">
            {t('onboarding.welcomeTitle')}
          </h3>
        </div>

        <p className="text-muted-foreground text-sm mb-5 leading-relaxed">
          {t('onboarding.welcomeDescription')}
        </p>

        <div className="flex gap-2">
          <Button
            variant="purple"
            size="sm"
            onClick={onStart}
            className="flex-1"
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
      </div>
    </motion.div>
  );
};
