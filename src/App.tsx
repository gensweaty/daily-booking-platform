
import { BrowserRouter, Route, Routes, useLocation } from "react-router-dom";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/toaster";
import { AuthProvider } from "@/contexts/AuthContext";
import Index from "@/pages/Index";
import Landing from "@/pages/Landing";
import Legal from "@/pages/Legal";
import Contact from "@/pages/Contact";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ResetPassword } from "@/components/ResetPassword";
import { PublicBusinessPage } from "@/components/business/PublicBusinessPage";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { ForgotPassword } from "@/components/ForgotPassword";
import { useEffect } from "react";

// Create a client for React Query with improved retry logic
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 3,
      retryDelay: attempt => Math.min(attempt > 1 ? 2000 : 1000, 30000),
      staleTime: 30000 // Consider data fresh for 30 seconds
    }
  }
});

// Helper for session recovery
const SessionRecoveryWrapper = ({ children }: { children: React.ReactNode }) => {
  useEffect(() => {
    // Add listener for online/offline events
    const handleOnline = () => {
      console.log("Network is online - refreshing session");
      // Force a refresh of all queries when coming back online
      queryClient.invalidateQueries();
    };
    
    window.addEventListener('online', handleOnline);
    
    // Check if this is a page reload
    if (performance.navigation.type === 1) {
      console.log("Page was reloaded - refreshing data");
      queryClient.invalidateQueries();
    }
    
    return () => {
      window.removeEventListener('online', handleOnline);
    };
  }, []);
  
  return <>{children}</>;
};

// Route-aware theme wrapper component
const RouteAwareThemeProvider = ({ children }: { children: React.ReactNode }) => {
  const location = useLocation();
  const isExternalPage = location.pathname.startsWith('/business/');
  
  useEffect(() => {
    // Initialize theme based on stored preference or system preference
    const storedTheme = localStorage.getItem('vite-ui-theme');
    if (storedTheme) {
      document.documentElement.classList.toggle('dark', storedTheme === 'dark');
      // Dispatch theme init event for components to react
      const event = new CustomEvent('themeInit', { detail: { theme: storedTheme } });
      document.dispatchEvent(event);
    } else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      document.documentElement.classList.add('dark');
      // Dispatch theme init event for components to react
      const event = new CustomEvent('themeInit', { detail: { theme: 'dark' } });
      document.dispatchEvent(event);
    }
  }, []);
  
  return (
    <ThemeProvider 
      defaultTheme="system" 
      storageKey="vite-ui-theme"
      forcedTheme={isExternalPage ? "light" : undefined}
      enableSystem={!isExternalPage}
      enableColorScheme={!isExternalPage}
    >
      {children}
    </ThemeProvider>
  );
};

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <RouteAwareThemeProvider>
          <AuthProvider>
            <LanguageProvider>
              <SessionRecoveryWrapper>
                <Routes>
                  <Route path="/" element={<Landing />} />
                  <Route path="/dashboard" element={<Index />} />
                  <Route path="/dashboard/*" element={<Index />} />
                  <Route path="/legal" element={<Legal />} />
                  <Route path="/contact" element={<Contact />} />
                  <Route path="/reset-password" element={<ResetPassword />} />
                  <Route path="/forgot-password" element={<ForgotPassword />} />
                  <Route path="/business/:slug" element={<PublicBusinessPage />} />
                  <Route path="/business" element={<PublicBusinessPage />} />
                  <Route path="/login" element={<Index />} />
                  <Route path="/signup" element={<Index />} />
                  <Route path="*" element={<Landing />} />
                </Routes>
                <Toaster />
              </SessionRecoveryWrapper>
            </LanguageProvider>
          </AuthProvider>
        </RouteAwareThemeProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
