import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog"
import { PlusCircle, ListTodo, Calendar as CalendarIcon, BarChart, Users, Briefcase, Bell } from "lucide-react"
import { Button } from "@/components/ui/button"
import { TaskList } from "@/components/TaskList"
import { Calendar } from "@/components/Calendar/Calendar"
import { AddTaskForm } from "@/components/AddTaskForm"
import { Statistics } from "@/components/Statistics"
import { CustomerList } from "@/components/crm/CustomerList"
import { BusinessPage } from "@/components/business/BusinessPage"
import { motion, AnimatePresence } from "framer-motion"
import { useLanguage } from "@/contexts/LanguageContext"
import { useBusinessProfile } from "@/hooks/useBusinessProfile"
import { useBookingRequests } from "@/hooks/useBookingRequests"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"
import { useEffect } from "react"
import { LanguageText } from "@/components/shared/LanguageText"
import { GeorgianAuthText } from "@/components/shared/GeorgianAuthText"
import { cn } from "@/lib/utils"

interface DashboardContentProps {
  isTaskDialogOpen: boolean
  setIsTaskDialogOpen: (open: boolean) => void
}

const tabVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: { 
    opacity: 1, 
    y: 0,
    transition: { duration: 0.3, ease: "easeOut" }
  },
  exit: { 
    opacity: 0, 
    y: -10,
    transition: { duration: 0.2 }
  }
}

const cardVariants = {
  hidden: { opacity: 0, scale: 0.95 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { duration: 0.3, ease: "easeOut" }
  }
}

