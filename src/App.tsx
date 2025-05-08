
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
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

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

// Helper for session recovery and real-time updates
const SessionAndRealtimeWrapper = ({ children }: { children: React.ReactNode }) => {
  useEffect(() => {
    // Setup real-time listeners for data changes
    const realTimeChannels = [];
    
    // Setup a channel for events table (calendar events)
    const eventsChannel = supabase
      .channel('events-changes')
      .on('postgres_changes', 
        {
          event: '*', // Listen for all events (INSERT, UPDATE, DELETE)
          schema: 'public',
          table: 'events'
        }, 
        (payload) => {
          console.log('Events table changed:', payload);
          
          // Invalidate events query to refresh data
          queryClient.invalidateQueries({ queryKey: ['events'] });
          
          // Invalidate statistics queries to update them
          queryClient.invalidateQueries({ queryKey: ['eventStats'] });
          
          // Show a toast notification for the change
          const eventAction = payload.eventType === 'INSERT' 
            ? 'added' 
            : payload.eventType === 'UPDATE' 
              ? 'updated' 
              : 'removed';
              
          // Safely access payload properties with type checking
          const eventTitle = payload.new && 'title' in payload.new 
            ? payload.new.title as string 
            : payload.old && 'title' in payload.old 
              ? payload.old.title as string 
              : 'Event';
          
          toast(`${eventTitle} ${eventAction}`, {
            description: `Calendar has been updated`,
            duration: 3000
          });
      })
      .subscribe();
      
    realTimeChannels.push(eventsChannel);
    
    // Setup a channel for tasks table
    const tasksChannel = supabase
      .channel('tasks-changes')
      .on('postgres_changes', 
        {
          event: '*',
          schema: 'public',
          table: 'tasks'
        }, 
        (payload) => {
          console.log('Tasks table changed:', payload);
          
          // Invalidate tasks queries
          queryClient.invalidateQueries({ queryKey: ['tasks'] });
          
          // Invalidate statistics for task stats
          queryClient.invalidateQueries({ queryKey: ['taskStats'] });
      })
      .subscribe();
      
    realTimeChannels.push(tasksChannel);
    
    // Setup a channel for customers table (CRM)
    const customersChannel = supabase
      .channel('customers-changes')
      .on('postgres_changes', 
        {
          event: '*',
          schema: 'public',
          table: 'customers'
        }, 
        (payload) => {
          console.log('Customers table changed:', payload);
          
          // Invalidate CRM data queries
          queryClient.invalidateQueries({ queryKey: ['customers'] });
          queryClient.invalidateQueries({ queryKey: ['eventStats'] });
          queryClient.invalidateQueries({ queryKey: ['crm'] });
      })
      .subscribe();
      
    realTimeChannels.push(customersChannel);
    
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
      // Clean up all the realtime subscriptions
      realTimeChannels.forEach(channel => {
        supabase.removeChannel(channel);
      });
      
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
  
  // More reliable business page detection
  const isExternalPage = location.pathname.startsWith('/business/') || location.pathname === '/business';
  
  // If accessing from business path, set the flag early
  useEffect(() => {
    if (isExternalPage) {
      console.log("[RouteAwareWrapper] Business page detected:", location.pathname);
      localStorage.setItem('accessing_public_business_page', 'true');
      localStorage.setItem('last_business_path', location.pathname);
    }
  }, [location.pathname, isExternalPage]);
  
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
    
    // Make sure visibility is restored in case it was hidden by early detection
    document.documentElement.style.visibility = 'visible';
  }, [isExternalPage, location.pathname]);
  
  return <>{children}</>;
};

// Business page route interceptor
const BusinessRouteInterceptor = () => {
  const location = useLocation();
  
  useEffect(() => {
    // Check if we're directly accessing a business path
    if (location.pathname.startsWith('/business')) {
      console.log("[BusinessRouteInterceptor] Intercepting business path:", location.pathname);
      localStorage.setItem('accessing_public_business_page', 'true');
      localStorage.setItem('last_business_path', location.pathname);
    }
    
    // Check if there's any redirection needed
    const redirectNeeded = localStorage.getItem('redirect_after_load');
    if (redirectNeeded) {
      const targetPath = localStorage.getItem('redirect_target_path');
      if (targetPath) {
        console.log(`[BusinessRouteInterceptor] Performing delayed redirect to: ${targetPath}`);
        localStorage.removeItem('redirect_after_load');
        localStorage.removeItem('redirect_target_path');
        
        // Use timeout to ensure app is fully loaded
        setTimeout(() => {
          window.location.href = targetPath;
        }, 100);
      }
    }
  }, [location]);
  
  return null;
};

function App() {
  // Enable Supabase realtime functionality
  useEffect(() => {
    // Enable Supabase realtime for the required tables
    const enableRealtimeTables = async () => {
      try {
        // First, try to enable realtime functionality for the events table
        const { data: eventsRealtimeEnabled, error: eventsError } = await supabase.rpc(
          'get_public_events_by_user_id', 
          { user_id_param: 'system' }
        ).limit(0);
        
        console.log('Realtime setup initiated');
        
        // Direct SQL approach - execute database actions instead of using the RPC
        // These will be ignored if permissions aren't sufficient but won't cause errors
        await supabase.from('events').select('id').limit(1);
        console.log('Events table accessed for realtime setup');
        
        await supabase.from('tasks').select('id').limit(1);
        console.log('Tasks table accessed for realtime setup');
        
        await supabase.from('customers').select('id').limit(1);
        console.log('Customers table accessed for realtime setup');
        
      } catch (error) {
        console.error('Error setting up realtime functionality:', error);
      }
    };
    
    // Enable realtime functionality
    enableRealtimeTables();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <BusinessRouteInterceptor />
        <ThemeProvider defaultTheme="system">
          <LanguageProvider>
            <AuthProvider>
              <SessionAndRealtimeWrapper>
                <RouteAwareWrapper>
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
                </RouteAwareWrapper>
              </SessionAndRealtimeWrapper>
            </AuthProvider>
          </LanguageProvider>
        </ThemeProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
