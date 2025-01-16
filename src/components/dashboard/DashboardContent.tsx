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

interface DashboardContentProps {
  isTaskDialogOpen: boolean
  setIsTaskDialogOpen: (open: boolean) => void
}

export const DashboardContent = ({ 
  isTaskDialogOpen, 
  setIsTaskDialogOpen 
}: DashboardContentProps) => {
  return (
    <Tabs defaultValue="calendar" className="w-full max-w-[90%] xl:max-w-[85%] 2xl:max-w-[80%] mx-auto">
      <TabsList className="grid w-full grid-cols-4 mb-8">
        <TabsTrigger value="calendar" className="flex items-center gap-2 text-sm sm:text-base text-foreground transition-all duration-200 hover:scale-105">
          <CalendarIcon className="w-4 h-4" />
          <span className="hidden sm:inline">Booking Calendar</span>
        </TabsTrigger>
        <TabsTrigger value="statistics" className="flex items-center gap-2 text-sm sm:text-base text-foreground transition-all duration-200 hover:scale-105">
          <BarChart className="w-4 h-4" />
          <span className="hidden sm:inline">Statistics</span>
        </TabsTrigger>
        <TabsTrigger value="tasks" className="flex items-center gap-2 text-sm sm:text-base text-foreground transition-all duration-200 hover:scale-105">
          <ListTodo className="w-4 h-4" />
          <span className="hidden sm:inline">Tasks</span>
        </TabsTrigger>
        <TabsTrigger value="crm" className="flex items-center gap-2 text-sm sm:text-base text-foreground transition-all duration-200 hover:scale-105">
          <Users className="w-4 h-4" />
          <span className="hidden sm:inline">CRM</span>
        </TabsTrigger>
      </TabsList>

      <TabsContent value="calendar" className="animate-fade-in">
        <Card className="min-h-[calc(100vh-12rem)]">
          <CardContent className="pt-6 overflow-x-auto">
            <Calendar defaultView="month" />
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="statistics" className="animate-fade-in">
        <Card className="min-h-[calc(100vh-12rem)]">
          <CardHeader>
            <CardTitle className="text-foreground">Statistics</CardTitle>
          </CardHeader>
          <CardContent>
            <Statistics />
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="tasks" className="animate-fade-in">
        <Card className="min-h-[calc(100vh-12rem)]">
          <CardHeader className="flex flex-col sm:flex-row items-center justify-between space-y-4 sm:space-y-0">
            <CardTitle className="text-foreground">My Tasks</CardTitle>
            <Dialog open={isTaskDialogOpen} onOpenChange={setIsTaskDialogOpen}>
              <DialogTrigger asChild>
                <Button className="flex items-center gap-2 w-full sm:w-auto bg-primary hover:bg-primary/90 text-white transition-all duration-200 hover:scale-105">
                  <PlusCircle className="w-4 h-4" />
                  Add Task
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[425px] animate-scale-in">
                <AddTaskForm onClose={() => setIsTaskDialogOpen(false)} />
              </DialogContent>
            </Dialog>
          </CardHeader>
          <CardContent>
            <TaskList />
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="crm" className="animate-fade-in">
        <Card className="min-h-[calc(100vh-12rem)]">
          <CardContent className="pt-6">
            <CustomerList />
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  )
}