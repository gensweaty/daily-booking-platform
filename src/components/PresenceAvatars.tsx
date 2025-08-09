import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface PresenceAvatarsProps {
  users: { name: string; email: string }[];
  currentUserEmail?: string;
  max?: number;
}

export function PresenceAvatars({ users, currentUserEmail, max = 5 }: PresenceAvatarsProps) {
  const visible = users.slice(0, max);
  const extra = users.length - visible.length;

  const getInitials = (name?: string) => {
    if (!name) return "?";
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[1][0]).toUpperCase();
  };

  return (
    <div className="flex items-center">
      <div className="flex -space-x-2">
        <TooltipProvider>
          {visible.map((u) => (
            <Tooltip key={u.email}>
              <TooltipTrigger asChild>
                <Avatar
                    className={cn(
                      "h-6 w-6 sm:h-7 sm:w-7 ring-2 ring-offset-2 ring-offset-background transition-transform duration-200 hover:scale-110 shadow-sm",
                      "bg-muted text-foreground/80",
                      u.email === currentUserEmail ? "ring-primary" : "ring-muted"
                    )}
                  title={u.name}
                  aria-label={u.name}
                >
                  <AvatarFallback className="text-[10px] font-medium">
                    {getInitials(u.name)}
                  </AvatarFallback>
                </Avatar>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="px-2 py-1 text-xs">
                {u.name}
              </TooltipContent>
            </Tooltip>
          ))}
        </TooltipProvider>
        {extra > 0 && (
          <div className="h-6 w-6 sm:h-7 sm:w-7 rounded-full bg-muted ring-2 ring-muted ring-offset-2 ring-offset-background flex items-center justify-center text-[10px] text-foreground/70">
            +{extra}
          </div>
        )}
      </div>
    </div>
  );
}
