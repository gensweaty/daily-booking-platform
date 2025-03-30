
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/toaster";
import { AuthProvider } from "@/contexts/AuthContext";
import Index from "@/pages/Index";
import Landing from "@/pages/Landing";
import Legal from "@/pages/Legal";
import Contact from "@/pages/Contact";

function App() {
  return (
    <ThemeProvider defaultTheme="system" storageKey="vite-ui-theme">
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/dashboard" element={<Index />} />
            <Route path="/legal" element={<Legal />} />
            <Route path="/contact" element={<Contact />} />
            <Route path="/business/:slug" element={<Index />} />
          </Routes>
          <Toaster />
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
