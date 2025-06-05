
"use client"

import { useState, useEffect } from "react"
import { ThemeProvider as NextThemesProvider } from "next-themes"
import type { ThemeProviderProps as NextThemeProviderProps } from "next-themes"

type ThemeProviderProps = {
  children: React.ReactNode;
  defaultTheme?: string;
  storageKey?: string;
  enableSystem?: boolean;
  enableColorScheme?: boolean;
  disableTransitionOnChange?: boolean;
  forcedTheme?: string;
  attribute?: NextThemeProviderProps['attribute'];
}

export function ThemeProvider({ 
  children, 
  defaultTheme = "system", 
  storageKey = "vite-ui-theme", 
  forcedTheme,
  enableSystem = true,
  enableColorScheme = true,
  ...props 
}: ThemeProviderProps) {
  // Use the directly imported useState hook
  const [themeInitialized, setThemeInitialized] = useState(false);

  // Force immediate theme application to prevent flicker
  useEffect(() => {
    // Get user preference first from localStorage or system
    const storedTheme = localStorage.getItem(storageKey);
    
    // Determine the initial theme
    let initialTheme: string;
    
    if (forcedTheme) {
      // If theme is forced, use that
      initialTheme = forcedTheme;
    } else if (storedTheme) {
      // If we have a stored theme, use that
      initialTheme = storedTheme;
    } else if (enableSystem) {
      // If system mode is enabled and no stored theme, check system preference
      initialTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    } else {
      // Fallback to default theme
      initialTheme = defaultTheme;
    }
    
    // Apply theme class immediately to prevent flash
    document.documentElement.classList.toggle('dark', initialTheme === 'dark');
    
    // Set a data attribute to track the current theme
    document.documentElement.setAttribute('data-theme', initialTheme);
    
    // Broadcast initial theme for components to react
    const event = new CustomEvent('themeInit', { 
      detail: { theme: initialTheme, initialLoad: true } 
    });
    document.dispatchEvent(event);
    
    // Save the theme to localStorage
    localStorage.setItem(storageKey, initialTheme);
    
    // Mark theme as initialized
    setThemeInitialized(true);
    
    console.log("[ThemeProvider] Initialized with theme:", initialTheme);
  }, [storageKey, defaultTheme, forcedTheme, enableSystem]);

  // Handle theme changes from other tabs or windows
  useEffect(() => {
    if (!themeInitialized) return;

    const handleStorage = (e: StorageEvent) => {
      if (e.key === storageKey && e.newValue) {
        // Sync theme if storage was changed in another tab/window
        const newTheme = e.newValue;
        console.log("[ThemeProvider] Theme changed in another window:", newTheme);
        
        // Apply the theme change immediately
        document.documentElement.classList.toggle('dark', newTheme === 'dark');
        document.documentElement.setAttribute('data-theme', newTheme);
        
        // Notify components of theme change
        const event = new CustomEvent('themeChanged', { detail: { theme: newTheme } });
        document.dispatchEvent(event);
      }
    };
    
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, [storageKey, themeInitialized]);

  return (
    <NextThemesProvider 
      attribute="class" 
      defaultTheme={defaultTheme}
      storageKey={storageKey}
      forcedTheme={forcedTheme}
      enableSystem={enableSystem}
      enableColorScheme={enableColorScheme}
      {...props}
    >
      {children}
    </NextThemesProvider>
  );
}
