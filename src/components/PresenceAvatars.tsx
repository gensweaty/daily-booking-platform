import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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
        {visible.map((u) => (
          <Avatar
            key={u.email}
            className={cn(
              "h-7 w-7 ring-2",
              u.email === currentUserEmail ? "ring-primary" : "ring-muted",
              "bg-muted text-foreground/80"
            )}
            title={u.name}
          >
            <AvatarFallback className="text-[10px] font-medium">
              {getInitials(u.name)}
            </AvatarFallback>
          </Avatar>
        ))}
        {extra > 0 && (
          <div className="h-7 w-7 rounded-full bg-muted ring-2 ring-muted flex items-center justify-center text-[10px] text-foreground/70">
            +{extra}
          </div>
        )}
      </div>
    </div>
  );
}
