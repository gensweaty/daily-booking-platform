import { useState, useEffect, createContext, useContext } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { motion, AnimatePresence } from "framer-motion";
import { CalendarIcon, BarChart, Users, ListTodo } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { PublicTaskList } from "@/components/tasks/PublicTaskList";
import { PublicCalendarList } from "@/components/calendar/PublicCalendarList";
import { PublicCRMList } from "@/components/crm/PublicCRMList";
import { PublicStatisticsList } from "@/components/statistics/PublicStatisticsList";
import { LanguageText } from "@/components/shared/LanguageText";
import { GeorgianAuthText } from "@/components/shared/GeorgianAuthText";
import { PresenceAvatars } from "@/components/PresenceAvatars";
import { supabase } from "@/lib/supabase";
import { TaskFiltersProvider } from "@/hooks/useTaskFilters";
import { PublicDynamicIsland } from "@/components/dashboard/PublicDynamicIsland";

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
  onlineUsers: { name: string; email: string; avatar_url?: string | null }[];
}

interface SubUserPermissions {
  tasks_permission: boolean;
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
  const [permissions, setPermissions] = useState<SubUserPermissions>({
    tasks_permission: true,
    calendar_permission: false,
    crm_permission: false,
    statistics_permission: false,
  });
  const [loading, setLoading] = useState(true);
  const [isSubUser, setIsSubUser] = useState(false);
  const isGeorgian = language === 'ka';
  
  const hasPermission = (permission: 'tasks' | 'calendar' | 'crm' | 'statistics') => {
    if (!isSubUser) return true; // Admin has all permissions
    return permissions[`${permission}_permission`];
  };
  
  // Build available tabs based on permissions - calendar first if available, then tasks
  const getAvailableTabs = () => {
    const allTabs = [
      { id: "calendar", label: t("dashboard.bookingCalendar"), icon: CalendarIcon, permission: "calendar" as const },
      { id: "tasks", label: isGeorgian ? "დავალებები" : t("dashboard.tasks"), icon: ListTodo, permission: "tasks" as const },
      { id: "crm", label: isGeorgian ? "მომხმარებლების მართვა" : t("dashboard.crm"), icon: Users, permission: "crm" as const },
      { id: "statistics", label: isGeorgian ? "სტატისტიკა" : t("dashboard.statistics"), icon: BarChart, permission: "statistics" as const }
    ];
    return allTabs.filter(tab => hasPermission(tab.permission));
  };
  
  // Compute available tabs
  const availableTabs = getAvailableTabs();
  
  // Set default to first available tab (calendar first if permission exists)
  const defaultTab = availableTabs.length > 0 ? availableTabs[0].id : "tasks";
  const [activeTab, setActiveTab] = useState<string>(defaultTab);

