import { Button } from '@/components/ui/button';
import { Calendar, MessageSquare, Search, Bot } from 'lucide-react';

interface AIQuickPromptsProps {
  onPromptSelect: (prompt: string) => void;
}

export function AIQuickPrompts({ onPromptSelect }: AIQuickPromptsProps) {
  const prompts = [
    { 
      label: "Today's Schedule", 
      text: "Show me what's on my calendar today",
      icon: Calendar
    },
    { 
      label: "Summarize Messages", 
      text: "Summarize unread messages from the last 24 hours",
      icon: MessageSquare
    },
    { 
      label: "Find Customer", 
      text: "Search for a customer",
      icon: Search
    },
    { 
      label: "Pending Bookings", 
      text: "How many booking requests are pending approval?",
      icon: Bot
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
