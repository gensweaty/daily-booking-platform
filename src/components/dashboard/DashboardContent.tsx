import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/contexts/AuthContext";
import { CalendarView } from "@/components/Calendar/CalendarView";
import { TaskList } from "@/components/TaskList";
import { AddTaskForm } from "@/components/AddTaskForm";
import { ReminderList } from "@/components/ReminderList";
import { AddReminderForm } from "@/components/AddReminderForm";
import { NoteList } from "@/components/NoteList";
import { AddNoteForm } from "@/components/AddNoteForm";
import { Statistics } from "@/components/Statistics";
import { CustomerList } from "@/components/crm/CustomerList";
import { ExternalCalendar } from "@/components/Calendar/ExternalCalendar";
import { ArchivedTasksPage } from "@/components/tasks/ArchivedTasksPage";
import { TaskReminderNotifications } from "@/components/tasks/TaskReminderNotifications";
import { EventReminderNotifications } from "@/components/events/EventReminderNotifications"; // NEW
import { ReminderNotifications } from "@/components/reminder/ReminderNotifications";
import { useLanguage } from "@/contexts/LanguageContext";
import { Calendar, CheckSquare, Bell, FileText, BarChart3, Users, ExternalLink, Archive } from "lucide-react";

export const DashboardContent = () => {
  const { user } = useAuth();
  const { t, language } = useLanguage();
  const [activeTab, setActiveTab] = useState("calendar");

  useEffect(() => {
    const savedTab = localStorage.getItem('dashboard-active-tab');
    if (savedTab) {
      setActiveTab(savedTab);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('dashboard-active-tab', activeTab);
  }, [activeTab]);

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2">Please sign in</h2>
          <p className="text-muted-foreground">You need to be authenticated to access the dashboard.</p>
        </div>
      </div>
    );
  }

  const isGeorgian = language === 'ka';

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      {/* Background notification components */}
      <TaskReminderNotifications />
      <EventReminderNotifications /> {/* NEW - Add event reminder notifications */}
      <ReminderNotifications />
      
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">{t('dashboard.welcome')}</h1>
        <p className="text-muted-foreground">
          {t('dashboard.manageYourTasks')}
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-8 lg:grid-cols-8">
          <TabsTrigger value="calendar" className="flex items-center gap-2 text-xs">
            <Calendar className="h-4 w-4" />
            <span className="hidden sm:inline">{t('dashboard.calendar')}</span>
          </TabsTrigger>
          <TabsTrigger value="tasks" className="flex items-center gap-2 text-xs">
            <CheckSquare className="h-4 w-4" />
            <span className="hidden sm:inline">{t('dashboard.tasks')}</span>
          </TabsTrigger>
          <TabsTrigger value="reminders" className="flex items-center gap-2 text-xs">
            <Bell className="h-4 w-4" />
            <span className="hidden sm:inline">{t('dashboard.reminders')}</span>
          </TabsTrigger>
          <TabsTrigger value="notes" className="flex items-center gap-2 text-xs">
            <FileText className="h-4 w-4" />
            <span className="hidden sm:inline">{t('dashboard.notes')}</span>
          </TabsTrigger>
          <TabsTrigger value="crm" className="flex items-center gap-2 text-xs">
            <Users className="h-4 w-4" />
            <span className="hidden sm:inline">CRM</span>
          </TabsTrigger>
          <TabsTrigger value="analytics" className="flex items-center gap-2 text-xs">
            <BarChart3 className="h-4 w-4" />
            <span className="hidden sm:inline">{t('dashboard.analytics')}</span>
          </TabsTrigger>
          <TabsTrigger value="external" className="flex items-center gap-2 text-xs">
            <ExternalLink className="h-4 w-4" />
            <span className="hidden sm:inline">{t('dashboard.external')}</span>
          </TabsTrigger>
          <TabsTrigger value="archived" className="flex items-center gap-2 text-xs">
            <Archive className="h-4 w-4" />
            <span className="hidden sm:inline">{t('dashboard.archived')}</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="calendar">
          <Card>
            <CardHeader>
              <CardTitle>{t('dashboard.calendar')}</CardTitle>
              <CardDescription>
                {t('dashboard.manageEvents')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <CalendarView />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tasks">
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>{t('dashboard.addNewTask')}</CardTitle>
                <CardDescription>
                  {t('dashboard.createTaskDescription')}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <AddTaskForm />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>{t('dashboard.yourTasks')}</CardTitle>
                <CardDescription>
                  {t('dashboard.manageTasksDescription')}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <TaskList />
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="reminders">
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>{t('dashboard.addReminder')}</CardTitle>
                <CardDescription>
                  {t('dashboard.createReminderDescription')}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <AddReminderForm />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>{t('dashboard.yourReminders')}</CardTitle>
                <CardDescription>
                  {t('dashboard.manageRemindersDescription')}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ReminderList />
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="notes">
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>{t('dashboard.addNote')}</CardTitle>
                <CardDescription>
                  {t('dashboard.createNoteDescription')}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <AddNoteForm />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>{t('dashboard.yourNotes')}</CardTitle>
                <CardDescription>
                  {t('dashboard.manageNotesDescription')}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <NoteList />
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="crm">
          <Card>
            <CardHeader>
              <CardTitle>CRM - {t('dashboard.customerManagement')}</CardTitle>
              <CardDescription>
                {t('dashboard.manageCrm')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <CustomerList />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analytics">
          <Card>
            <CardHeader>
              <CardTitle>{t('dashboard.analytics')}</CardTitle>
              <CardDescription>
                {t('dashboard.viewAnalytics')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Statistics />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="external">
          <Card>
            <CardHeader>
              <CardTitle>{t('dashboard.externalCalendar')}</CardTitle>
              <CardDescription>
                {t('dashboard.shareCalendar')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ExternalCalendar />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="archived">
          <Card>
            <CardHeader>
              <CardTitle>{t('dashboard.archivedTasks')}</CardTitle>
              <CardDescription>
                {t('dashboard.viewArchivedTasks')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ArchivedTasksPage />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};
