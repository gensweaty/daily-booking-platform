
import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { DashboardContent } from "@/components/dashboard/DashboardContent";
import { DashboardHeader } from "@/components/DashboardHeader";
import { useLanguage } from "@/contexts/LanguageContext";
import { SEOManager } from "@/components/SEOManager";
import { TrialExpiredDialog } from "@/components/TrialExpiredDialog";
import { ManageSubscriptionDialog } from "@/components/subscription/ManageSubscriptionDialog";
import { useSubscriptionRedirect } from "@/hooks/useSubscriptionRedirect";

export default function Index() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [activeSection, setActiveSection] = useState<"tasks" | "calendar">("tasks");
  const [showNav, setShowNav] = useState(false);
  const [isTrialExpiredDialogOpen, setIsTrialExpiredDialogOpen] = useState(false);
  const [isManageSubscriptionOpen, setIsManageSubscriptionOpen] = useState(false);

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

  const seoTitle = activeSection === "calendar" 
    ? t("dashboard.bookingCalendar")
    : t("dashboard.tasks");
  const seoDescription = activeSection === "calendar"
    ? "Manage your bookings and calendar events efficiently"
    : "Organize and track your tasks with our intuitive dashboard";

  return (
    <>
      <SEOManager 
        title={seoTitle}
        description={seoDescription}
        keywords="dashboard, tasks, calendar, bookings, productivity"
      />
      
      <div className="min-h-screen bg-background">
        <DashboardHeader 
          activeSection={activeSection}
          setActiveSection={handleSectionChange}
        />
        
        <DashboardContent 
          activeSection={activeSection}
          setActiveSection={handleSectionChange}
        />

        <TrialExpiredDialog 
          open={isTrialExpiredDialogOpen}
          onOpenChange={setIsTrialExpiredDialogOpen}
          onManageSubscription={() => {
            setIsTrialExpiredDialogOpen(false);
            setIsManageSubscriptionOpen(true);
          }}
        />

        <ManageSubscriptionDialog 
          open={isManageSubscriptionOpen}
          onOpenChange={setIsManageSubscriptionOpen}
        />
      </div>
    </>
  );
}
