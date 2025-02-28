
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

// Helper to check if URL has recovery parameters
const hasRecoveryParams = () => {
  const hasCode = window.location.search.includes('code=');
  const hasAccessToken = window.location.hash.includes('access_token=');
  const hasTokenHash = window.location.search.includes('token_hash=');
  const hasRecoveryType = window.location.search.includes('type=recovery');
  
  const result = hasCode || hasAccessToken || hasTokenHash || hasRecoveryType;
  
  if (result) {
    console.log("Password reset parameters detected:", {
      hasCode,
      hasAccessToken,
      hasTokenHash,
      hasRecoveryType
    });
  }
  
  return result;
};

// Protected routes - require authentication
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  
  // Check if we're coming from a password reset flow
  useEffect(() => {
    if (hasRecoveryParams() || searchParams.has('code')) {
      console.log("Recovery parameters detected in protected route, redirecting to reset password");
      navigate('/reset-password' + window.location.search + window.location.hash, { replace: true });
    }
  }, [navigate, searchParams]);
  
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
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  
  // Check if we're coming from a password reset flow
  useEffect(() => {
    if (hasRecoveryParams() || searchParams.has('code')) {
      console.log("Recovery parameters detected in auth route, redirecting to reset password");
      navigate('/reset-password' + window.location.search + window.location.hash, { replace: true });
      return;
    }
  }, [navigate, searchParams]);
  
  if (user && !hasRecoveryParams() && !searchParams.has('code')) {
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
  const [searchParams] = useSearchParams();
  
  // Global handler for recovery links
  useEffect(() => {
    // Run this once on initial load
    if ((hasRecoveryParams() || searchParams.has('code')) && location.pathname !== '/reset-password') {
      console.log("Recovery parameters detected, redirecting to reset password page");
      navigate('/reset-password' + window.location.search + window.location.hash, { replace: true });
    }
  }, [location.pathname, navigate, searchParams]);

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
          
          {/* Password reset route - special handling */}
          <Route path="/reset-password" element={
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
