
"use client"

import * as React from "react"
import { ThemeProvider as NextThemesProvider } from "next-themes"
import type { ThemeProviderProps as NextThemeProviderProps } from "next-themes"
import { useLocation } from "react-router-dom"

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
  const location = useLocation();
  const isExternalPage = location.pathname.startsWith('/business/');
  
  // Force light theme for external business pages
  const effectiveDefaultTheme = isExternalPage ? "light" : defaultTheme;
  const effectiveStorageKey = isExternalPage ? "external-theme" : storageKey;

  // Force immediate theme application to prevent flicker
  React.useEffect(() => {
    if (isExternalPage) {
      // Force light mode for external pages
      document.documentElement.classList.remove('dark');
    } else {
      const savedTheme = localStorage.getItem(storageKey);
      if (savedTheme) {
        document.documentElement.classList.toggle('dark', savedTheme === 'dark');
      } else if (defaultTheme === 'dark') {
        document.documentElement.classList.add('dark');
      } else if (defaultTheme === 'system') {
        const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        document.documentElement.classList.toggle('dark', systemPrefersDark);
      }
    }
  }, [storageKey, defaultTheme, isExternalPage]);

  return (
    <NextThemesProvider 
      attribute="class" 
      defaultTheme={effectiveDefaultTheme}
      storageKey={effectiveStorageKey}
      forcedTheme={isExternalPage ? "light" : undefined}
      enableSystem={!isExternalPage}
      enableColorScheme={!isExternalPage}
      {...props}
    >
      {children}
    </NextThemesProvider>
  );
}
