
import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TaskList } from "../TaskList";
import AddTaskForm from "../AddTaskForm";
import { NoteList } from "../NoteList";
import { AddNoteForm } from "../AddNoteForm";
import { ReminderList } from "../ReminderList";
import { AddReminderForm } from "../AddReminderForm";
import { Calendar } from "../Calendar/Calendar";
import { Statistics } from "../Statistics";
import { Plus, Calendar as CalendarIcon, BarChart3, CheckSquare, FileText, Bell, Settings } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { GeorgianAuthText } from "../shared/GeorgianAuthText";
import { LanguageText } from "../shared/LanguageText";
import { ReminderTestPanel } from "../debug/ReminderTestPanel";

export const DashboardContent = () => {
  const { language } = useLanguage();
  const isGeorgian = language === 'ka';
  const [activeTab, setActiveTab] = useState("calendar");
  const [showAddTask, setShowAddTask] = useState(false);
  const [showAddNote, setShowAddNote] = useState(false);
  const [showAddReminder, setShowAddReminder] = useState(false);
  const [showDebugPanel, setShowDebugPanel] = useState(false);

  const tabs = [
    { id: "calendar", label: isGeorgian ? "კალენდარი" : "Calendar", icon: CalendarIcon },
    { id: "tasks", label: isGeorgian ? "ამოცანები" : "Tasks", icon: CheckSquare },
    { id: "notes", label: isGeorgian ? "ჩანაწერები" : "Notes", icon: FileText },
    { id: "reminders", label: isGeorgian ? "შეხსენებები" : "Reminders", icon: Bell },
    { id: "statistics", label: isGeorgian ? "სტატისტიკა" : "Statistics", icon: BarChart3 },
    { id: "debug", label: "Debug", icon: Settings },
  ];

  const georgianStyle = isGeorgian ? {
    fontFamily: "'BPG Glaho WEB Caps', 'DejaVu Sans', 'Arial Unicode MS', sans-serif",
    letterSpacing: '-0.2px',
    WebkitFontSmoothing: 'antialiased' as const,
    MozOsxFontSmoothing: 'grayscale' as const
  } : undefined;

  const renderContent = () => {
    switch (activeTab) {
      case "calendar":
        return <Calendar />;
      case "tasks":
        return (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-bold" style={georgianStyle}>
                {isGeorgian ? <GeorgianAuthText>ამოცანები</GeorgianAuthText> : <LanguageText>Tasks</LanguageText>}
              </h2>
              <Button onClick={() => setShowAddTask(true)} style={georgianStyle}>
                <Plus className="h-4 w-4 mr-2" />
                {isGeorgian ? <GeorgianAuthText>ახალი ამოცანა</GeorgianAuthText> : <LanguageText>Add Task</LanguageText>}
              </Button>
            </div>
            <TaskList />
            {showAddTask && (
              <AddTaskForm />
            )}
          </div>
        );
      case "notes":
        return (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-bold" style={georgianStyle}>
                {isGeorgian ? <GeorgianAuthText>ჩანაწერები</GeorgianAuthText> : <LanguageText>Notes</LanguageText>}
              </h2>
              <Button onClick={() => setShowAddNote(true)} style={georgianStyle}>
                <Plus className="h-4 w-4 mr-2" />
                {isGeorgian ? <GeorgianAuthText>ახალი ჩანაწერი</GeorgianAuthText> : <LanguageText>Add Note</LanguageText>}
              </Button>
            </div>
            <NoteList />
            {showAddNote && (
              <AddNoteForm />
            )}
          </div>
        );
      case "reminders":
        return (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-bold" style={georgianStyle}>
                {isGeorgian ? <GeorgianAuthText>შეხსენებები</GeorgianAuthText> : <LanguageText>Reminders</LanguageText>}
              </h2>
              <Button onClick={() => setShowAddReminder(true)} style={georgianStyle}>
                <Plus className="h-4 w-4 mr-2" />
                {isGeorgian ? <GeorgianAuthText>ახალი შეხსენება</GeorgianAuthText> : <LanguageText>Add Reminder</LanguageText>}
              </Button>
            </div>
            <ReminderList />
            {showAddReminder && (
              <AddReminderForm />
            )}
          </div>
        );
      case "statistics":
        return <Statistics />;
      case "debug":
        return (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold">Debug Panel</h2>
            <ReminderTestPanel />
          </div>
        );
      default:
        return <Calendar />;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="md:hidden">
        <Card>
          <CardHeader>
            <CardTitle style={georgianStyle}>
              {isGeorgian ? <GeorgianAuthText>ნავიგაცია</GeorgianAuthText> : <LanguageText>Navigation</LanguageText>}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <nav className="grid gap-4">
              {tabs.map((tab) => (
                <Button
                  key={tab.id}
                  variant={activeTab === tab.id ? "default" : "outline"}
                  className="justify-start"
                  onClick={() => setActiveTab(tab.id)}
                  style={georgianStyle}
                >
                  <tab.icon className="h-4 w-4 mr-2" />
                  {tab.label}
                </Button>
              ))}
            </nav>
          </CardContent>
        </Card>
      </div>
      
      <div className="flex">
        <div className="w-64 bg-card border-r h-screen sticky top-0 hidden md:block">
          <nav className="p-4 space-y-2">
            {tabs.map((tab) => (
              <Button
                key={tab.id}
                variant={activeTab === tab.id ? "default" : "ghost"}
                className="w-full justify-start"
                onClick={() => setActiveTab(tab.id)}
                style={georgianStyle}
              >
                <tab.icon className="h-4 w-4 mr-3" />
                {tab.label}
              </Button>
            ))}
          </nav>
        </div>
        
        <div className="flex-1 p-6">
          {renderContent()}
        </div>
      </div>
    </div>
  );
};