export const DashboardContent = ({ 
  isTaskDialogOpen, 
  setIsTaskDialogOpen 
}: DashboardContentProps) => {
  const { t, language } = useLanguage()
  const { pendingRequests } = useBookingRequests()
  const { toast } = useToast()
  const pendingCount = pendingRequests?.length || 0
  const isGeorgian = language === 'ka'

  useEffect(() => {
    if (pendingCount > 0) {
      // Use the toast helper for booking requests with count parameter
      toast.event.newBookingRequest(pendingCount);
    }
  }, [pendingCount, toast])

  return (
    <Tabs defaultValue="calendar" className="w-full max-w-[95%] xl:max-w-[92%] 2xl:max-w-[90%] mx-auto">
      <TabsList className="grid w-full grid-cols-5 mb-2">
        <TabsTrigger 
          value="calendar" 
          className="flex items-center gap-2 text-sm sm:text-base text-foreground transition-all duration-300 hover:scale-105 active:scale-95"
        >
          <motion.div
            whileHover={{ rotate: 15 }}
            transition={{ duration: 0.2 }}
          >
            <CalendarIcon className="w-4 h-4" />
          </motion.div>
          <span className="hidden sm:inline">
            <LanguageText>{t("dashboard.bookingCalendar")}</LanguageText>
          </span>
        </TabsTrigger>
        <TabsTrigger 
          value="statistics" 
          className="flex items-center gap-2 text-sm sm:text-base text-foreground transition-all duration-300 hover:scale-105 active:scale-95"
        >
          <motion.div
            whileHover={{ rotate: 15 }}
            transition={{ duration: 0.2 }}
          >
            <BarChart className="w-4 h-4" />
          </motion.div>
          <span className="hidden sm:inline">
            {isGeorgian ? (
              <GeorgianAuthText fontWeight="normal" letterSpacing="-0.5px">სტატისტიკა</GeorgianAuthText>
            ) : (
              <LanguageText>{t("dashboard.statistics")}</LanguageText>
            )}
          </span>
        </TabsTrigger>
        <TabsTrigger 
          value="tasks" 
          className="flex items-center gap-2 text-sm sm:text-base text-foreground transition-all duration-300 hover:scale-105 active:scale-95"
        >
          <motion.div
            whileHover={{ rotate: 15 }}
            transition={{ duration: 0.2 }}
          >
            <ListTodo className="w-4 h-4" />
          </motion.div>
          <span className="hidden sm:inline">
            {isGeorgian ? (
              <GeorgianAuthText>დავალებები</GeorgianAuthText>
            ) : (
              <LanguageText>{t("dashboard.tasks")}</LanguageText>
            )}
          </span>
        </TabsTrigger>
        <TabsTrigger 
          value="crm" 
          className="flex items-center gap-2 text-sm sm:text-base text-foreground transition-all duration-300 hover:scale-105 active:scale-95"
        >
          <motion.div
            whileHover={{ rotate: 15 }}
            transition={{ duration: 0.2 }}
          >
            <Users className="w-4 h-4" />
          </motion.div>
          <span className="hidden sm:inline">
            {isGeorgian ? (
              <GeorgianAuthText>მომხმარებლების მართვა</GeorgianAuthText>
            ) : (
              <LanguageText>{t("dashboard.crm")}</LanguageText>
            )}
          </span>
        </TabsTrigger>
        <TabsTrigger 
          value="business" 
          className="flex items-center gap-2 text-sm sm:text-base text-foreground transition-all duration-300 hover:scale-105 active:scale-95 relative"
        >
          <motion.div
            whileHover={{ rotate: 15 }}
            transition={{ duration: 0.2 }}
          >
            <Briefcase className="w-4 h-4" />
          </motion.div>
          <span className="hidden sm:inline">
            {isGeorgian ? (
              <GeorgianAuthText>ჩემი ბიზნესი</GeorgianAuthText>
            ) : (
              <LanguageText>{t("business.myBusiness")}</LanguageText>
            )}
          </span>
          {pendingCount > 0 && (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 500, damping: 25 }}
              className="absolute top-1/2 -translate-y-1/2 right-0 transform -translate-x-full ml-1"
            >
              <Badge 
                variant="destructive" 
                className="flex items-center justify-center h-5 min-w-5 p-1 text-xs rounded-full gap-1"
              >
                <Bell className="w-3 h-3" />
                {pendingCount}
              </Badge>
            </motion.div>
          )}
        </TabsTrigger>
      </TabsList>

      <AnimatePresence mode="wait">
        <TabsContent value="calendar" className="mt-0">
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
                    <Calendar defaultView="month" />
                  </motion.div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </TabsContent>

        <TabsContent value="statistics">
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
                  <Statistics />
                </motion.div>
              </CardContent>
            </Card>
          </motion.div>
        </TabsContent>

        <TabsContent value="tasks">
          <motion.div
            variants={tabVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
          >
            <Card className="min-h-[calc(100vh-12rem)]">
              <CardHeader className="flex flex-col sm:flex-row items-center justify-between space-y-4 sm:space-y-0">
                <CardTitle>
                  {isGeorgian ? (
                    <GeorgianAuthText>დავალებები</GeorgianAuthText>
                  ) : (
                    <LanguageText>{t("dashboard.tasks")}</LanguageText>
                  )}
                </CardTitle>
                <Dialog open={isTaskDialogOpen} onOpenChange={setIsTaskDialogOpen}>
                  <DialogTrigger asChild>
                    <Button 
                      className="flex items-center gap-2 w-full sm:w-auto bg-primary hover:bg-primary/90 text-white transition-all duration-300 hover:scale-105 active:scale-95"
                    >
                      <motion.div
                        whileHover={{ rotate: 180 }}
                        transition={{ duration: 0.3 }}
                      >
                        <PlusCircle className="w-4 h-4" />
                      </motion.div>
                      <LanguageText>{t("tasks.addTask")}</LanguageText>
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-[425px]">
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ duration: 0.2 }}
                    >
                      <AddTaskForm onClose={() => setIsTaskDialogOpen(false)} />
                    </motion.div>
                  </DialogContent>
                </Dialog>
              </CardHeader>
              <CardContent>
                <motion.div
                  variants={cardVariants}
                  initial="hidden"
                  animate="visible"
                >
                  <TaskList />
                </motion.div>
              </CardContent>
            </Card>
          </motion.div>
        </TabsContent>

        <TabsContent value="crm">
          <motion.div
            variants={tabVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
          >
            <Card className="min-h-[calc(100vh-12rem)]">
              <CardContent className="pt-6">
                <motion.div
                  variants={cardVariants}
                  initial="hidden"
                  animate="visible"
                >
                  <CustomerList />
                </motion.div>
              </CardContent>
            </Card>
          </motion.div>
        </TabsContent>

        <TabsContent value="business">
          <motion.div
            variants={tabVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
          >
            <Card className="min-h-[calc(100vh-12rem)]">
              <CardContent className="pt-6">
                <motion.div
                  variants={cardVariants}
                  initial="hidden"
                  animate="visible"
                >
                  <BusinessPage />
                </motion.div>
              </CardContent>
            </Card>
          </motion.div>
        </TabsContent>
      </AnimatePresence>
    </Tabs>
  )
}
