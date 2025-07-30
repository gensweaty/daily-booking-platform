
import { Button } from "@/components/ui/button";
import { Bell, Settings, LogOut, Menu } from "lucide-react";
import { ProfileButton } from "./ProfileButton";
import { LanguageSwitcher } from "../LanguageSwitcher";
import { ThemeToggle } from "../ThemeToggle";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { LanguageText } from "../shared/LanguageText";
import { GeorgianAuthText } from "../shared/GeorgianAuthText";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

export const EnhancedDashboardHeader = () => {
  const { user, signOut } = useAuth();
  const { language } = useLanguage();
  const isGeorgian = language === 'ka';

  return (
    <motion.header 
      className={cn(
        "sticky top-0 z-40 w-full",
        "backdrop-blur-md bg-background/80 border-b border-border/50",
        "supports-[backdrop-filter]:bg-background/60"
      )}
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div className="container mx-auto px-4 py-3">
        <div className="flex items-center justify-between">
          {/* Logo Section */}
          <motion.div 
            className="flex items-center space-x-3"
            whileHover={{ scale: 1.02 }}
            transition={{ type: "spring", stiffness: 400, damping: 25 }}
          >
            <div className="w-8 h-8 bg-gradient-to-br from-primary to-primary/70 rounded-lg flex items-center justify-center shadow-sm">
              <span className="text-primary-foreground font-bold text-sm">D</span>
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">
                {isGeorgian ? (
                  <GeorgianAuthText>Dashboard</GeorgianAuthText>
                ) : (
                  <LanguageText>Dashboard</LanguageText>
                )}
              </h1>
            </div>
          </motion.div>

          {/* Actions Section */}
          <div className="flex items-center space-x-2">
            <motion.div
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <LanguageSwitcher />
            </motion.div>
            
            <motion.div
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <ThemeToggle />
            </motion.div>

            <motion.div
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <ProfileButton />
            </motion.div>
          </div>
        </div>
      </div>
    </motion.header>
  );
};
