
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
    if (forcedTheme === "light") {
      // Force light mode
      document.documentElement.classList.remove('dark');
    } else {
      const savedTheme = localStorage.getItem(storageKey);
      if (savedTheme) {
        document.documentElement.classList.toggle('dark', savedTheme === 'dark');
      } else if (defaultTheme === 'dark') {
        document.documentElement.classList.add('dark');
      } else if (defaultTheme === 'system' && enableSystem) {
        const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        document.documentElement.classList.toggle('dark', systemPrefersDark);
      }
    }
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
