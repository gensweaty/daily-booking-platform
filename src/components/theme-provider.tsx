
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
    
    // Broadcast initial theme for components to react
    const event = new CustomEvent('themeInit', { detail: { theme: initialTheme } });
    document.dispatchEvent(event);
  }, [storageKey, defaultTheme, forcedTheme, enableSystem]);

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
