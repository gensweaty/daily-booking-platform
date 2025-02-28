
import { Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from "@/components/ui/toaster";
import Landing from "@/pages/Landing";
import Index from "@/pages/Index";
import Contact from "@/pages/Contact";
import Legal from "@/pages/Legal";
import { ForgotPassword } from "@/components/ForgotPassword";
import { ResetPassword } from "@/components/ResetPassword";
import { AuthUI } from "@/components/AuthUI";
import { useEffect } from 'react';

import './App.css';

function App() {
  // Handle password reset URLs for direct access from email links
  useEffect(() => {
    // Special handling for reset password links
    // This is needed because Supabase may redirect with auth params
    const currentUrl = window.location.href;
    const hasResetParams = 
      currentUrl.includes('#access_token=') || 
      currentUrl.includes('?token_hash=') || 
      currentUrl.includes('type=recovery');
    
    // If we detect reset params but we're not on the reset page, redirect to it
    if (hasResetParams && !window.location.pathname.includes('/reset-password')) {
      console.log('Detected password reset parameters, redirecting to reset password page');
      // Preserve the full URL including hash and query params
      window.location.href = `${window.location.origin}/reset-password${window.location.search}${window.location.hash}`;
    }
  }, []);

  return (
    <>
      <Routes>
        {/* Auth routes */}
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/login" element={<AuthUI defaultTab="signin" />} />
        <Route path="/signup" element={<AuthUI defaultTab="signup" />} />
        
        {/* Main routes */}
        <Route path="/" element={<Landing />} />
        <Route path="/dashboard" element={<Index />} />
        <Route path="/contact" element={<Contact />} />
        <Route path="/legal" element={<Legal />} />
        
        {/* Fallback redirect */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <Toaster />
    </>
  );
}

export default App;
