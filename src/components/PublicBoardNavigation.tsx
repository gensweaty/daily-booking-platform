import { useState, useEffect, createContext, useContext } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { motion, AnimatePresence } from "framer-motion";
import { CalendarIcon, BarChart, Users, ListTodo } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { PublicTaskList } from "@/components/tasks/PublicTaskList";
import { PublicCalendar } from "@/components/PublicCalendar";
import { PublicCRM } from "@/components/PublicCRM";
import { PublicStatistics } from "@/components/PublicStatistics";
import { LanguageText } from "@/components/shared/LanguageText";
import { GeorgianAuthText } from "@/components/shared/GeorgianAuthText";
import { PresenceAvatars } from "@/components/PresenceAvatars";
import { supabase } from "@/lib/supabase";

// Create a context for public board auth
export const PublicBoardAuthContext = createContext<{
  user: { id: string; email: string } | null;
}>({
  user: null,
});

export const usePublicBoardAuth = () => useContext(PublicBoardAuthContext);

interface PublicBoardNavigationProps {
  boardId: string;
  boardUserId: string;
  accessToken: string;
  fullName: string;
  email: string;
  onlineUsers: { name: string; email: string }[];
}

interface SubUserPermissions {
  calendar_permission: boolean;
  crm_permission: boolean;
  statistics_permission: boolean;
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
  email,
  onlineUsers
}: PublicBoardNavigationProps) => {
  const { t, language } = useLanguage();
  const [activeTab, setActiveTab] = useState("tasks");
  const [permissions, setPermissions] = useState<SubUserPermissions>({
    calendar_permission: false,
    crm_permission: false,
    statistics_permission: false,
  });
  const [loading, setLoading] = useState(true);
  const [isSubUser, setIsSubUser] = useState(false);
  const isGeorgian = language === 'ka';

  useEffect(() => {
    const fetchPermissions = async () => {
      if (!email || !boardUserId) {
        setLoading(false);
        return;
      }

      try {
        // Check if this user is a sub-user for this board
        const { data: subUserData, error } = await supabase
          .from('sub_users')
          .select('calendar_permission, crm_permission, statistics_permission')
          .eq('board_owner_id', boardUserId)
          .ilike('email', email.trim().toLowerCase())
          .maybeSingle();

        if (error) {
          console.error("Error checking sub user permissions:", error);
          // If error, assume not a sub-user (admin)
          setIsSubUser(false);
          setPermissions({
            calendar_permission: true,
            crm_permission: true,
            statistics_permission: true,
          });
        } else if (subUserData) {
          // User is a sub-user
          setIsSubUser(true);
          setPermissions({
            calendar_permission: subUserData.calendar_permission || false,
            crm_permission: subUserData.crm_permission || false,
            statistics_permission: subUserData.statistics_permission || false,
          });
        } else {
          // User is not found as sub-user, assume admin
          setIsSubUser(false);
          setPermissions({
            calendar_permission: true,
            crm_permission: true,
            statistics_permission: true,
          });
        }
      } catch (error) {
        console.error("Error in fetchPermissions:", error);
        // On error, assume admin permissions
        setIsSubUser(false);
        setPermissions({
          calendar_permission: true,
          crm_permission: true,
          statistics_permission: true,
        });
      } finally {
        setLoading(false);
      }
    };

    fetchPermissions();
  }, [email, boardUserId]);

  const hasPermission = (permission: 'calendar' | 'crm' | 'statistics') => {
    if (!isSubUser) return true; // Admin has all permissions
    return permissions[`${permission}_permission`];
  };

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
      <PublicBoardAuthContext.Provider value={{ user: { id: boardUserId, email } }}>
        <div className="w-full max-w-[95%] xl:max-w-[92%] 2xl:max-w-[90%] mx-auto">
          <PublicTaskList 
            boardUserId={boardUserId}
            externalUserName={fullName}
            externalUserEmail={email}
            onlineUsers={onlineUsers}
          />
        </div>
      </PublicBoardAuthContext.Provider>
    );
  }

  return (
    <PublicBoardAuthContext.Provider value={{ user: { id: boardUserId, email } }}>
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
                    onlineUsers={onlineUsers}
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
                    <CardHeader className="flex flex-row items-center justify-between">
                      <CardTitle>
                        <LanguageText>{t("dashboard.bookingCalendar")}</LanguageText>
                      </CardTitle>
                      <div className="flex items-center gap-2">
                        <PresenceAvatars users={onlineUsers} max={5} />
                      </div>
                    </CardHeader>
                    <CardContent className="p-0">
                      <div className="px-6 pt-0">
                        <motion.div
                          variants={cardVariants}
                          initial="hidden"
                          animate="visible"
                        >
                          <PublicCalendar boardUserId={boardUserId} />
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
                    <CardHeader className="flex flex-row items-center justify-between">
                      <CardTitle>
                        {isGeorgian ? (
                          <GeorgianAuthText fontWeight="normal" letterSpacing="-0.5px">სტატისტიკა</GeorgianAuthText>
                        ) : (
                          <LanguageText>{t("dashboard.statistics")}</LanguageText>
                        )}
                      </CardTitle>
                      <div className="flex items-center gap-2">
                        <PresenceAvatars users={onlineUsers} max={5} />
                      </div>
                    </CardHeader>
                    <CardContent>
                      <motion.div
                        variants={cardVariants}
                        initial="hidden"
                        animate="visible"
                      >
                        <PublicStatistics boardUserId={boardUserId} />
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
                    <CardHeader className="flex flex-row items-center justify-between">
                      <CardTitle>
                        {isGeorgian ? (
                          <GeorgianAuthText>მომხმარებლების მართვა</GeorgianAuthText>
                        ) : (
                          <LanguageText>{t("dashboard.crm")}</LanguageText>
                        )}
                      </CardTitle>
                      <div className="flex items-center gap-2">
                        <PresenceAvatars users={onlineUsers} max={5} />
                      </div>
                    </CardHeader>
                    <CardContent>
                      <motion.div
                        variants={cardVariants}
                        initial="hidden"
                        animate="visible"
                      >
                        <PublicCRM boardUserId={boardUserId} />
                      </motion.div>
                    </CardContent>
                  </Card>
                </motion.div>
              </TabsContent>
            )}
          </AnimatePresence>
        </Tabs>
      </div>
    </PublicBoardAuthContext.Provider>
  );
};