
import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { DashboardContent } from "@/components/dashboard/DashboardContent";
import { DashboardHeader } from "@/components/DashboardHeader";
import { useLanguage } from "@/contexts/LanguageContext";
import { useSubscriptionRedirect } from "@/hooks/useSubscriptionRedirect";

export default function Index() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [activeSection, setActiveSection] = useState<"tasks" | "calendar">("tasks");

  // Handle subscription redirects
  useSubscriptionRedirect();

  useEffect(() => {
    if (!user) {
      navigate("/signin");
      return;
    }
  }, [user, navigate]);

  if (!user) {
    return null;
  }

  const handleSectionChange = (section: string) => {
    setActiveSection(section as "tasks" | "calendar");
  };

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader 
        activeSection={activeSection}
        onSectionChange={handleSectionChange}
      />
      
      <DashboardContent 
        activeSection={activeSection}
        setActiveSection={handleSectionChange}
      />
    </div>
  );
}
