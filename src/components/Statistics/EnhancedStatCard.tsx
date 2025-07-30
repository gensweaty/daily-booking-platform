
import { motion } from "framer-motion";
import { LucideIcon } from "lucide-react";
import { LanguageText } from "@/components/shared/LanguageText";
import { cn } from "@/lib/utils";

interface EnhancedStatCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  description: string;
  valueClassName?: string;
  color?: "purple" | "green" | "orange" | "blue";
  index?: number;
}

export const EnhancedStatCard = ({ 
  title, 
  value, 
  icon: Icon, 
  description, 
  valueClassName,
  color = "purple",
  index = 0
}: EnhancedStatCardProps) => {
  const colorStyles = {
    purple: "from-purple-500/10 to-purple-600/5 border-purple-200/20 text-purple-600",
    green: "from-green-500/10 to-green-600/5 border-green-200/20 text-green-600",
    orange: "from-orange-500/10 to-orange-600/5 border-orange-200/20 text-orange-600",
    blue: "from-blue-500/10 to-blue-600/5 border-blue-200/20 text-blue-600",
  };

  const isCurrencyValue = typeof value === 'string' && /^[₾$€£¥]/.test(value);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ 
        duration: 0.4, 
        delay: index * 0.1,
        ease: "easeOut"
      }}
      whileHover={{ 
        scale: 1.02,
        transition: { duration: 0.2 }
      }}
      className={cn(
        "relative overflow-hidden rounded-xl border backdrop-blur-sm",
        "bg-gradient-to-br",
        colorStyles[color],
        "transition-all duration-300"
      )}
    >
      {/* Subtle glow effect */}
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent opacity-0 hover:opacity-100 transition-opacity duration-300" />
      
      <div className="relative p-6">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-3">
            <div className={cn(
              "p-2 rounded-lg bg-gradient-to-br",
              colorStyles[color].replace('text-', 'from-').replace('-600', '-500/20').replace('to-', 'to-').replace('/5', '/10')
            )}>
              <Icon className={cn("w-5 h-5", colorStyles[color].split(' ')[2])} />
            </div>
            <h3 className="text-sm font-medium text-muted-foreground">
              <LanguageText>{title}</LanguageText>
            </h3>
          </div>
        </div>
        
        <div className={cn("text-2xl font-bold mb-2", valueClassName)}>
          {isCurrencyValue ? (
            <span className="text-foreground">{value}</span>
          ) : (
            <LanguageText withFont={typeof value === 'string'}>{value}</LanguageText>
          )}
        </div>
        
        <p className="text-xs text-muted-foreground">
          <LanguageText>{description}</LanguageText>
        </p>
      </div>
    </motion.div>
  );
};
