
import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { DashboardContent } from "@/components/dashboard/DashboardContent";
import { useSubscriptionRedirect } from "@/hooks/useSubscriptionRedirect";

const Index = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [activeSection, setActiveSection] = useState<"tasks" | "calendar">("tasks");
  
  // Handle subscription redirect
  useSubscriptionRedirect();

  useEffect(() => {
    if (!loading && !user) {
      navigate("/signin");
    }
  }, [user, loading, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return <DashboardContent activeSection={activeSection} setActiveSection={setActiveSection} />;
};

export default Index;
