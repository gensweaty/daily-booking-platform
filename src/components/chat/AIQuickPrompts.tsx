import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Calendar, MessageSquare, Search, Bot, ChevronDown, ChevronUp, BookOpen } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface AIQuickPromptsProps {
  onPromptSelect: (prompt: string) => void;
}

export function AIQuickPrompts({ onPromptSelect }: AIQuickPromptsProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  const pageGuides = [
    { label: "📅 Calendar Guide", prompt: "Show me the detailed Calendar page guide. I want to learn how to use the calendar feature." },
    { label: "👥 CRM Guide", prompt: "Show me the detailed CRM page guide. I want to learn how to manage customers." },
    { label: "✅ Tasks Guide", prompt: "Show me the detailed Tasks page guide. I want to learn how to use the task board." },
    { label: "🏢 Business Page Guide", prompt: "Show me the detailed Business Page guide. I want to learn how to set up my public booking page." },
    { label: "📊 Statistics Guide", prompt: "Show me the detailed Statistics page guide. I want to learn how to view analytics." },
    { label: "💬 Chat Guide", prompt: "Show me the detailed Chat page guide. I want to learn how to use team communication." },
    { label: "📖 All Pages", prompt: "Show me detailed guides for Calendar, CRM, Tasks, Business Page, Statistics, and Chat features. How do I use each page?" },
  ];

  const prompts = [
    { 
      label: "Schedule Reminder", 
      text: "Schedule a reminder for me",
      icon: Calendar
    },
    { 
      label: "Today's Schedule", 
      text: "What's on my schedule today?",
      icon: Calendar
    },
    { 
      label: "Find Customer", 
      text: "Search for a customer",
      icon: Search
    },
    { 
      label: "Task Progress", 
      text: "Show me my task completion rate and what's pending",
      icon: Calendar
    },
    { 
      label: "Payment Summary", 
      text: "Give me a summary of payments and revenue",
      icon: MessageSquare
    },
    { 
      label: "Excel Report", 
      text: "Generate an Excel report with my statistics and data",
      icon: Bot
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
          {/* Page Guides dropdown - full width */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="w-full text-xs h-7 justify-start">
                <BookOpen className="h-3 w-3 mr-1.5" />
                📖 Page Guides
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56 bg-popover border z-[9999]">
              {pageGuides.map(guide => (
                <DropdownMenuItem 
                  key={guide.label}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onPromptSelect(guide.prompt);
                  }}
                  className="cursor-pointer"
                >
                  {guide.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

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
