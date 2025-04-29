
import { useEffect, Suspense } from "react";
import { Routes, Route } from "react-router-dom";
import { Toaster } from "@/components/ui/toaster";
import { EnsureAuthProvider } from "@/components/EnsureAuth";
import { Loading } from "@/components/ui/loading";
import { ensureAllRequiredBuckets } from "@/integrations/supabase/checkStorage";

// Use lazy imports for routes
const Dashboard = React.lazy(() => import("@/pages/Dashboard"));
const Home = React.lazy(() => import("@/pages/Home"));
const Login = React.lazy(() => import("@/pages/Login"));
const NotFound = React.lazy(() => import("@/pages/NotFound"));
const Register = React.lazy(() => import("@/pages/Register"));
const PrivacyPolicy = React.lazy(() => import("@/pages/PrivacyPolicy"));
const TermsConditions = React.lazy(() => import("@/pages/TermsConditions"));
const BookingPage = React.lazy(() => import("@/pages/BookingPage"));

function App() {
  // Ensure storage buckets exist when app starts
  useEffect(() => {
    ensureAllRequiredBuckets().catch(error => 
      console.error("Failed to ensure all storage buckets exist:", error)
    );
  }, []);

  return (
    <>
      <Suspense fallback={<Loading />}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/privacy-policy" element={<PrivacyPolicy />} />
          <Route path="/terms-conditions" element={<TermsConditions />} />
          <Route path="/book/:slug" element={<BookingPage />} />
          <Route
            path="/dashboard/*"
            element={
              <EnsureAuthProvider>
                <Dashboard />
              </EnsureAuthProvider>
            }
          />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
      <Toaster />
    </>
  );
}

export default App;
