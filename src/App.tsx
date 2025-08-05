import {
  BrowserRouter as Router,
} from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { AuthProvider } from "./contexts/AuthContext";
import { LanguageProvider } from "./contexts/LanguageContext";
import { Toaster } from "@/components/ui/toaster"
import './i18n';

import MainRoutes from "./MainRoutes";
import { ReminderManager } from '@/components/ReminderManager';

const queryClient = new QueryClient();

function App() {
  return (
    <Router>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
          <AuthProvider>
            <LanguageProvider>
              <div className="min-h-screen bg-background font-sans antialiased">
                <Toaster />
                <ReminderManager />
                <MainRoutes />
              </div>
            </LanguageProvider>
          </AuthProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </Router>
  );
}

export default App;
