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

// Helper to check if URL has recovery parameters
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

// Enhanced helper to check if the current path is a business page path
const isBusinessPath = (path: string) => {
  // Check if the path starts with /business/
  return path.startsWith('/business/') || path === '/business';
};

// Helper to check if the current path is public
const isPublicPath = (path: string) => {
  // Check if the path is one of the public paths, starts with a public path, or is a business path
  return PUBLIC_PATHS.some(publicPath => path === publicPath || path.startsWith(publicPath + '/')) || 
         isBusinessPath(path);
};

// Helper to check if we're accessing from the production domain
const isProductionDomain = () => {
  const hostname = window.location.hostname;
  return hostname === 'smartbookly.com' || 
         hostname === 'www.smartbookly.com';
};

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { t } = useLanguage();

  // Check for localStorage flag set by early route detection
  const isAccessingBusinessPage = localStorage.getItem('accessing_public_business_page') === 'true';
  
  useEffect(() => {
    // Clear the business page flag once the app is properly loaded
    return () => {
      if (isBusinessPath(location.pathname)) {
        // Keep the flag if we're still on a business page
        localStorage.setItem('accessing_public_business_page', 'true');
      } else {
        // Remove the flag if we navigate away
        localStorage.removeItem('accessing_public_business_page');
      }
    };
  }, [location.pathname]);

  const handleTokenError = useCallback(async () => {
    console.log('Handling token error - clearing session');
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
    
    // Don't show session expired error on public paths or business pages
    if (isPublicPath(location.pathname) || isBusinessPath(location.pathname) || isAccessingBusinessPage) {
      console.log("Public path or business page detected, not showing session expired error");
      return;
    }
    
    navigate('/login');
    toast({
      title: "Session expired",
      description: "Please sign in again",
      variant: "destructive",
    });
  }, [navigate, toast, location.pathname, searchParams, isAccessingBusinessPage]);

  const refreshSession = useCallback(async () => {
    try {
      // Don't refresh session for business pages to avoid auth redirects
      if (isBusinessPath(location.pathname) || isAccessingBusinessPage) {
        console.log("Business page detected, skipping session refresh");
        setLoading(false);
        return;
      }
      
      // If we have recovery parameters, don't refresh session as we're in password reset flow
      if (hasRecoveryParams() || searchParams.has('code')) {
        console.log("Recovery parameters detected, skipping session refresh");
        setLoading(false);
        
        // Redirect to reset password page
        if (location.pathname !== '/reset-password') {
          console.log("Redirecting to reset password page from refreshSession");
          navigate('/reset-password' + window.location.search + window.location.hash, { replace: true });
        }
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
        // Special handling for business pages - don't redirect to login
        if (isBusinessPath(location.pathname) || isAccessingBusinessPage) {
          console.log("Business page with no session, continuing without redirect");
          setSession(null);
          setUser(null);
          setLoading(false);
          return;
        }
        
        // Only handle as error if not on public path
        if (!isPublicPath(location.pathname)) {
          await handleTokenError();
        } else {
          // We're on a public path, just update the state
          setSession(null);
          setUser(null);
        }
        return;
      }

      setSession(currentSession);
      setUser(currentSession.user);
    } catch (error) {
      console.error('Session refresh error:', error);
      
      // Special handling for business pages - don't redirect on errors
      if (isBusinessPath(location.pathname) || isAccessingBusinessPage) {
        console.log("Error on business page, continuing without redirect");
        setSession(null);
        setUser(null);
        setLoading(false);
        return;
      }
      
      await handleTokenError();
    } finally {
      setLoading(false);
    }
  }, [handleTokenError, location.pathname, navigate, location.search, location.hash, searchParams, isAccessingBusinessPage]);

  useEffect(() => {
    const initSession = async () => {
      try {
        // Check for early business page detection
        if (isBusinessPath(location.pathname) || isAccessingBusinessPage) {
          console.log("Business page detected in initSession, skipping auth redirects");
          setLoading(false);
          
          // Still get the session if available, but don't redirect based on it
          try {
            const { data } = await supabase.auth.getSession();
            if (data.session) {
              setSession(data.session);
              setUser(data.session.user);
            } else {
              setSession(null);
              setUser(null);
            }
          } catch (e) {
            console.error("Error getting session for business page:", e);
            setSession(null);
            setUser(null);
          }
          
          // Make sure visibility is restored in case it was hidden
          document.documentElement.style.visibility = 'visible';
          return;
        }
        
        // Handle dashboard with code parameter (email confirmation)
        if (location.pathname === '/dashboard' && searchParams.has('code')) {
          console.log("Found code parameter on dashboard route, handling email confirmation");
          setLoading(false);
          
          try {
            // Exchange the code for a session
            const { data, error } = await supabase.auth.exchangeCodeForSession(
              searchParams.get('code') || ''
            );
            
            if (error) {
              console.error("Error exchanging code for session:", error);
              navigate('/login', { replace: true });
              toast({
                title: "Error",
                description: "There was an error confirming your email. Please try again.",
                variant: "destructive",
              });
              return;
            }
            
            if (data.session) {
              console.log("Successfully exchanged code for session:", data);
              setSession(data.session);
              setUser(data.session.user);
              
              navigate('/dashboard', { replace: true });
              toast({
                title: "Success",
                description: "Your email has been confirmed!",
              });
              return;
            }
          } catch (e) {
            console.error("Exception exchanging code:", e);
            navigate('/login', { replace: true });
          }
          return;
        }
        
        // First check for email confirmation links
        if (hasEmailConfirmParams()) {
          console.log("Email confirmation link detected in initSession", {
            search: location.search,
            hash: location.hash
          });
          
          try {
            // Let Supabase process the email confirmation
            const { data, error } = await supabase.auth.getSession();
            
            if (error) {
              console.error("Error processing email confirmation:", error);
              // If there's an error, check if it's due to OTP expiry
              if (hasErrorParams() && (location.search.includes('error_code=otp_expired') || 
                                    location.hash.includes('error_code=otp_expired'))) {
                // Handle expired email confirmation link error
                console.log("Email confirmation link has expired");
                navigate('/login', { replace: true });
                toast({
                  title: "Email confirmation link expired",
                  description: "Please request a new confirmation email or contact support",
                  variant: "destructive",
                });
                return;
              }
              
              // Handle other errors
              navigate('/login');
              toast({
                title: "Error",
                description: "There was an error confirming your email. Please try again.",
                variant: "destructive",
              });
              return;
            }
            
            if (data.session) {
              setSession(data.session);
              setUser(data.session.user);
              
              // Email confirmed successfully, redirect to dashboard
              navigate('/dashboard', { replace: true });
              toast({
                title: "Success",
                description: "Your email has been confirmed!",
              });
              return;
            }
          } catch (e) {
            console.error("Error in email confirmation flow:", e);
          }
        }
        
        // Then check for password reset links
        if (hasRecoveryParams() || searchParams.has('code')) {
          console.log("Password reset flow detected in initSession");
          setLoading(false);
          
          // Redirect to reset password page if not already there
          if (location.pathname !== '/reset-password') {
            console.log("Redirecting to reset password page from initSession");
            navigate('/reset-password' + window.location.search + window.location.hash, { replace: true });
          }
          return;
        }
        
        await refreshSession();
      } catch (error) {
        console.error('Session initialization error:', error);
        
        // Don't treat session errors as fatal on public paths or business pages
        if (!isPublicPath(location.pathname) && !isBusinessPath(location.pathname) && !isAccessingBusinessPage) {
          await handleTokenError();
        } else {
          setLoading(false);
        }
      } finally {
        setLoading(false);
        // Ensure visibility is restored
        document.documentElement.style.visibility = 'visible';
      }
    };

    initSession();

    // Set up periodic session refresh (every 4 minutes)
    const refreshInterval = setInterval(() => {
      // Don't refresh if on business page to avoid auth redirects
      if (!isBusinessPath(location.pathname) && !isAccessingBusinessPage) {
        refreshSession();
      }
    }, 4 * 60 * 1000);

    // Set up visibility change handler
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        // Skip refresh for business pages
        if (!isBusinessPath(location.pathname) && !isAccessingBusinessPage) {
          refreshSession();
        }
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Set up online/offline handlers
    const handleOnline = () => {
      console.log('Network is online - refreshing session');
      // Skip refresh for business pages
      if (!isBusinessPath(location.pathname) && !isAccessingBusinessPage) {
        refreshSession();
      }
    };
    window.addEventListener('online', handleOnline);

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, newSession) => {
      console.log('Auth state changed:', event, newSession ? 'Session exists' : 'No session');
      
      // Special handling for business pages - never redirect regardless of auth state
      if (isBusinessPath(location.pathname) || isAccessingBusinessPage) {
        console.log("Auth state changed on business page, not redirecting");
        if (newSession) {
          setSession(newSession);
          setUser(newSession.user);
        }
        return;
      }
      
      // Handle dashboard with code parameter (email confirmation)
      if (location.pathname === '/dashboard' && searchParams.has('code')) {
        console.log("Code parameter detected on dashboard route during auth state change");
        
        try {
          // Exchange the code for a session
          const { data, error } = await supabase.auth.exchangeCodeForSession(
            searchParams.get('code') || ''
          );
          
          if (error) {
            console.error("Error exchanging code for session:", error);
            navigate('/login', { replace: true });
          } else if (data.session) {
            console.log("Successfully exchanged code for session:", data);
            setSession(data.session);
            setUser(data.session.user);
            
            navigate('/dashboard', { replace: true });
            toast({
              title: "Success",
              description: "Your email has been confirmed!",
            });
          }
        } catch (e) {
          console.error("Exception exchanging code:", e);
        }
        return;
      }
      
      // Handle email confirmation specifically
      if ((event === 'SIGNED_IN' || event === 'USER_UPDATED') && hasEmailConfirmParams()) {
        console.log("Email confirmation completed", {
          event,
          hasSession: !!newSession
        });
        
        if (newSession) {
          setSession(newSession);
          setUser(newSession.user);
          
          // Remove any error parameters from the URL
          if (hasErrorParams()) {
            navigate('/dashboard', { replace: true });
          } else {
            navigate('/dashboard', { replace: true });
          }
          
          toast({
            title: "Success", 
            description: "Your email has been confirmed!"
          });
        }
        return;
      }
      
      // Check if this is a password reset flow regardless of event type
      if (hasRecoveryParams() || searchParams.has('code')) {
        console.log("Recovery parameters detected during auth state change");
        if (location.pathname !== '/reset-password') {
          console.log("Redirecting to reset password page from auth state change");
          navigate('/reset-password' + window.location.search + window.location.hash, { replace: true });
        }
        return;
      }
      
      if (event === 'SIGNED_IN') {
        setSession(newSession);
        setUser(newSession?.user ?? null);
        navigate('/dashboard');
      } else if (event === 'SIGNED_OUT') {
        setSession(null);
        setUser(null);
        localStorage.removeItem('app-auth-token');
        localStorage.removeItem('supabase.auth.token');
        
        // Don't navigate away if already on public routes or business pages
        if (!isPublicPath(location.pathname) && !isBusinessPath(location.pathname)) {
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
  }, [navigate, handleTokenError, refreshSession, location.pathname, location.search, location.hash, searchParams, toast, isAccessingBusinessPage]);

  const signOut = async () => {
    try {
      // Don't sign out if we're in the password reset flow
      if ((hasRecoveryParams() || searchParams.has('code')) && location.pathname === '/reset-password') {
        console.log('Skipping sign out during password reset flow');
        return;
      }
      
      // Don't sign out if we're on a business page
      if (isBusinessPath(location.pathname) || isAccessingBusinessPage) {
        console.log('Skipping sign out on business page');
        return;
      }
      
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
      
      navigate('/login');
    } catch (error: any) {
      console.error('Sign out error:', error);
      localStorage.removeItem('app-auth-token');
      localStorage.removeItem('supabase.auth.token');
      setUser(null);
      setSession(null);
      navigate('/login');
      
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
