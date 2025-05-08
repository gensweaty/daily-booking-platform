import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { useToast } from "@/components/ui/use-toast";
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({ 
  user: null,
  session: null,
  loading: true,
  signOut: async () => {},
});

// IMPROVED: Helper to check if URL has recovery parameters - more robust
const hasRecoveryParams = () => {
  return (
    window.location.hash.includes('access_token=') && 
    window.location.hash.includes('type=recovery') ||
    window.location.search.includes('token_hash=') || 
    window.location.search.includes('type=recovery') ||
    window.location.search.includes('code=')
  );
};

// Helper to check if URL has email confirmation parameters
const hasEmailConfirmParams = () => {
  const searchParams = new URLSearchParams(window.location.search);
  const hashParams = new URLSearchParams(window.location.hash.substring(1));
  
  // Check if it has the code parameter on dashboard path (new confirmation format)
  const hasDashboardCode = window.location.pathname === '/dashboard' && searchParams.has('code');
  
  // For email confirmation, we typically have access_token but no recovery type
  // or we have the newer format with just a code parameter
  return (
    hasDashboardCode ||
    (window.location.hash.includes('access_token=') && 
     !window.location.hash.includes('type=recovery')) ||
    (window.location.search.includes('type=') && 
     !window.location.search.includes('type=recovery'))
  );
};

// Helper to check if URL has error parameters
const hasErrorParams = () => {
  return (
    window.location.search.includes('error=') ||
    window.location.hash.includes('error=')
  );
};

// Define a list of public paths that don't require authentication
const PUBLIC_PATHS = ['/', '/login', '/signup', '/contact', '/legal', '/forgot-password', '/reset-password'];

