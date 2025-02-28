
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { ThemeProvider } from "next-themes";
import { LanguageProvider } from "@/contexts/LanguageContext";
import Index from "./pages/Index";
import Landing from "./pages/Landing";
import Contact from "./pages/Contact";
import Legal from "./pages/Legal";
import { AuthUI } from "./components/AuthUI";
import { ForgotPassword } from "./components/ForgotPassword";
import { ResetPassword } from "./components/ResetPassword";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect } from "react";
import { supabase } from "@/lib/supabase";

const queryClient = new QueryClient();

// Helper to check if URL has recovery parameters - UPDATED for better detection
const hasRecoveryParams = () => {
  try {
    // Get both search and hash parameters
    const searchParams = new URLSearchParams(window.location.search);
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    
    // Check for all possible recovery parameters in both search and hash
    const hasCode = searchParams.has('code');
    const hasAccessToken = hashParams.has('access_token');
    const hasRefreshToken = hashParams.has('refresh_token');
    const hasType = searchParams.get('type') === 'recovery' || hashParams.get('type') === 'recovery';
    
    // Special check for query parameters that contain reset codes
    const isResetPasswordPath = window.location.pathname.startsWith('/reset-password');
    const hasResetParams = isResetPasswordPath && (hasCode || window.location.search.includes('code='));
    
    // Check for code in the URL path itself (format: /reset-password/CODE)
    const pathHasCode = window.location.pathname.match(/\/reset-password[\/:](.+)$/);
    
    // Debug log for troubleshooting
    const result = hasCode || hasAccessToken || hasRefreshToken || hasType || pathHasCode || hasResetParams;
    
    if (result) {
      console.log("Password reset parameters detected:", {
        hasCode,
        hasAccessToken,
        hasRefreshToken,
        hasType,
        pathHasCode: pathHasCode ? true : false,
        hasResetParams,
        currentPath: window.location.pathname,
        currentSearch: window.location.search
      });
    }
    
    return result;
  } catch (error) {
    console.error("Error checking for recovery params:", error);
    return false;
  }
};

// Helper to check if URL has email confirmation parameters
const hasEmailConfirmParams = () => {
  try {
    // Get both search and hash parameters
    const searchParams = new URLSearchParams(window.location.search);
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    
    // Check for confirmation specific parameters
    const hasAccessToken = hashParams.has('access_token');
    const hasType = searchParams.has('type') && searchParams.get('type') !== 'recovery';
    const isConfirmationFlow = hasAccessToken && !hashParams.get('type')?.includes('recovery');
    
    // Check for error parameters (common in email confirmation flows)
    const hasError = searchParams.has('error') || hashParams.has('error');
    const isEmailConfirmError = hasError && 
      ((searchParams.has('error_code') && searchParams.get('error_code') === 'otp_expired') ||
       (hashParams.has('error_code') && hashParams.get('error_code') === 'otp_expired'));
    
    // Log for debugging
    const result = isConfirmationFlow || hasType || isEmailConfirmError;
    
    if (result || hasError) {
      console.log("Checking for email confirmation parameters:", {
        hasAccessToken,
        hasType,
        hasError,
        isEmailConfirmError,
        isConfirmationFlow,
        type: searchParams.get('type') || hashParams.get('type'),
        errorCode: searchParams.get('error_code') || hashParams.get('error_code'),
        currentPath: window.location.pathname,
      });
    }
    
    return result;
  } catch (error) {
    console.error("Error checking for email confirmation params:", error);
    return false;
  }
};

// Protected routes - require authentication
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  
  // Check if we're coming from an email confirmation flow
  useEffect(() => {
    if (hasEmailConfirmParams()) {
      console.log("Email confirmation parameters detected in protected route");
      // We'll let the auth provider handle this
      return;
    }
    
    // Check if we're coming from a password reset flow
    if (hasRecoveryParams()) {
      console.log("Recovery parameters detected in protected route, redirecting to reset password");
      navigate('/reset-password' + window.location.search + window.location.hash, { replace: true });
    }
  }, [navigate, location]);
  
  if (loading) {
    return <div>Loading...</div>;
  }
  
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  
  return <>{children}</>;
};

