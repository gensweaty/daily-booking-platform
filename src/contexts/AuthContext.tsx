
import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase, handleEmailConfirmation } from '@/lib/supabase';
import { useToast } from "@/components/ui/use-toast";
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';

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
  
  // Check if it has the code parameter (new confirmation format)
  const hasCode = searchParams.has('code');
  
  // For email confirmation, we typically have access_token but no recovery type
  // or we have the newer format with just a code parameter
  return (
    hasCode ||
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

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();

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
  }, [navigate, toast, location.pathname, searchParams]);

  const refreshSession = useCallback(async () => {
    try {
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
  }, [handleTokenError, location.pathname, navigate, location.search, location.hash, searchParams]);

  useEffect(() => {
    const initSession = async () => {
      try {
        // Handle confirmation code parameter
        const confirmationCode = searchParams.get('code');
        if (confirmationCode) {
          console.log("Code parameter detected:", confirmationCode);
          setLoading(true);
          
          try {
            // Exchange the code for a session
            const result = await handleEmailConfirmation(confirmationCode);
            
            if (!result.success) {
              console.error("Error exchanging code for session:", result.error);
              
              toast({
                title: "Error",
                description: "There was an error confirming your email. Please try again.",
                variant: "destructive",
              });
              
              navigate('/login', { replace: true });
              setLoading(false);
              return;
            }
            
            if (result.session) {
              console.log("Successfully exchanged code for session");
              setSession(result.session);
              setUser(result.session.user);
              
              // Clean URL by removing the code parameter
              const cleanUrl = '/dashboard';
              navigate(cleanUrl, { replace: true });
              
              toast({
                title: "Success",
                description: "Your email has been confirmed!",
              });
              
              setLoading(false);
              return;
            }
          } catch (e) {
            console.error("Exception exchanging code:", e);
            navigate('/login', { replace: true });
            setLoading(false);
            return;
          }
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
      console.log('Auth state changed:', event, newSession ? 'Session exists' : 'No session');
      
      // Special handling for confirmation code
      const confirmationCode = searchParams.get('code');
      if (confirmationCode) {
        console.log("Confirmation code detected during auth state change:", confirmationCode);
        
        try {
          const result = await handleEmailConfirmation(confirmationCode);
          
          if (!result.success) {
            console.error("Error exchanging code during auth state change:", result.error);
            navigate('/login', { replace: true });
            return;
          }
          
          if (result.session) {
            console.log("Successfully exchanged confirmation code for session during auth state change");
            setSession(result.session);
            setUser(result.session.user);
            
            // Redirect to dashboard after successful confirmation
            navigate('/dashboard', { replace: true });
            
            toast({
              title: "Success",
              description: "Your email has been confirmed!",
            });
            return;
          }
        } catch (e) {
          console.error("Exception exchanging confirmation code during auth state change:", e);
          navigate('/login', { replace: true });
          return;
        }
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
  }, [navigate, handleTokenError, refreshSession, location.pathname, location.search, location.hash, searchParams, toast]);

  const signOut = async () => {
    try {
      // Don't sign out if we're in the password reset flow
      if ((hasRecoveryParams() || searchParams.has('code')) && location.pathname === '/reset-password') {
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
