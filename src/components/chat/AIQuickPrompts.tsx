import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Calendar, MessageSquare, Search, Bot, ChevronDown, ChevronUp, BookOpen } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuPortal,
} from "@/components/ui/dropdown-menu";
import { useLanguage } from '@/contexts/LanguageContext';

interface AIQuickPromptsProps {
  onPromptSelect: (prompt: string) => void;
}

export function AIQuickPrompts({ onPromptSelect }: AIQuickPromptsProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const { t } = useLanguage();

  const pageGuides = [
    { label: "📅 Calendar Guide", prompt: t('quickActions.calendarGuidePrompt') },
    { label: "👥 CRM Guide", prompt: t('quickActions.crmGuidePrompt') },
    { label: "✅ Tasks Guide", prompt: t('quickActions.tasksGuidePrompt') },
    { label: "🏢 Business Page Guide", prompt: t('quickActions.businessGuidePrompt') },
    { label: "📊 Statistics Guide", prompt: t('quickActions.statisticsGuidePrompt') },
    { label: "💬 Chat Guide", prompt: t('quickActions.chatGuidePrompt') },
    { label: t('quickActions.allPages'), prompt: t('quickActions.allPagesPrompt') },
  ];

  const prompts = [
    { 
      label: t('quickActions.scheduleReminder'),
      text: t('quickActions.scheduleReminderPrompt'),
      icon: Calendar
    },
    { 
      label: t('quickActions.todaySchedule'),
      text: t('quickActions.todaySchedulePrompt'),
      icon: Calendar
    },
    { 
      label: t('quickActions.findCustomer'),
      text: t('quickActions.findCustomerPrompt'),
      icon: Search
    },
    { 
      label: t('quickActions.taskProgress'),
      text: t('quickActions.taskProgressPrompt'),
      icon: Calendar
    },
    { 
      label: t('quickActions.paymentSummary'),
      text: t('quickActions.paymentSummaryPrompt'),
      icon: MessageSquare
    },
    { 
      label: t('quickActions.excelReport'),
      text: t('quickActions.excelReportPrompt'),
      icon: Bot
    },
    { 
      label: t('quickActions.analyzeDocument'),
      text: t('quickActions.analyzeDocumentPrompt'),
      icon: Search
    },
    { 
      label: t('quickActions.sendEmailForMe'),
      text: t('quickActions.sendEmailPrompt'),
      icon: MessageSquare
    },
  ];

  return (
    <div className="border-t bg-muted/30">
      <div className="flex items-center justify-between px-3 py-1.5 cursor-pointer hover:bg-muted/50" onClick={() => setIsExpanded(!isExpanded)}>
        <div className="text-xs text-muted-foreground font-medium">Quick Actions</div>
        <Button variant="ghost" size="sm" className="h-5 w-5 p-0">
          {isExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronUp className="h-3.5 w-3.5" />}
        </Button>
      </div>
      
      {isExpanded && (
        <div className="px-2 pb-2 space-y-1.5">
          {/* Top row: Page Guides and Add for me dropdowns */}
          <div className="grid grid-cols-2 gap-1.5">
            {/* Page Guides dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="text-[10px] h-7 px-2 justify-start">
                  <BookOpen className="h-3 w-3 mr-1 flex-shrink-0" />
                  <span className="truncate">{t('quickActions.pageGuides')}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuPortal>
                <DropdownMenuContent align="start" className="w-56 bg-background/95 backdrop-blur-sm border border-border shadow-lg z-[99999]">
                  {pageGuides.map(guide => (
                    <DropdownMenuItem 
                      key={guide.label}
                      onClick={() => onPromptSelect(guide.prompt)}
                      className="cursor-pointer hover:bg-muted"
                    >
                      {guide.label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenuPortal>
            </DropdownMenu>

            {/* Add for me dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="text-[10px] h-7 px-2 justify-start">
                  <span className="truncate">{t('quickActions.addForMe')}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuPortal>
                <DropdownMenuContent align="start" className="w-48 bg-background/95 backdrop-blur-sm border border-border shadow-lg z-[99999]">
                  <DropdownMenuItem 
                    onClick={() => onPromptSelect(t('quickActions.addEventPrompt'))}
                    className="cursor-pointer hover:bg-muted"
                  >
                    {t('quickActions.addEvent')}
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    onClick={() => onPromptSelect(t('quickActions.addTaskPrompt'))}
                    className="cursor-pointer hover:bg-muted"
                  >
                    {t('quickActions.addTask')}
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    onClick={() => onPromptSelect(t('quickActions.addCustomerPrompt'))}
                    className="cursor-pointer hover:bg-muted"
                  >
                    {t('quickActions.addCustomer')}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenuPortal>
            </DropdownMenu>
          </div>

          {/* Compact grid layout for all quick actions */}
          <div className="grid grid-cols-2 gap-1.5">
            {prompts.map(p => {
              const Icon = p.icon;
              return (
                <Button
                  key={p.label}
                  variant="outline"
                  size="sm"
                  onClick={() => onPromptSelect(p.text)}
                  className="text-[10px] h-7 px-2 justify-start"
                >
                  <Icon className="h-3 w-3 mr-1 flex-shrink-0" />
                  <span className="truncate">{p.label}</span>
                </Button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
