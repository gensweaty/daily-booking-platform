
"use client"

import * as React from "react"
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
  // Force immediate theme application to prevent flicker
  React.useEffect(() => {
    // Get stored theme or use default
    const storedTheme = localStorage.getItem(storageKey);
    let initialTheme = storedTheme;
    
    if (!initialTheme) {
      if (defaultTheme === 'system' && enableSystem) {
        initialTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      } else {
        initialTheme = defaultTheme;
      }
    }
    
    // When theme is forced, use that instead
    if (forcedTheme) {
      initialTheme = forcedTheme;
    }
    
    // Apply theme class immediately to prevent flash
    document.documentElement.classList.toggle('dark', initialTheme === 'dark');
    
    // Set a data attribute to track the current theme
    document.documentElement.setAttribute('data-theme', initialTheme);
    
    // Broadcast initial theme for components to react
    const event = new CustomEvent('themeInit', { detail: { theme: initialTheme } });
    document.dispatchEvent(event);
    
    console.log("[ThemeProvider] Initialized with theme:", initialTheme);
  }, [storageKey, defaultTheme, forcedTheme, enableSystem]);

  // Add another effect to handle transitions between pages
  React.useEffect(() => {
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
  }, [storageKey]);

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
