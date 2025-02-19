
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
    
    if (!location.pathname.match(/^(\/$|\/login$|\/signup$|\/contact$)/)) {
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
        await handleTokenError();
        return;
      }

      setSession(currentSession);
      setUser(currentSession.user);
    } catch (error) {
      console.error('Session refresh error:', error);
      await handleTokenError();
    }
  }, [handleTokenError]);

  useEffect(() => {
    const initSession = async () => {
      try {
        await refreshSession();
      } catch (error) {
        console.error('Session initialization error:', error);
        await handleTokenError();
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
      
      if (event === 'SIGNED_IN') {
        setSession(newSession);
        setUser(newSession?.user ?? null);
        navigate('/dashboard');
      } else if (event === 'SIGNED_OUT') {
        setSession(null);
        setUser(null);
        localStorage.removeItem('app-auth-token');
        localStorage.removeItem('supabase.auth.token');
        if (!location.pathname.match(/^(\/$|\/login$|\/signup$|\/contact$)/)) {
          navigate('/login');
        }
      } else if (event === 'TOKEN_REFRESHED') {
        setSession(newSession);
        setUser(newSession?.user ?? null);
      } else if (event === 'USER_UPDATED') {
        setSession(newSession);
        setUser(newSession?.user ?? null);
      }
    });

    return () => {
      subscription.unsubscribe();
      clearInterval(refreshInterval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('online', handleOnline);
    };
  }, [navigate, handleTokenError, refreshSession, location.pathname]);

  const signOut = async () => {
    try {
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
