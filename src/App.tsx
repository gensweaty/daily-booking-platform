
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { ThemeProvider } from '@/components/ui/theme-provider';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '@/contexts/AuthContext';
import { LanguageProvider } from '@/contexts/LanguageContext';
import { Toaster } from '@/components/ui/toaster';
import './App.css';
import Index from './pages/Index';
import { BusinessPage } from './pages/BusinessPage';
import Landing from './pages/Landing';
import Contact from './pages/Contact';
import Legal from './pages/Legal';

// Create a client
const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router>
        <ThemeProvider defaultTheme="light">
          <AuthProvider>
            <LanguageProvider>
              <Routes>
                <Route path="/" element={<Landing />} />
                <Route path="/contact" element={<Contact />} />
                <Route path="/legal" element={<Legal />} />
                <Route path="/dashboard" element={<Index />} />
                <Route path="/signin" element={<Index />} />
                <Route path="/forgot-password" element={<Index />} />
                <Route path="/reset-password" element={<Index />} />
                <Route path="/business/:slug" element={<BusinessPage />} />
              </Routes>
              <Toaster />
            </LanguageProvider>
          </AuthProvider>
        </ThemeProvider>
      </Router>
    </QueryClientProvider>
  );
}

export default App;
