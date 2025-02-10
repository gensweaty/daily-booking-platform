
import React, { createContext, useContext, useEffect, useState } from 'react';
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

  const handleTokenError = async () => {
    console.log('Handling token error - clearing session');
    // Clear the session state
    setSession(null);
    setUser(null);
    
    // Clear local storage
    localStorage.removeItem('app-auth-token');
    localStorage.removeItem('supabase.auth.token');
    
    // Force sign out to clear any remaining session data
    await supabase.auth.signOut();
    
    // Only navigate to login if we're not already on a public route
    if (!location.pathname.match(/^(\/$|\/login$|\/signup$|\/contact$)/)) {
      navigate('/login');
      toast({
        title: "Session expired",
        description: "Please sign in again",
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    const initSession = async () => {
      try {
        const { data: { session: currentSession }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('Error getting session:', error);
          if (error.message.includes('refresh_token_not_found')) {
            await handleTokenError();
            return;
          }
          throw error;
        }

        if (currentSession) {
          console.log('Session found:', currentSession);
          setSession(currentSession);
          setUser(currentSession.user);
          
          // Only redirect if we're on an auth route
          if (location.pathname === '/login' || location.pathname === '/signup') {
            navigate('/dashboard');
          }
        } else {
          console.log('No session found');
          // Only redirect to login if we're trying to access protected routes
          if (location.pathname.startsWith('/dashboard')) {
            navigate('/login');
          }
        }
      } catch (error: any) {
        console.error('Session initialization error:', error);
        if (error.message.includes('refresh_token_not_found')) {
          await handleTokenError();
          return;
        }
        toast({
          title: "Error",
          description: "Failed to initialize session",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    initSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, newSession) => {
      console.log('Auth state changed:', event, newSession);
      
      if (event === 'SIGNED_IN') {
        setSession(newSession);
        setUser(newSession?.user ?? null);
        navigate('/dashboard');
      } else if (event === 'SIGNED_OUT' || event === 'USER_DELETED') {
        setSession(null);
        setUser(null);
        localStorage.removeItem('app-auth-token');
        localStorage.removeItem('supabase.auth.token');
        // Only navigate to login if we're not already on a public route
        if (!location.pathname.match(/^(\/$|\/login$|\/signup$|\/contact$)/)) {
          navigate('/login');
        }
      } else if (event === 'TOKEN_REFRESHED') {
        setSession(newSession);
        setUser(newSession?.user ?? null);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [navigate, toast, location.pathname]);

  const signOut = async () => {
    try {
      console.log('Signing out...');
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      
      // Clear all auth-related storage
      localStorage.removeItem('app-auth-token');
      localStorage.removeItem('supabase.auth.token');
      setUser(null);
      setSession(null);
      
      toast({
        title: "Success",
        description: "Signed out successfully",
      });
      
      navigate('/login');
    } catch (error: any) {
      console.error('Sign out error:', error);
      toast({
        title: "Error",
        description: "Failed to sign out properly. Please try again.",
        variant: "destructive",
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
