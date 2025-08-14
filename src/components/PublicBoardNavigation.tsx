import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { motion, AnimatePresence } from "framer-motion";
import { CalendarIcon, BarChart, Users, ListTodo } from "lucide-react";
import { useSubUserPermissions } from "@/hooks/useSubUserPermissions";
import { useLanguage } from "@/contexts/LanguageContext";
import { PublicTaskList } from "@/components/tasks/PublicTaskList";
import { PermissionGate } from "@/components/PermissionGate";
import { Calendar } from "@/components/Calendar/Calendar";
import { Statistics } from "@/components/Statistics";
import { CRMWithPermissions } from "@/components/crm/CRMWithPermissions";
import { LanguageText } from "@/components/shared/LanguageText";
import { GeorgianAuthText } from "@/components/shared/GeorgianAuthText";

interface PublicBoardNavigationProps {
  boardId: string;
  boardUserId: string;
  accessToken: string;
  fullName: string;
  email: string;
}

const tabVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: { 
    opacity: 1, 
    y: 0,
    transition: { duration: 0.3 }
  },
  exit: { 
    opacity: 0, 
    y: -10,
    transition: { duration: 0.2 }
  }
};

const cardVariants = {
  hidden: { opacity: 0, scale: 0.95 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { duration: 0.3 }
  }
};

export const PublicBoardNavigation = ({ 
  boardId, 
  boardUserId,
  accessToken, 
  fullName, 
  email 
}: PublicBoardNavigationProps) => {
  const { hasPermission, loading, isSubUser } = useSubUserPermissions();
  const { t, language } = useLanguage();
  const [activeTab, setActiveTab] = useState("tasks");
  const isGeorgian = language === 'ka';

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[200px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Count available tabs
  const availableTabs = [
    { id: "tasks", label: isGeorgian ? "დავალებები" : t("dashboard.tasks"), icon: ListTodo, always: true },
    { id: "calendar", label: t("dashboard.bookingCalendar"), icon: CalendarIcon, permission: "calendar" as const },
    { id: "crm", label: isGeorgian ? "მომხმარებლების მართვა" : t("dashboard.crm"), icon: Users, permission: "crm" as const },
    { id: "statistics", label: isGeorgian ? "სტატისტიკა" : t("dashboard.statistics"), icon: BarChart, permission: "statistics" as const }
  ].filter(tab => tab.always || hasPermission(tab.permission!));

  // If only task board is available, show just the task list without tabs
  if (availableTabs.length === 1) {
    return (
      <div className="w-full max-w-[95%] xl:max-w-[92%] 2xl:max-w-[90%] mx-auto">
            <PublicTaskList 
              boardUserId={boardUserId}
              externalUserName={fullName}
              externalUserEmail={email}
              onlineUsers={[]}
            />
      </div>
    );
  }

  return (
    <div className="w-full max-w-[95%] xl:max-w-[92%] 2xl:max-w-[90%] mx-auto">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <div className="bg-muted/50 border border-border/60 rounded-lg p-1 mb-2">
          <TabsList className="grid w-full bg-transparent p-0 gap-1 h-auto" style={{ gridTemplateColumns: `repeat(${availableTabs.length}, minmax(0, 1fr))` }}>
            {availableTabs.map((tab) => (
              <TabsTrigger 
                key={tab.id}
                value={tab.id}
                className="flex items-center gap-2 text-sm sm:text-base text-foreground transition-all duration-300 hover:scale-105 active:scale-95 bg-transparent rounded-md px-3 py-2 hover:bg-muted/80 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm data-[state=active]:scale-[1.02]"
              >
                <motion.div
                  whileHover={{ rotate: 15 }}
                  transition={{ duration: 0.2 }}
                >
                  <tab.icon className="w-4 h-4" />
                </motion.div>
                <span className="hidden sm:inline">
                  {tab.id === "tasks" && isGeorgian ? (
                    <GeorgianAuthText>დავალებები</GeorgianAuthText>
                  ) : tab.id === "crm" && isGeorgian ? (
                    <GeorgianAuthText>მომხმარებლების მართვა</GeorgianAuthText>
                  ) : tab.id === "statistics" && isGeorgian ? (
                    <GeorgianAuthText fontWeight="normal" letterSpacing="-0.5px">სტატისტიკა</GeorgianAuthText>
                  ) : (
                    <LanguageText>{tab.label}</LanguageText>
                  )}
                </span>
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        <AnimatePresence mode="wait">
          <TabsContent key="tasks" value="tasks" className="mt-0">
            <motion.div
              variants={tabVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
            >
              <motion.div
                variants={cardVariants}
                initial="hidden"
                animate="visible"
              >
                <PublicTaskList 
                  boardUserId={boardUserId}
                  externalUserName={fullName}
                  externalUserEmail={email}
                  onlineUsers={[]}
                />
              </motion.div>
            </motion.div>
          </TabsContent>

          {hasPermission("calendar") && (
            <TabsContent key="calendar" value="calendar" className="mt-0">
              <motion.div
                variants={tabVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
              >
                <Card className="min-h-[calc(100vh-12rem)] overflow-hidden">
                  <CardContent className="p-0">
                    <div className="px-6 pt-6">
                      <motion.div
                        variants={cardVariants}
                        initial="hidden"
                        animate="visible"
                      >
                        <PermissionGate requiredPermission="calendar">
                          <Calendar defaultView="month" />
                        </PermissionGate>
                      </motion.div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            </TabsContent>
          )}

          {hasPermission("statistics") && (
            <TabsContent key="statistics" value="statistics">
              <motion.div
                variants={tabVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
              >
                <Card className="min-h-[calc(100vh-12rem)]">
                  <CardHeader>
                    <CardTitle>
                      {isGeorgian ? (
                        <GeorgianAuthText fontWeight="normal" letterSpacing="-0.5px">სტატისტიკა</GeorgianAuthText>
                      ) : (
                        <LanguageText>{t("dashboard.statistics")}</LanguageText>
                      )}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <motion.div
                      variants={cardVariants}
                      initial="hidden"
                      animate="visible"
                    >
                      <PermissionGate requiredPermission="statistics">
                        <Statistics />
                      </PermissionGate>
                    </motion.div>
                  </CardContent>
                </Card>
              </motion.div>
            </TabsContent>
          )}

          {hasPermission("crm") && (
            <TabsContent key="crm" value="crm">
              <motion.div
                variants={tabVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
              >
                <Card className="min-h-[calc(100vh-12rem)]">
                  <CardHeader>
                    <CardTitle>
                      {isGeorgian ? (
                        <GeorgianAuthText>მომხმარებლების მართვა</GeorgianAuthText>
                      ) : (
                        <LanguageText>{t("dashboard.crm")}</LanguageText>
                      )}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <motion.div
                      variants={cardVariants}
                      initial="hidden"
                      animate="visible"
                    >
                      <PermissionGate requiredPermission="crm">
                        <CRMWithPermissions />
                      </PermissionGate>
                    </motion.div>
                  </CardContent>
                </Card>
              </motion.div>
            </TabsContent>
          )}
        </AnimatePresence>
      </Tabs>
    </div>
  );
};