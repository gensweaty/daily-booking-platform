
import React from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/toaster";
import { AuthProvider } from "@/contexts/AuthContext";
import Index from "@/pages/Index";
import Landing from "@/pages/Landing";
import Legal from "@/pages/Legal";
import Contact from "@/pages/Contact";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ResetPassword } from "@/components/ResetPassword";
import { PublicBusinessPage } from "@/components/business/PublicBusinessPage";
import { LanguageProvider } from "@/contexts/LanguageContext";

// Create a client for React Query
const queryClient = new QueryClient();

function App() {
  return (
    <React.StrictMode>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider defaultTheme="system" storageKey="vite-ui-theme">
          <LanguageProvider>
            <BrowserRouter>
              <AuthProvider>
                <Routes>
                  <Route path="/" element={<Landing />} />
                  <Route path="/dashboard" element={<Index />} />
                  <Route path="/legal" element={<Legal />} />
                  <Route path="/contact" element={<Contact />} />
                  <Route path="/reset-password" element={<ResetPassword />} />
                  <Route path="/business/:slug" element={<PublicBusinessPage />} />
                  <Route path="/login" element={<Index />} />
                  <Route path="/signup" element={<Index />} />
                </Routes>
                <Toaster />
              </AuthProvider>
            </BrowserRouter>
          </LanguageProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </React.StrictMode>
  );
}

export default App;