// Auth routes - redirect to dashboard if logged in
const AuthRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  
  // Check if we're coming from an email confirmation flow
  useEffect(() => {
    if (hasEmailConfirmParams()) {
      console.log("Email confirmation parameters detected in auth route, letting auth provider handle it");
      return;
    }
    
    // Check if we're coming from a password reset flow
    if (hasRecoveryParams()) {
      console.log("Recovery parameters detected in auth route, redirecting to reset password");
      navigate('/reset-password' + window.location.search + window.location.hash, { replace: true });
      return;
    }
  }, [navigate, location]);
  
  if (loading) {
    return <div>Loading...</div>;
  }
  
  if (user && !hasRecoveryParams()) {
    return <Navigate to="/dashboard" replace />;
  }
  
  return <>{children}</>;
};

// Special route for password reset to ensure we don't redirect even with an active session
const PasswordResetRoute = ({ children }: { children: React.ReactNode }) => {
  return <>{children}</>;
};

const AnimatedRoutes = () => {
  const location = useLocation();
  const navigate = useNavigate();
  
  // Global handler for special links that runs on initial mount
  useEffect(() => {
    // Handle email confirmation links first
    if (hasEmailConfirmParams()) {
      console.log("Email confirmation parameters detected, letting auth provider handle the flow");
      
      // If on dashboard with error params, redirect to login
      if (location.pathname === '/dashboard' && location.search.includes('error=')) {
        console.log("Error in email confirmation, redirecting to login");
        navigate('/login', { replace: true });
      }
      return;
    }
    
    // Then handle password reset links
    if (hasRecoveryParams() && !location.pathname.startsWith('/reset-password')) {
      console.log("Recovery parameters detected on path:", location.pathname);
      console.log("Redirecting to reset password page with params");
      navigate('/reset-password' + window.location.search + window.location.hash, { replace: true });
    }
  }, [location.pathname, navigate]);

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={location.pathname}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        transition={{ duration: 0.3 }}
      >
        <Routes location={location}>
          {/* Public routes - accessible to everyone */}
          <Route path="/" element={<Landing />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/legal" element={<Legal />} />
          
          {/* Auth routes - redirect to dashboard if logged in */}
          <Route path="/login" element={
            <AuthRoute>
              <AuthUI defaultTab="signin" />
            </AuthRoute>
          } />
          <Route path="/signup" element={
            <AuthRoute>
              <AuthUI defaultTab="signup" />
            </AuthRoute>
          } />
          <Route path="/forgot-password" element={
            <AuthRoute>
              <ForgotPassword />
            </AuthRoute>
          } />
          
          {/* Password reset routes - special handling for all possible URL formats */}
          <Route path="/reset-password" element={
            <PasswordResetRoute>
              <ResetPassword />
            </PasswordResetRoute>
          } />
          <Route path="/reset-password/:code" element={
            <PasswordResetRoute>
              <ResetPassword />
            </PasswordResetRoute>
          } />
          <Route path="/reset-password/:code/:restOfPath" element={
            <PasswordResetRoute>
              <ResetPassword />
            </PasswordResetRoute>
          } />
          
          {/* Protected routes - require authentication */}
          <Route path="/dashboard" element={
            <ProtectedRoute>
              <Index />
            </ProtectedRoute>
          } />
          
          {/* Fallback route */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </motion.div>
    </AnimatePresence>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <BrowserRouter>
      <LanguageProvider>
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
          <AuthProvider>
            <TooltipProvider>
              <Toaster />
              <Sonner />
              <AnimatedRoutes />
            </TooltipProvider>
          </AuthProvider>
        </ThemeProvider>
      </LanguageProvider>
    </BrowserRouter>
  </QueryClientProvider>
);

export default App;
