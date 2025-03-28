
import React from 'react';
import {
  BrowserRouter as Router,
  Route,
  Routes,
} from 'react-router-dom';
import Index from './pages/Index';
import Contact from './pages/Contact';
import Legal from './pages/Legal';
import PublicBusinessPage from "@/pages/PublicBusinessPage";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { ForgotPassword } from "@/components/ForgotPassword";
import { ResetPassword } from "@/components/ResetPassword";

function App() {
  return (
    <LanguageProvider>
      <Router>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/dashboard" element={<Index />} />
          <Route path="/login" element={<Index />} /> 
          <Route path="/signup" element={<Index />} /> 
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/legal" element={<Legal />} />
          <Route path="/business/:slug" element={<PublicBusinessPage />} />
        </Routes>
      </Router>
    </LanguageProvider>
  );
}

export default App;
