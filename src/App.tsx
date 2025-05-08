import { BrowserRouter, Route, Routes, useLocation, Navigate } from "react-router-dom";
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
import { TooltipProvider } from "@/components/ui/tooltip";
import { RouteGuard } from "@/components/RouteGuard";

// Add global window property declaration
declare global {
  interface Window {
    __IS_BUSINESS_PAGE__?: boolean;
    __ROUTE_LOCKED__?: boolean;
  }
}

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

// Route-aware theme wrapper component that doesn't use hooks outside of component
const RouteAwareThemeProvider = ({ children }: { children: React.ReactNode }) => {
  return (
    <ThemeProvider 
      defaultTheme="system"
      storageKey="vite-ui-theme"
      enableSystem={true}
      enableColorScheme={true}
    >
      {children}
    </ThemeProvider>
  );
};

// A separate component to handle route awareness
const RouteAwareWrapper = ({ children }: { children: React.ReactNode }) => {
  const location = useLocation();
  const isExternalPage = location.pathname.startsWith('/business/');
  
  useEffect(() => {
    if (isExternalPage) {
      // Set default to light mode but don't force it
      const storedTheme = localStorage.getItem('vite-ui-theme');
      if (!storedTheme) {
        document.documentElement.classList.remove('dark');
        document.documentElement.setAttribute('data-theme', 'light');
        localStorage.setItem('vite-ui-theme', 'light');
        console.log("[InitTheme] Setting default theme to LIGHT for external business page.");
      }
    }
    
    // Apply the stored theme or system preference, regardless of page
    const storedTheme = localStorage.getItem('vite-ui-theme');
    if (storedTheme) {
      document.documentElement.classList.toggle('dark', storedTheme === 'dark');
      document.documentElement.setAttribute('data-theme', storedTheme);
      console.log("[InitTheme] Applied stored theme:", storedTheme);
    } else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      document.documentElement.classList.add('dark');
      document.documentElement.setAttribute('data-theme', 'dark');
      console.log("[InitTheme] Applied system dark theme");
    } else {
      document.documentElement.classList.remove('dark');
      document.documentElement.setAttribute('data-theme', 'light');
      console.log("[InitTheme] Applied system light theme");
    }
  }, [isExternalPage, location.pathname]);
  
  return <>{children}</>;
};

// Add this cache busting header for all business page requests
const CacheBustingHeaders = () => {
  const location = useLocation();
  const isBusinessPage = location.pathname.startsWith('/business/');
  
  useEffect(() => {
    if (isBusinessPage) {
      // Add cache-control meta tag
      const metaTag = document.createElement('meta');
      metaTag.httpEquiv = 'Cache-Control';
      metaTag.content = 'no-cache, no-store, must-revalidate';
      document.head.appendChild(metaTag);
      
      // Add pragma meta tag
      const pragmaTag = document.createElement('meta');
      pragmaTag.httpEquiv = 'Pragma';
      pragmaTag.content = 'no-cache';
      document.head.appendChild(pragmaTag);
      
      // Add expires meta tag
      const expiresTag = document.createElement('meta');
      expiresTag.httpEquiv = 'Expires';
      expiresTag.content = '0';
      document.head.appendChild(expiresTag);
      
      // Set a session flag to indicate we're on a business page
      sessionStorage.setItem('onBusinessPage', 'true');
      
      return () => {
        // Clean up when component unmounts
        document.head.removeChild(metaTag);
        document.head.removeChild(pragmaTag);
        document.head.removeChild(expiresTag);
        
        // Only remove the flag if we're not navigating to another business page
        if (!location.pathname.includes('/business')) {
          sessionStorage.removeItem('onBusinessPage');
        }
      };
    }
  }, [isBusinessPage, location.pathname]);
  
  return null;
};

// Early Route Detection before React Router is fully initialized
const EarlyRouteDetector = () => {
  useEffect(() => {
    if (window.location.href.includes('/business')) {
      console.log("[EarlyRouteDetector] Business page detected in URL, setting flag");
      sessionStorage.setItem('onBusinessPage', 'true');
      document.cookie = "isBusinessPage=true; path=/; max-age=3600";
      localStorage.setItem('isBusinessPage', 'true');
      document.body.classList.add('is-business-page');
      
      // Set the global variable
      window.__IS_BUSINESS_PAGE__ = true;
      
      // Create marker element for debugging
      const marker = document.createElement('div');
      marker.id = 'business-page-marker';
      marker.style.display = 'none';
      document.body.appendChild(marker);
      
      // Prevent any redirects during the critical hydration period
      const preventRedirects = () => {
        if (window.location.href.includes('/business')) {
          window.__ROUTE_LOCKED__ = true;
          console.log("[EarlyRouteDetector] Route locked during initialization");
          
          // Unlock after a delay
          setTimeout(() => {
            window.__ROUTE_LOCKED__ = false;
            console.log("[EarlyRouteDetector] Route unlocked after initialization");
          }, 5000);
        }
      };
      
      preventRedirects();
    }
  }, []);
  
  return null;
};

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <EarlyRouteDetector />
        <CacheBustingHeaders />
        <ThemeProvider defaultTheme="system">
          <TooltipProvider>
            <LanguageProvider>
              <AuthProvider>
                <SessionRecoveryWrapper>
                  <RouteAwareWrapper>
                    <RouteGuard>
                      <Routes>
                        {/* PUBLIC BUSINESS ROUTES - HIGHEST PRIORITY */}
                        <Route path="/business/:slug" element={<PublicBusinessPage />} />
                        <Route path="/business/:slug/*" element={<PublicBusinessPage />} />
                        <Route path="/business" element={<PublicBusinessPage />} />
                        
                        {/* Public routes that are ALWAYS accessible */}
                        <Route path="/" element={<Landing />} />
                        <Route path="/legal" element={<Legal />} />
                        <Route path="/contact" element={<Contact />} />
                        <Route path="/reset-password" element={<ResetPassword />} />
                        <Route path="/forgot-password" element={<ForgotPassword />} />
                        
                        {/* Auth routes */}
                        <Route path="/login" element={<Index />} />
                        <Route path="/signup" element={<Index />} />
                        
                        {/* Dashboard routes that require authentication */}
                        <Route path="/dashboard" element={<Index />} />
                        <Route path="/dashboard/*" element={<Index />} />
                        
                        {/* Redirect legacy URLs or alternative formats */}
                        <Route path="/business?slug=:slug" element={<Navigate to="/business/:slug" replace />} />
                        <Route path="*" element={<Landing />} />
                      </Routes>
                      <Toaster />
                    </RouteGuard>
                  </RouteAwareWrapper>
                </SessionRecoveryWrapper>
              </AuthProvider>
            </LanguageProvider>
          </TooltipProvider>
        </ThemeProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
