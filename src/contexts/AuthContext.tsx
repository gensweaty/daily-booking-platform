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
    supabase.auth.getSession().then(({ data: { session: initialSession } }) => {
      console.log('Initial session:', initialSession);
      setSession(initialSession);
      setUser(initialSession?.user ?? null);
      setLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, newSession) => {
      console.log('Auth state changed:', _event, newSession);
      setSession(newSession);
      setUser(newSession?.user ?? null);
      setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    try {
      // First check if we have a valid session
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      
      // Clear local state immediately for better UX
      setUser(null);
      setSession(null);

      if (currentSession) {
        // Only attempt server-side sign out if we have a session
        const { error } = await supabase.auth.signOut();
        if (error) {
          console.error('Server-side sign out error:', error);
          // Continue with local sign out even if server-side fails
        }
      }

      toast({
        title: "Success",
        description: "You have been signed out successfully",
      });

    } catch (error) {
      console.error('Sign out error:', error);
      // Even if there's an error, we've already cleared local state
      toast({
        title: "Signed out",
        description: "You have been signed out locally",
      });
    } finally {
      // Always navigate to login page and replace the current history entry
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