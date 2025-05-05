
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "next-themes";
import { useLanguage } from "@/contexts/LanguageContext";
import { useEffect, useState } from "react";

export function ThemeToggle() {
  const { theme, resolvedTheme, setTheme } = useTheme();
  const { t } = useLanguage();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const toggleTheme = () => {
    const newTheme = (resolvedTheme || theme) === "dark" ? "light" : "dark";
    setTheme(newTheme);
    
    // Immediately apply the theme class to prevent delay in visual feedback
    document.documentElement.classList.toggle('dark', newTheme === 'dark');
    
    // Set data attribute for theme
    document.documentElement.setAttribute('data-theme', newTheme);
    
    // Dispatch an event for components to react immediately
    const event = new CustomEvent('themeChanged', { detail: { theme: newTheme } });
    document.dispatchEvent(event);
    
    console.log("[ThemeToggle] Theme toggled to:", newTheme);
  };

  // Make sure we handle theme properly after mounting
  useEffect(() => {
    if (!mounted) return;
    
    // Check if theme is already initialized
    const currentTheme = resolvedTheme || theme;
    if (currentTheme) {
      console.log("[ThemeToggle] Theme initialized:", currentTheme);
      
      // Verify the HTML class matches the theme
      const isDarkMode = currentTheme === 'dark';
      const hasDarkClass = document.documentElement.classList.contains('dark');
      
      // Force correct class if there's a mismatch
      if (isDarkMode !== hasDarkClass) {
        console.log("[ThemeToggle] Fixing theme class mismatch");
        document.documentElement.classList.toggle('dark', isDarkMode);
        document.documentElement.setAttribute('data-theme', currentTheme);
      }
      
      // Make sure the theme is properly set in localStorage
      const storedTheme = localStorage.getItem('vite-ui-theme');
      if (storedTheme !== currentTheme) {
        localStorage.setItem('vite-ui-theme', currentTheme);
      }
      
      // Dispatch a custom event that components can listen for to force rerender
      const event = new CustomEvent('themeChanged', { detail: { theme: currentTheme } });
      document.dispatchEvent(event);
    }
  }, [theme, resolvedTheme, mounted]);

  // Determine current theme accounting for potential uninitialized state
  const currentTheme = mounted ? resolvedTheme || theme || 
    (typeof document !== 'undefined' && document.documentElement.classList.contains('dark') ? 'dark' : 'light') : 'light';

  if (!mounted) {
    return (
      <Button
        variant="outline"
        size="icon"
        className="h-9 w-9"
        aria-label="Theme toggle"
      >
        <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
        <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
        <span className="sr-only">Toggle theme</span>
      </Button>
    );
  }

  return (
    <Button
      variant="outline"
      size="icon"
      onClick={toggleTheme}
      className="h-9 w-9"
      aria-label={t(currentTheme === "dark" ? "dashboard.lightMode" : "dashboard.darkMode")}
    >
      <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
      <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
      <span className="sr-only">
        {t(currentTheme === "dark" ? "dashboard.lightMode" : "dashboard.darkMode")}
      </span>
    </Button>
  );
}
