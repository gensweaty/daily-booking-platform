import * as React from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

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

  return (
    <div className="flex -space-x-2">
      <TooltipProvider delayDuration={0}>
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
                <Avatar
                  className="bg-muted text-muted-foreground cursor-pointer hover:scale-105 transition-transform"
                  style={{
                    width: size,
                    height: size,
                    boxShadow: ring ? "0 0 0 2px var(--background)" : undefined,
                  }}
                >
                  <AvatarImage src={u?.avatar_url || undefined} alt={label} />
                  <AvatarFallback>{initials}</AvatarFallback>
                </Avatar>
              </TooltipTrigger>
              <TooltipContent 
                side="top" 
                className="text-sm pointer-events-none"
                sideOffset={8}
              >
                {label}
              </TooltipContent>
            </Tooltip>
          );
        })}
      </TooltipProvider>

      {remainder > 0 && (
        <Avatar
          className="bg-muted text-muted-foreground"
          style={{
            width: size,
            height: size,
            boxShadow: ring ? "0 0 0 2px var(--background)" : undefined,
          }}
        >
          <AvatarFallback>+{remainder}</AvatarFallback>
        </Avatar>
      )}
    </div>
  );
};