
import { Button } from "@/components/ui/button";
import { PlusCircle } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { Task } from "@/lib/types";
import { LanguageText } from "@/components/shared/LanguageText";
import { GeorgianAuthText } from "@/components/shared/GeorgianAuthText";
import { motion } from "framer-motion";

interface TaskFormHeaderProps {
  onAddTask?: () => void;
  editingTask?: Task | null;
}

export const TaskFormHeader = ({ onAddTask, editingTask }: TaskFormHeaderProps) => {
  const { t, language } = useLanguage();
  const isGeorgian = language === 'ka';
  
  return (
    <div className="flex items-center justify-between mb-6">
      <motion.h2 
        className={`text-xl font-bold bg-gradient-to-r from-foreground via-foreground/90 to-foreground/70 bg-clip-text text-transparent hover:from-primary hover:via-primary/90 hover:to-primary/70 transition-all duration-300 cursor-default ${isGeorgian ? 'font-georgian' : ''}`}
        whileHover={{ scale: 1.02 }}
        transition={{ duration: 0.2 }}
      >
        {isGeorgian ? (
          <GeorgianAuthText fontWeight="bold">
            <LanguageText>{editingTask ? t("tasks.editTask") : t("tasks.addTask")}</LanguageText>
          </GeorgianAuthText>
        ) : (
          <LanguageText>{editingTask ? t("tasks.editTask") : t("tasks.addTask")}</LanguageText>
        )}
      </motion.h2>
      
      {onAddTask && (
        <motion.div 
          whileHover={{ scale: 1.05 }} 
          whileTap={{ scale: 0.95 }}
          transition={{ duration: 0.1 }}
        >
          <Button 
            onClick={onAddTask} 
            className="bg-primary hover:bg-primary/90 text-white flex items-center shadow-md hover:shadow-lg transition-all duration-200"
          >
            <motion.div
              whileHover={{ rotate: 90 }}
              transition={{ duration: 0.2 }}
            >
              <PlusCircle className="mr-1 h-4 w-4" />
            </motion.div>
            {isGeorgian ? (
              <GeorgianAuthText fontWeight="bold">
                <LanguageText>{t("tasks.addTask")}</LanguageText>
              </GeorgianAuthText>
            ) : (
              <LanguageText>{t("tasks.addTask")}</LanguageText>
            )}
          </Button>
        </motion.div>
      )}
    </div>
  );
};
