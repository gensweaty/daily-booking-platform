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

  useEffect(() => {
    let mounted = true;

    const initSession = async () => {
      try {
        console.log('Initializing session...');
        const { data: { session: initialSession }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('Session initialization error:', error);
          if (error.message.includes('refresh_token_not_found')) {
            await supabase.auth.signOut();
            if (location.pathname !== '/login' && location.pathname !== '/signup' && location.pathname !== '/') {
              navigate('/login');
            }
          }
          throw error;
        }

        if (mounted) {
          console.log('Initial session:', initialSession);
          if (initialSession) {
            setSession(initialSession);
            setUser(initialSession.user);
            
            if (location.pathname === '/login' || location.pathname === '/signup') {
              navigate('/dashboard');
            }
          } else if (location.pathname !== '/login' && location.pathname !== '/signup' && location.pathname !== '/') {
            navigate('/login');
          }
        }
      } catch (error: any) {
        console.error('Session initialization error:', error);
        if (mounted) {
          if (!error.message.includes('refresh_token_not_found')) {
            toast({
              title: "Error",
              description: "Failed to initialize session",
              variant: "destructive",
            });
          }
          if (location.pathname !== '/login' && location.pathname !== '/signup' && location.pathname !== '/') {
            navigate('/login');
          }
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    initSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, newSession) => {
      console.log('Auth state changed:', event, newSession);
      
      if (mounted) {
        if (event === 'SIGNED_IN') {
          setSession(newSession);
          setUser(newSession?.user ?? null);
          navigate('/dashboard');
        } else if (event === 'SIGNED_OUT') {
          setSession(null);
          setUser(null);
          navigate('/login');
        } else if (event === 'TOKEN_REFRESHED') {
          setSession(newSession);
          setUser(newSession?.user ?? null);
        } else if (event === 'USER_UPDATED') {
          setSession(newSession);
          setUser(newSession?.user ?? null);
        }
        
        setLoading(false);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [navigate, toast, location.pathname]);

  const signOut = async () => {
    try {
      setLoading(true);
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      
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
        description: "Failed to sign out. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
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