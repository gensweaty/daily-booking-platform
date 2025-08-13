import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { useToast } from "@/hooks/use-toast";

interface PresenceAvatarsProps {
  users: { name: string; email: string }[];
  currentUserEmail?: string;
  max?: number;
}

export function PresenceAvatars({ users, currentUserEmail, max = 5 }: PresenceAvatarsProps) {
  // Filter out current user from display - they shouldn't see themselves
  const otherUsers = users.filter(user => user.email !== currentUserEmail);
  const visible = otherUsers.slice(0, max);
  const extra = otherUsers.length - visible.length;
  const isMobile = useMediaQuery("(max-width: 640px)");
  const { toast } = useToast();

  const getInitials = (name?: string) => {
    if (!name) return "?";
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[1][0]).toUpperCase();
  };

  const handleMobileClick = (displayName: string) => {
    if (isMobile) {
      toast({ description: displayName });
    }
  };

  return (
    <div className="flex items-center">
      <div className="flex -space-x-2">
        <TooltipProvider>
          {visible.map((u) => {
            const displayName = (u.name || 'User');
            return (
              <Tooltip key={u.email}>
                <TooltipTrigger asChild>
                  <Avatar
                      className={cn(
                        "h-6 w-6 sm:h-7 sm:w-7 ring-2 ring-offset-2 ring-offset-background transition-all duration-200 hover:scale-110 shadow-sm",
                        "bg-card text-foreground/80 ring-muted"
                      )}
                      title={displayName}
                      aria-label={displayName}
                      onClick={() => handleMobileClick(displayName)}
                    >
                    <AvatarFallback className="text-[10px] font-medium">
                      {getInitials(displayName)}
                    </AvatarFallback>
                  </Avatar>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="px-2 py-1 text-xs">
                  {displayName}
                </TooltipContent>
              </Tooltip>
            );
          })}
        </TooltipProvider>
        {extra > 0 && (
          <div className="h-6 w-6 sm:h-7 sm:w-7 rounded-full bg-card ring-2 ring-muted ring-offset-2 ring-offset-background flex items-center justify-center text-[10px] text-foreground/70">
            +{extra}
          </div>
        )}
      </div>
    </div>
  );
}
