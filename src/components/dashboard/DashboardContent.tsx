import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog"
import { PlusCircle, ListTodo, Calendar as CalendarIcon, BarChart, Users } from "lucide-react"
import { Button } from "@/components/ui/button"
import { TaskList } from "@/components/TaskList"
import { Calendar } from "@/components/Calendar/Calendar"
import { AddTaskForm } from "@/components/AddTaskForm"
import { Statistics } from "@/components/Statistics"
import { CustomerList } from "@/components/crm/CustomerList"
import { motion, AnimatePresence } from "framer-motion"

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
  return (
    <Tabs defaultValue="calendar" className="w-full max-w-[90%] xl:max-w-[85%] 2xl:max-w-[80%] mx-auto">
      <TabsList className="grid w-full grid-cols-4 mb-8">
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
          <span className="hidden sm:inline">Booking Calendar</span>
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
          <span className="hidden sm:inline">Statistics</span>
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
          <span className="hidden sm:inline">Tasks</span>
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
          <span className="hidden sm:inline">CRM</span>
        </TabsTrigger>
      </TabsList>

      <AnimatePresence mode="wait">
        <TabsContent value="calendar">
          <motion.div
            variants={tabVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
          >
            <Card className="min-h-[calc(100vh-12rem)] overflow-hidden">
              <CardContent className="pt-6 overflow-x-auto">
                <motion.div
                  variants={cardVariants}
                  initial="hidden"
                  animate="visible"
                >
                  <Calendar defaultView="month" />
                </motion.div>
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
                <CardTitle className="text-foreground">Statistics</CardTitle>
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
                <CardTitle className="text-foreground">My Tasks</CardTitle>
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
                      Add Task
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
      </AnimatePresence>
    </Tabs>
  )
}
