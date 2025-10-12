import { Button } from '@/components/ui/button';
import { Calendar, MessageSquare, Search, Bot } from 'lucide-react';

interface AIQuickPromptsProps {
  onPromptSelect: (prompt: string) => void;
}

export function AIQuickPrompts({ onPromptSelect }: AIQuickPromptsProps) {
  const prompts = [
    { 
      label: "📖 Page Guides", 
      text: "Show me detailed guides for Calendar, CRM, Tasks, Business Page, Statistics, and Chat features. How do I use each page?",
      icon: Bot
    },
    { 
      label: "Today's Schedule", 
      text: "What's on my schedule today?",
      icon: Calendar
    },
    { 
      label: "This Week", 
      text: "Give me a summary of this week - events, tasks, and bookings",
      icon: MessageSquare
    },
    { 
      label: "Find Customer", 
      text: "Search for a customer",
      icon: Search
    },
    { 
      label: "Pending Bookings", 
      text: "How many booking requests need my approval?",
      icon: Bot
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
      label: "Free Time Slots", 
      text: "When am I free tomorrow?",
      icon: Search
    },
  ];

  return (
    <div className="border-t bg-muted/30 p-3">
      <div className="text-xs text-muted-foreground mb-2 font-medium">Quick Actions</div>
      <div className="flex flex-wrap gap-2">
        {prompts.map(p => {
          const Icon = p.icon;
          return (
            <Button
              key={p.label}
              variant="outline"
              size="sm"
              onClick={() => onPromptSelect(p.text)}
              className="text-xs h-8"
            >
              <Icon className="h-3 w-3 mr-1.5" />
              {p.label}
            </Button>
          );
        })}
      </div>
    </div>
  );
}
