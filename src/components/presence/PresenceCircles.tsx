import * as React from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { useToast } from "@/hooks/use-toast";

export type PresenceUser = {
  email?: string | null;
  name?: string | null;
  avatar_url?: string | null;
  online_at?: string | null;
};

interface PresenceCirclesProps {
  users: PresenceUser[];
  max?: number;            // how many to show before +N
  size?: number;           // px (height/width)
  ring?: boolean;          // show ring like elsewhere
  currentUserEmail?: string; // filter out this user's email
}

export const PresenceCircles: React.FC<PresenceCirclesProps> = ({
  users,
  max = 5,
  size = 28,
  ring = true,
  currentUserEmail,
}) => {
  // Filter out current user - they shouldn't see themselves
  const otherUsers = users.filter(user => user.email !== currentUserEmail);
  const visible = otherUsers.slice(0, max);
  const remainder = Math.max(otherUsers.length - visible.length, 0);
  const isMobile = useMediaQuery("(max-width: 640px)");
  const { toast } = useToast();

  const handleMobileClick = (displayName: string) => {
    if (isMobile) {
      toast({ description: displayName });
    }
  };

  return (
    <div className="flex items-center min-w-0">
      <div className="flex items-center -space-x-2 max-w-[180px] sm:max-w-[220px]">
      <TooltipProvider delayDuration={300}>
        {visible.map((u, idx) => {
          // Prefer a human-friendly name; fallback to email prefix
          const label =
            (u?.name && u.name.trim()) ||
            (u?.email ? u.email.split("@")[0] : "") ||
            "Online";
          const initials =
            (label || "?")
              .replace(/[^a-zA-Z0-9 ]/g, "")
              .split(" ")
              .map((s) => s[0])
              .join("")
              .slice(0, 2)
              .toUpperCase() || "?";

          return (
            <Tooltip key={`${u?.email || "u"}-${idx}`}>
              <TooltipTrigger asChild>
                <div
                  className="cursor-pointer hover:scale-105 transition-transform touch-manipulation"
                  role="button"
                  tabIndex={0}
                  aria-label={`User: ${label}`}
                  onClick={() => handleMobileClick(label)}
                >
                  <Avatar
                    className="h-6 w-6 sm:h-7 sm:w-7 ring-1 sm:ring-2 ring-offset-1 sm:ring-offset-2 ring-offset-background transition-all duration-200 hover:scale-110 shadow-sm flex-shrink-0 bg-card text-foreground/80 ring-muted hover:ring-primary"
                    title={label}
                    aria-label={label}
                  >
                    <AvatarImage src={u?.avatar_url || undefined} alt={label} className="object-cover" />
                    <AvatarFallback className="text-[10px] sm:text-xs font-medium">{initials}</AvatarFallback>
                  </Avatar>
                </div>
              </TooltipTrigger>
              <TooltipContent 
                side="bottom" 
                className="px-2 py-1 text-xs"
              >
                <span>{label}</span>
              </TooltipContent>
            </Tooltip>
          );
        })}
      </TooltipProvider>

      {remainder > 0 && (
        <div
          className="cursor-pointer"
          role="button"
          aria-label={`${remainder} more users online`}
          onClick={() => handleMobileClick(`${remainder} more users`)}
        >
          <Avatar
            className="h-6 w-6 sm:h-7 sm:w-7 ring-1 sm:ring-2 ring-offset-1 sm:ring-offset-2 ring-offset-background transition-all duration-200 hover:scale-110 shadow-sm flex-shrink-0 bg-card text-foreground/80 ring-muted hover:ring-primary"
            aria-label={`${remainder} more users`}
          >
            <AvatarFallback className="text-[10px] sm:text-xs font-medium">+{remainder}</AvatarFallback>
          </Avatar>
        </div>
      )}
      </div>
    </div>
  );
};