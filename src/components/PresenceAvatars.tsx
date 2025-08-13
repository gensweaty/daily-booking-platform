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
  const isMobile = useMediaQuery("(max-width: 640px)");
  const { toast } = useToast();

  // Debug logging
  console.log("PresenceAvatars Debug:", {
    allUsers: users.length,
    currentUserEmail,
    otherUsers: otherUsers.length,
    visible: visible.length,
    userDetails: users.map(u => ({ name: u.name, email: u.email }))
  });

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

  if (visible.length === 0) return null;

  return (
    <div className="flex items-center min-w-0">
      <div className={cn(
        "flex items-center",
        visible.length <= 3 ? "-space-x-2" : "-space-x-1.5",
        "max-w-[180px] sm:max-w-[220px]"
      )}>
        <TooltipProvider>
          {visible.map((u) => {
            const displayName = (u.name || 'User');
            return (
              <Tooltip key={u.email}>
                <TooltipTrigger asChild>
                  <Avatar
                      className={cn(
                        "h-6 w-6 sm:h-7 sm:w-7 ring-1 sm:ring-2 ring-offset-1 sm:ring-offset-2 ring-offset-background transition-all duration-200 hover:scale-110 shadow-sm flex-shrink-0",
                        "bg-card text-foreground/80 ring-muted hover:ring-primary"
                      )}
                      title={displayName}
                      aria-label={displayName}
                      onClick={() => handleMobileClick(displayName)}
                    >
                    <AvatarFallback className="text-[10px] sm:text-xs font-medium">
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
      </div>
    </div>
  );
}
