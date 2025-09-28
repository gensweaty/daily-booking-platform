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
}

export const PresenceCircles: React.FC<PresenceCirclesProps> = ({
  users,
  max = 5,
  size = 28,
  ring = true,
}) => {
  const visible = users.slice(0, max);
  const remainder = Math.max(users.length - visible.length, 0);
  const isMobile = useMediaQuery("(max-width: 640px)");
  const { toast } = useToast();

  const handleMobileClick = (displayName: string) => {
    if (isMobile) {
      toast({ description: displayName });
    }
  };

  return (
    <div className="flex -space-x-2">
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
                    className="bg-muted text-muted-foreground border-2 border-background"
                    style={{
                      width: size,
                      height: size,
                      boxShadow: ring ? "0 0 0 1px var(--border)" : undefined,
                    }}
                  >
                    <AvatarImage src={u?.avatar_url || undefined} alt={label} />
                    <AvatarFallback className="text-xs font-medium">{initials}</AvatarFallback>
                  </Avatar>
                </div>
              </TooltipTrigger>
              <TooltipContent 
                side="top" 
                className="text-sm font-medium bg-popover text-popover-foreground border shadow-lg px-2 py-1 z-50"
                sideOffset={8}
                collisionPadding={4}
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
            className="bg-muted text-muted-foreground border-2 border-background"
            style={{
              width: size,
              height: size,
              boxShadow: ring ? "0 0 0 1px var(--border)" : undefined,
            }}
          >
            <AvatarFallback className="text-xs font-medium">+{remainder}</AvatarFallback>
          </Avatar>
        </div>
      )}
    </div>
  );
};