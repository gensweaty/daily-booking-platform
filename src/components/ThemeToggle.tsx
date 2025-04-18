
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "next-themes";
import { useLanguage } from "@/contexts/LanguageContext";
import { useEffect } from "react";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const { t } = useLanguage();

  const toggleTheme = () => {
    const newTheme = theme === "dark" ? "light" : "dark";
    setTheme(newTheme);
    
    // Immediately apply the theme class to prevent delay in visual feedback
    document.documentElement.classList.toggle('dark', newTheme === 'dark');
  };

  // Force calendar to update when theme changes
  useEffect(() => {
    // Dispatch a custom event that components can listen for to force rerender
    const event = new CustomEvent('themeChanged', { detail: { theme } });
    document.dispatchEvent(event);
  }, [theme]);

  return (
    <Button
      variant="outline"
      size="icon"
      onClick={toggleTheme}
      className="h-9 w-9"
      aria-label={t(theme === "dark" ? "dashboard.lightMode" : "dashboard.darkMode")}
    >
      <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
      <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
      <span className="sr-only">
        {t(theme === "dark" ? "dashboard.lightMode" : "dashboard.darkMode")}
      </span>
    </Button>
  );
}
