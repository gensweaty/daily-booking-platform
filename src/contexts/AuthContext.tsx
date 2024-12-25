import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { useToast } from "@/components/ui/use-toast";
import { useNavigate } from 'react-router-dom';

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

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session: initialSession }, error }) => {
      if (error) {
        console.error('Initial session error:', error);
        setLoading(false);
        return;
      }
      console.log('Initial session:', initialSession);
      if (initialSession) {
        setSession(initialSession);
        setUser(initialSession.user);
      }
      setLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
      console.log('Auth state changed:', _event, newSession);
      
      if (_event === 'SIGNED_OUT') {
        setSession(null);
        setUser(null);
        navigate('/login', { replace: true });
      } else if (newSession) {
        setSession(newSession);
        setUser(newSession.user);
      }
      
      setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [navigate]);

  const signOut = async () => {
    try {
      // First try to get the current session
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      
      if (!currentSession) {
        // If no session exists, just clear local state and redirect
        setUser(null);
        setSession(null);
        navigate('/login', { replace: true });
        return;
      }

      // Attempt to sign out from Supabase
      const { error } = await supabase.auth.signOut({
        scope: 'local' // Use local scope to avoid server validation
      });
      
      if (error) {
        console.error('Sign out error:', error);
        toast({
          title: "Warning",
          description: "Sign out may not be complete. Please try again.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Success",
          description: "You have been signed out successfully",
        });
      }
    } catch (error) {
      console.error('Sign out error:', error);
      toast({
        title: "Error",
        description: "An error occurred during sign out.",
        variant: "destructive",
      });
    } finally {
      // Always ensure local state is cleared and user is redirected
      setUser(null);
      setSession(null);
      navigate('/login', { replace: true });
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