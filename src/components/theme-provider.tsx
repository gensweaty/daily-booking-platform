
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
  ...props 
}: ThemeProviderProps) {
  // Force immediate theme application to prevent flicker
  React.useEffect(() => {
    const savedTheme = localStorage.getItem(storageKey);
    if (savedTheme) {
      document.documentElement.classList.toggle('dark', savedTheme === 'dark');
    } else if (defaultTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else if (defaultTheme === 'system') {
      const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      document.documentElement.classList.toggle('dark', systemPrefersDark);
    }
  }, [storageKey, defaultTheme]);

  return (
    <NextThemesProvider 
      attribute="class" 
      defaultTheme={defaultTheme} 
      storageKey={storageKey} 
      enableSystem
      enableColorScheme
      {...props}
    >
      {children}
    </NextThemesProvider>
  );
}
