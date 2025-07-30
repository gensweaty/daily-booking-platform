
import { motion } from "framer-motion";
import { LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface TabTriggerProps {
  value: string;
  icon: LucideIcon;
  label: React.ReactNode;
  isActive: boolean;
  onClick: (value: string) => void;
  badge?: number;
}

export const EnhancedTabTrigger = ({ 
  value, 
  icon: Icon, 
  label, 
  isActive, 
  onClick,
  badge 
}: TabTriggerProps) => {
  return (
    <motion.button
      onClick={() => onClick(value)}
      className={cn(
        "relative flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200",
        "hover:bg-muted/80 hover:scale-[1.02] active:scale-[0.98]",
        isActive 
          ? "bg-primary text-primary-foreground shadow-sm" 
          : "text-muted-foreground hover:text-foreground"
      )}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
    >
      <motion.div
        animate={{ rotate: isActive ? 15 : 0 }}
        transition={{ duration: 0.2 }}
      >
        <Icon className="w-4 h-4" />
      </motion.div>
      
      <span className="hidden sm:inline">{label}</span>
      
      {badge && badge > 0 && (
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="absolute -top-1 -right-1"
        >
          <Badge 
            variant="destructive" 
            className="h-5 min-w-5 p-1 text-xs bg-orange-500 hover:bg-orange-600"
          >
            {badge}
          </Badge>
        </motion.div>
      )}
      
      {/* Active indicator */}
      {isActive && (
        <motion.div
          layoutId="activeTab"
          className="absolute inset-0 bg-primary/10 rounded-lg -z-10"
          initial={false}
          transition={{ type: "spring", stiffness: 500, damping: 30 }}
        />
      )}
    </motion.button>
  );
};
