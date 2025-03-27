import React, { useState } from "react";
import { BarChart3, CheckSquare, Users, Building } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar as CalendarIcon } from "lucide-react";
import { Calendar } from "@/components/Calendar/Calendar";
import { TaskList } from "@/components/TaskList"; // Import from root components directory
import { CustomerList } from "@/components/crm/CustomerList"; 
import { useLanguage } from "@/contexts/LanguageContext";
import { motion } from "framer-motion";
import { BusinessDashboard } from "@/pages/BusinessDashboard";
import { Statistics } from "@/components/Statistics";

export const DashboardContent = ({
  isTaskDialogOpen,
  setIsTaskDialogOpen,
}: {
  isTaskDialogOpen: boolean;
  setIsTaskDialogOpen: React.Dispatch<React.SetStateAction<boolean>>;
}) => {
  const [activeTab, setActiveTab] = useState("calendar");
  const { t } = useLanguage();

  const renderContent = () => {
    switch (activeTab) {
      case "calendar":
        return <Calendar />;
      case "statistics":
        return <Statistics />;
      case "tasks":
        return <TaskList />;
      case "crm":
        return <CustomerList />;
      case "business":
        return <BusinessDashboard />;
      default:
        return <Calendar />;
    }
  };

  return (
    <div className="container mx-auto py-4">
      <div className="mb-6 border-b pb-2">
        <nav className="flex flex-wrap gap-2">
          <Button
            variant={activeTab === "calendar" ? "default" : "ghost"}
            className="gap-2"
            onClick={() => setActiveTab("calendar")}
          >
            <CalendarIcon className="h-4 w-4" />
            {t("dashboard.bookingCalendar")}
          </Button>
          <Button
            variant={activeTab === "statistics" ? "default" : "ghost"}
            className="gap-2"
            onClick={() => setActiveTab("statistics")}
          >
            <BarChart3 className="h-4 w-4" />
            {t("dashboard.statistics")}
          </Button>
          <Button
            variant={activeTab === "tasks" ? "default" : "ghost"}
            className="gap-2"
            onClick={() => setActiveTab("tasks")}
          >
            <CheckSquare className="h-4 w-4" />
            {t("dashboard.tasks")}
          </Button>
          <Button
            variant={activeTab === "crm" ? "default" : "ghost"}
            className="gap-2"
            onClick={() => setActiveTab("crm")}
          >
            <Users className="h-4 w-4" />
            {t("dashboard.crm")}
          </Button>
          <Button
            variant={activeTab === "business" ? "default" : "ghost"}
            className="gap-2"
            onClick={() => setActiveTab("business")}
          >
            <Building className="h-4 w-4" />
            {t("business.myBusiness")}
          </Button>
        </nav>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        transition={{ duration: 0.3 }}
        key={activeTab}
      >
        {renderContent()}
      </motion.div>
    </div>
  );
};