// IMPROVED: Helper to check if the current path is public - Enhanced based on solution plan
const isPublicPath = (path: string) => {
  // IMPROVED: Business pages - check FIRST
  // Most comprehensive check for business pages
  if (path.startsWith('/business') || path.includes('/business/')) {
    console.log("[AuthContext] Business page path detected via path, treating as public:", path);
    return true;
  }
  
  // Additional URL check for SSR or hydration lag
  if (window.location.href.includes('/business')) {
    console.log("[AuthContext] Business page path detected via window.location, treating as public");
    return true;
  }
  
  // Check for global flag set by route-detector.js
  if (window.__IS_BUSINESS_PAGE__ === true) {
    console.log("[AuthContext] Business page detected via global flag, treating as public");
    return true;
  }
  
  // Check session storage for business page flag
  if (sessionStorage.getItem('onBusinessPage') === 'true') {
    console.log("[AuthContext] Business page flag found in sessionStorage, treating as public");
    return true;
  }
  
  // Check localStorage as last resort
  if (localStorage.getItem('isBusinessPage') === 'true') {
    console.log("[AuthContext] Business page flag found in localStorage, treating as public");
    return true;
  }
  
  // Special case for direct links with query parameters
  const urlObj = new URL(window.location.href);
  if (urlObj.searchParams.has('slug') || urlObj.searchParams.has('business')) {
    console.log("[AuthContext] Business page detected via query params, treating as public");
    return true;
  }
  
  // Check if the path is one of the public paths
  return PUBLIC_PATHS.some(publicPath => path === publicPath || path.startsWith(publicPath + '/'));
};

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [initialCheckComplete, setInitialCheckComplete] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { t } = useLanguage();

  // Add debug logging for path and auth state
  useEffect(() => {
    console.log("[AuthContext] Current path:", location.pathname);
    console.log("[AuthContext] Full URL:", window.location.href);
    console.log("[AuthContext] Is public path:", isPublicPath(location.pathname));
    console.log("[AuthContext] Authentication state:", user ? "Authenticated" : "Unauthenticated");
    
    // Check for business page flags
    const isOnBusinessPage = 
      sessionStorage.getItem('onBusinessPage') === 'true' || 
      window.__IS_BUSINESS_PAGE__ === true;
      
    if (isOnBusinessPage) {
      console.log("[AuthContext] Business page flag is set in sessionStorage or global");
    }
  }, [location.pathname, user]);

  // NEW: Special public business pages detector
  useEffect(() => {
    // Only run this on mount
    const checkIfBusinessPage = () => {
      if (window.location.href.includes('/business')) {
        console.log("[AuthContext] Business page detected on AuthProvider mount");
        sessionStorage.setItem('onBusinessPage', 'true');
        localStorage.setItem('isBusinessPage', 'true');
        window.__IS_BUSINESS_PAGE__ = true;
        
        // Skip auth check
        setLoading(false);
      }
    };
    
    checkIfBusinessPage();
  }, []);

  const handleTokenError = useCallback(async () => {
    console.log('[AuthContext] Handling token error - clearing session');
    
    // Check if we're on a business page
    if (sessionStorage.getItem('onBusinessPage') === 'true' || 
        localStorage.getItem('isBusinessPage') === 'true' ||
        window.location.href.includes('/business') ||
        window.__IS_BUSINESS_PAGE__ === true) {
      console.log("[AuthContext] On business page, skipping auth redirect");
      setSession(null);
      setUser(null);
      setLoading(false);
      return;
    }
    
    setSession(null);
    setUser(null);
    
    localStorage.removeItem('app-auth-token');
    localStorage.removeItem('supabase.auth.token');
    
    // Don't show session expired error if we're handling a password reset
    if (hasRecoveryParams() || searchParams.has('code')) {
      console.log("Recovery parameters detected, not showing session expired error");
      navigate('/reset-password' + window.location.search + window.location.hash, { replace: true });
      return;
    }
    
    // Don't show session expired error on public paths
    if (isPublicPath(location.pathname)) {
      console.log("Public path detected, not showing session expired error");
      return;
    }
    
    navigate('/login');
    toast({
      title: "Session expired",
      description: "Please sign in again",
      variant: "destructive",
    });
  }, [navigate, toast, location.pathname, searchParams]);

  const refreshSession = useCallback(async () => {
    try {
      // Early return for business pages
      if (sessionStorage.getItem('onBusinessPage') === 'true' || 
          localStorage.getItem('isBusinessPage') === 'true' ||
          window.location.href.includes('/business') ||
          window.__IS_BUSINESS_PAGE__ === true) {
        console.log("[AuthContext] On business page, skipping authentication checks");
        setLoading(false);
        return;
      }
      
      const { data: { session: currentSession }, error } = await supabase.auth.getSession();
      if (error) {
        if (error.message.includes('token_refresh_failed') || 
            error.message.includes('invalid_refresh_token') ||
            error.message.includes('token_not_found')) {
          await handleTokenError();
          return;
        }
        throw error;
      }

      if (!currentSession) {
        // IMPROVED: Modified logic for no session case
        if (!isPublicPath(location.pathname)) {
          console.log("[AuthContext] No session and not on public path, handling token error");
          await handleTokenError();
        } else {
          // We're on a public path, just update the state
          console.log("[AuthContext] No session but on public path, allowing access");
          setSession(null);
          setUser(null);
        }
        return;
      }

      setSession(currentSession);
      setUser(currentSession.user);
    } catch (error) {
      console.error('Session refresh error:', error);
      await handleTokenError();
    } finally {
      setLoading(false);
      setInitialCheckComplete(true);
    }
  }, [handleTokenError, location.pathname, navigate, location.search, location.hash, searchParams]);

  // Initialize authentication
  useEffect(() => {
    const initSession = async () => {
      try {
        // Special handling for business pages
        const isBusinessPage = 
          location.pathname.startsWith('/business') || 
          location.pathname.includes('/business/') ||
          window.location.href.includes('/business') ||
          sessionStorage.getItem('onBusinessPage') === 'true' ||
          localStorage.getItem('isBusinessPage') === 'true' ||
          window.__IS_BUSINESS_PAGE__ === true;
        
        if (isBusinessPage) {
          console.log("[AuthContext] Business page detected in initSession, setting flag");
          sessionStorage.setItem('onBusinessPage', 'true');
          localStorage.setItem('isBusinessPage', 'true');
          window.__IS_BUSINESS_PAGE__ = true;
          
          // For business pages without auth params, use fast path
          if (!hasRecoveryParams() && !hasEmailConfirmParams() && !window.__ROUTE_LOCKED__) {
            console.log("[AuthContext] Business page without auth params, fast path");
            setLoading(false);
            setInitialCheckComplete(true);
            return;
          }
        } else {
          // Not a business page, clear the flag
          sessionStorage.removeItem('onBusinessPage');
          localStorage.removeItem('isBusinessPage');
        }
        
        // ... keep existing code (dashboard with code parameter handling, email confirmation, password reset flow)

        await refreshSession();
      } catch (error) {
        console.error('Session initialization error:', error);
        
        // Special handling for business pages during errors
        if (window.location.href.includes('/business')) {
          console.log("[AuthContext] Error during init but we're on a business page, allowing access");
          setLoading(false);
          setInitialCheckComplete(true);
          return;
        }
        
        // Don't treat session errors as fatal on public paths
        if (!isPublicPath(location.pathname)) {
          await handleTokenError();
        } else {
          setLoading(false);
        }
      } finally {
        setLoading(false);
        setInitialCheckComplete(true);
      }
    };

    initSession();

    // Set up periodic session refresh (every 4 minutes)
    const refreshInterval = setInterval(refreshSession, 4 * 60 * 1000);

    // Set up visibility change handler
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        refreshSession();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Set up online/offline handlers
    const handleOnline = () => {
      console.log('Network is online - refreshing session');
      refreshSession();
    };
    window.addEventListener('online', handleOnline);

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, newSession) => {
      console.log('Auth state changed:', event, newSession ? 'Session exists' : 'No session');
      
      // For business pages, don't redirect except for explicit login/logout
      if ((sessionStorage.getItem('onBusinessPage') === 'true' || 
           window.location.href.includes('/business') ||
           window.__IS_BUSINESS_PAGE__ === true) && 
          event !== 'SIGNED_IN' && 
          event !== 'SIGNED_OUT') {
        console.log("[AuthContext] On business page, skipping auth state change handling");
        return;
      }
      
      // ... keep existing code (dashboard code parameter, email confirmation, password reset flow handling)
      
      if (event === 'SIGNED_IN') {
        setSession(newSession);
        setUser(newSession?.user ?? null);
        navigate('/dashboard');
      } else if (event === 'SIGNED_OUT') {
        setSession(null);
        setUser(null);
        localStorage.removeItem('app-auth-token');
        localStorage.removeItem('supabase.auth.token');
        
        // FIXED: Don't navigate away if already on public routes
        if (!isPublicPath(location.pathname)) {
          navigate('/login');
        }
      } else if (event === 'TOKEN_REFRESHED') {
        setSession(newSession);
        setUser(newSession?.user ?? null);
      } else if (event === 'USER_UPDATED') {
        setSession(newSession);
        setUser(newSession?.user ?? null);
      } else if (event === 'PASSWORD_RECOVERY') {
        console.log('Password recovery event detected');
        
        // Redirect to reset-password page if not already there
        if (location.pathname !== '/reset-password') {
          navigate('/reset-password' + location.search + location.hash, { replace: true });
        }
      }
    });

    return () => {
      subscription.unsubscribe();
      clearInterval(refreshInterval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('online', handleOnline);
    };
  }, [navigate, handleTokenError, refreshSession, location.pathname, location.search, location.hash, searchParams, toast]);

  const signOut = async () => {
    try {
      // Don't sign out if we're in the password reset flow
      if ((hasRecoveryParams() || searchParams.has('code')) && location.pathname === '/reset-password') {
        console.log('Skipping sign out during password reset flow');
        return;
      }
      
      // NEW: Don't redirect from business pages on signOut
      const isBusinessPage = 
        location.pathname.startsWith('/business') || 
        window.location.href.includes('/business') ||
        sessionStorage.getItem('onBusinessPage') === 'true' ||
        window.__IS_BUSINESS_PAGE__ === true;
      
      console.log('Starting sign out process...');
      localStorage.removeItem('app-auth-token');
      localStorage.removeItem('supabase.auth.token');
      setUser(null);
      setSession(null);
      
      const { error } = await supabase.auth.signOut();
      
      if (error && !error.message.includes('session_not_found')) {
        throw error;
      }
      
      toast({
        title: t('common.success'),
        description: t('auth.signOutSuccess'),
      });
      
      // IMPROVED: Only navigate to login if not on a business page
      if (!isBusinessPage) {
        navigate('/login');
      }
    } catch (error: any) {
      console.error('Sign out error:', error);
      localStorage.removeItem('app-auth-token');
      localStorage.removeItem('supabase.auth.token');
      setUser(null);
      setSession(null);
      
      // IMPROVED: Only navigate to login if not on a business page
      if (!location.pathname.startsWith('/business')) {
        navigate('/login');
      }
      
      toast({
        title: "Notice",
        description: "You have been signed out.",
      });
    }
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
