
import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { useToast } from "@/components/ui/use-toast";
import { useNavigate, useLocation } from 'react-router-dom';

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
    window.location.hash.includes('access_token=') || 
    window.location.search.includes('token_hash=') || 
    window.location.search.includes('type=recovery')
  );
};

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();

  const handleTokenError = useCallback(async () => {
    console.log('Handling token error - clearing session');
    setSession(null);
    setUser(null);
    
    localStorage.removeItem('app-auth-token');
    localStorage.removeItem('supabase.auth.token');
    
    // Don't show session expired error if we're handling a password reset
    if (hasRecoveryParams()) {
      console.log("Recovery parameters detected, not showing session expired error");
      navigate('/reset-password' + window.location.search + window.location.hash);
      return;
    }
    
    // Don't show session expired error on auth-related paths
    const authPaths = ['/login', '/signup', '/forgot-password', '/reset-password'];
    const isAuthPath = authPaths.some(path => location.pathname.startsWith(path));
    const isPublicPath = ['/', '/contact'].includes(location.pathname);
    
    if (!isAuthPath && !isPublicPath) {
      navigate('/login');
      toast({
        title: "Session expired",
        description: "Please sign in again",
        variant: "destructive",
      });
    }
  }, [navigate, toast, location.pathname]);

  const refreshSession = useCallback(async () => {
    try {
      // If we have recovery parameters, don't refresh session as we're in password reset flow
      if (hasRecoveryParams()) {
        console.log("Recovery parameters detected, skipping session refresh");
        setLoading(false);
        
        // Redirect to reset password page
        if (location.pathname !== '/reset-password') {
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
        // Only handle as error if not on auth-related path
        const authPaths = ['/login', '/signup', '/forgot-password', '/reset-password'];
        const isAuthPath = authPaths.some(path => location.pathname.startsWith(path));
        
        if (!isAuthPath) {
          await handleTokenError();
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
    }
  }, [handleTokenError, location.pathname, navigate, location.search, location.hash]);

  useEffect(() => {
    const initSession = async () => {
      try {
        // If we detect password reset parameters, handle specifically
        if (hasRecoveryParams()) {
          console.log("Password reset flow detected");
          setLoading(false);
          
          // Redirect to reset password page if not already there
          if (location.pathname !== '/reset-password') {
            console.log("Redirecting to reset password page");
            navigate('/reset-password' + window.location.search + window.location.hash, { replace: true });
          }
          return;
        }
        
        await refreshSession();
      } catch (error) {
        console.error('Session initialization error:', error);
        
        // Don't treat session errors as fatal on auth pages
        const authPaths = ['/login', '/signup', '/forgot-password', '/reset-password'];
        const isAuthPath = authPaths.some(path => location.pathname.startsWith(path));
        
        if (!isAuthPath) {
          await handleTokenError();
        }
      } finally {
        setLoading(false);
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
      console.log('Auth state changed:', event, newSession);
      
      // Check if this is a password reset flow regardless of event type
      if (hasRecoveryParams()) {
        console.log("Recovery parameters detected during auth state change");
        if (location.pathname !== '/reset-password') {
          console.log("Redirecting to reset password page");
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
        
        // Don't navigate away if already on public routes
        const publicPaths = ['/', '/login', '/signup', '/contact', '/forgot-password', '/reset-password'];
        const isPublicPath = publicPaths.some(path => location.pathname === path);
        
        if (!isPublicPath) {
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
  }, [navigate, handleTokenError, refreshSession, location.pathname, location.search, location.hash]);

  const signOut = async () => {
    try {
      // Don't sign out if we're in the password reset flow
      if (hasRecoveryParams() && location.pathname === '/reset-password') {
        console.log('Skipping sign out during password reset flow');
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
        title: "Success",
        description: "Signed out successfully",
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