  useEffect(() => {
    const fetchPermissions = async () => {
      if (!email || !boardUserId) {
        setLoading(false);
        return;
      }

      try {
        console.log('🔍 Fetching permissions for:', { email, boardUserId });
        
        // Check if this user is a sub-user for this board
        const { data: subUserData, error } = await supabase
          .from('sub_users')
          .select('tasks_permission, calendar_permission, crm_permission, statistics_permission')
          .eq('board_owner_id', boardUserId)
          .ilike('email', email.trim().toLowerCase())
          .maybeSingle();
        console.log('📋 Sub-user data:', { subUserData, error });

        if (error) {
          console.error("Error checking sub user permissions:", error);
          // If error, assume not a sub-user (admin)
          setIsSubUser(false);
          setPermissions({
            tasks_permission: true,
            calendar_permission: true,
            crm_permission: true,
            statistics_permission: true,
          });
        } else if (subUserData) {
          // User is a sub-user
          setIsSubUser(true);
          // Use actual permissions from database
          const finalPermissions = {
            tasks_permission: subUserData.tasks_permission !== false,
            calendar_permission: subUserData.calendar_permission || false,
            crm_permission: subUserData.crm_permission || false,
            statistics_permission: subUserData.statistics_permission || false,
          };
          setPermissions(finalPermissions);
          console.log('✅ Sub-user found with permissions:', finalPermissions);
          console.log('🔍 Will pass to PublicCalendarList hasPermissions:', finalPermissions.calendar_permission);
        } else {
          // User is not found as sub-user, assume admin
          setIsSubUser(false);
          setPermissions({
            tasks_permission: true,
            calendar_permission: true,
            crm_permission: true,
            statistics_permission: true,
          });
          console.log('👤 Admin user detected');
        }
      } catch (error) {
        console.error("Error in fetchPermissions:", error);
        // On error, assume admin permissions
        setIsSubUser(false);
        setPermissions({
          tasks_permission: true,
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

  // Update activeTab when permissions change and current tab becomes unavailable
  useEffect(() => {
    if (!loading && availableTabs.length > 0) {
      const currentTabAvailable = availableTabs.some(tab => tab.id === activeTab);
      if (!currentTabAvailable) {
        setActiveTab(availableTabs[0].id);
      }
    }
  }, [loading, permissions, isSubUser]);

  // Listen for tab switch events from notification clicks
  useEffect(() => {
    const handleSwitchTab = (event: CustomEvent<{ tab: string }>) => {
      const { tab } = event.detail;
      // Check if the target tab is available
      const tabAvailable = availableTabs.some(t => t.id === tab);
      if (tabAvailable) {
        setActiveTab(tab);
      }
    };

    window.addEventListener('switch-public-tab', handleSwitchTab as EventListener);
    
    return () => {
      window.removeEventListener('switch-public-tab', handleSwitchTab as EventListener);
    };
  }, [availableTabs]);

  // Bridge DynamicIsland events -> ChatProvider events (public boards don't mount DashboardContent)
  useEffect(() => {
    const handleOpenAiChat = () => {
      window.dispatchEvent(new CustomEvent('open-chat-ai', {}));
    };

    const handleOpenChatChannel = (e: CustomEvent<{ channelId: string }>) => {
      const channelId = e.detail?.channelId;
      if (!channelId) return;
      window.dispatchEvent(new CustomEvent('chat-open-channel', { detail: { channelId } }));
    };

    window.addEventListener('open-ai-chat', handleOpenAiChat as EventListener);
    window.addEventListener('open-chat-channel', handleOpenChatChannel as EventListener);

    return () => {
      window.removeEventListener('open-ai-chat', handleOpenAiChat as EventListener);
      window.removeEventListener('open-chat-channel', handleOpenChatChannel as EventListener);
    };
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[200px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  // If only one page is available, show just that content without tabs
  if (availableTabs.length === 1) {
    const singleTab = availableTabs[0];
    return (
      <PublicBoardAuthContext.Provider value={{ user: { id: boardUserId, email } }}>
        <TaskFiltersProvider>
          <div className="w-full max-w-[98%] xl:max-w-[96%] 2xl:max-w-[94%] mx-auto">
            {/* Dynamic Island for sub-users */}
            <PublicDynamicIsland 
              username={fullName} 
              boardUserId={boardUserId}
            />
            
            {singleTab.id === 'tasks' && (
              <PublicTaskList
                boardUserId={boardUserId}
                externalUserName={fullName}
                externalUserEmail={email}
                onlineUsers={onlineUsers}
              />
            )}
            {singleTab.id === 'calendar' && (
              <Card className="min-h-[calc(100vh-12rem)] overflow-hidden">
                <CardContent className="p-6 pt-0">
                  <PublicCalendarList 
                    boardUserId={boardUserId}
                    externalUserName={fullName}
                    externalUserEmail={email}
                    onlineUsers={onlineUsers}
                    hasPermissions={true}
                  />
                </CardContent>
              </Card>
            )}
            {singleTab.id === 'crm' && (
              <Card className="min-h-[calc(100vh-12rem)]">
                <CardContent className="p-6 pt-0">
                  <PublicCRMList 
                    boardUserId={boardUserId}
                    externalUserName={fullName}
                    externalUserEmail={email}
                    onlineUsers={onlineUsers}
                    hasPermissions={true}
                  />
                </CardContent>
              </Card>
            )}
            {singleTab.id === 'statistics' && (
              <Card className="min-h-[calc(100vh-12rem)]">
                <CardContent className="p-6 pt-0">
                  <PublicStatisticsList 
                    boardUserId={boardUserId}
                    externalUserName={fullName}
                    externalUserEmail={email}
                    onlineUsers={onlineUsers}
                  />
                </CardContent>
              </Card>
            )}
          </div>
        </TaskFiltersProvider>
      </PublicBoardAuthContext.Provider>
    );
  }

  return (
    <PublicBoardAuthContext.Provider value={{ user: { id: boardUserId, email } }}>
      <TaskFiltersProvider>
        <div className="w-full max-w-[98%] xl:max-w-[96%] 2xl:max-w-[94%] mx-auto">
          {/* Dynamic Island for sub-users */}
          <PublicDynamicIsland 
            username={fullName} 
            boardUserId={boardUserId}
          />
          
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
            {hasPermission("tasks") && (
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
            )}

            {hasPermission("calendar") && (
              <TabsContent key="calendar" value="calendar" className="mt-0">
                <motion.div
                  variants={tabVariants}
                  initial="hidden"
                  animate="visible"
                  exit="exit"
                >
                  <Card className="min-h-[calc(100vh-12rem)] overflow-hidden">
                     <CardContent className="p-6 pt-0">
                         <motion.div
                           variants={cardVariants}
                           initial="hidden"
                           animate="visible"
                         >
                            <PublicCalendarList 
                              boardUserId={boardUserId}
                              externalUserName={fullName}
                              externalUserEmail={email}
                              onlineUsers={onlineUsers}
                              hasPermissions={(() => {
                                const result = hasPermission("calendar");
                                console.log('🔍 Passing hasPermissions to PublicCalendarList:', result, 'for email:', email);
                                return result;
                              })()}
                            />
                         </motion.div>
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
                     <CardContent className="p-6 pt-0">
                       <motion.div
                         variants={cardVariants}
                         initial="hidden"
                         animate="visible"
                       >
                         <PublicStatisticsList 
                           boardUserId={boardUserId}
                           externalUserName={fullName}
                           externalUserEmail={email}
                           onlineUsers={onlineUsers}
                         />
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
                     <CardContent className="p-6 pt-0">
                       <motion.div
                         variants={cardVariants}
                         initial="hidden"
                         animate="visible"
                       >
                          <PublicCRMList 
                            boardUserId={boardUserId}
                            externalUserName={fullName}
                            externalUserEmail={email}
                            onlineUsers={onlineUsers}
                            hasPermissions={!!permissions?.crm_permission}
                          />
                       </motion.div>
                    </CardContent>
                  </Card>
                </motion.div>
              </TabsContent>
            )}
          </AnimatePresence>
        </Tabs>
      </div>
      </TaskFiltersProvider>
    </PublicBoardAuthContext.Provider>
  );
};