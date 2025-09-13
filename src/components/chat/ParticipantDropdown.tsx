import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { User, Users } from "lucide-react";

interface Participant {
  id: string;
  name: string;
  email?: string;
  avatar_url?: string;
  type: 'admin' | 'sub_user';
  isCurrentUser?: boolean;
}

interface ParticipantDropdownProps {
  isOpen: boolean;
  participants: Participant[];
  loading?: boolean;
  onClose?: () => void;
}

export const ParticipantDropdown = ({ 
  isOpen, 
  participants, 
  loading = false,
  onClose 
}: ParticipantDropdownProps) => {
  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;
      if (isOpen && !target.closest('[data-participant-dropdown]')) {
        onClose?.();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          data-participant-dropdown
          initial={{ opacity: 0, scale: 0.95, y: -10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: -10 }}
          transition={{ duration: 0.15, ease: "easeOut" }}
          className="absolute top-full left-0 right-0 z-50 mt-2"
        >
          <div className="mx-2 sm:mx-4 rounded-lg border bg-background/98 backdrop-blur-sm shadow-xl dark:bg-background/95 dark:border-border/50 max-w-full overflow-hidden">
            {loading ? (
              <div className="p-3 flex items-center justify-center text-sm text-muted-foreground">
                <Users className="h-4 w-4 mr-2 animate-pulse" />
                Loading participants...
              </div>
            ) : participants.length === 0 ? (
              <div className="p-3 flex items-center justify-center text-sm text-muted-foreground">
                <Users className="h-4 w-4 mr-2" />
                No participants found
              </div>
            ) : (
              <div className="max-h-64 sm:max-h-80 overflow-y-auto">
                <div className="sticky top-0 bg-background/95 backdrop-blur-sm border-b px-3 py-2 text-xs font-medium text-muted-foreground">
                  Participants ({participants.length})
                </div>
                <div className="p-2 space-y-1">
                  {participants.map((participant) => (
                    <div
                      key={`${participant.type}-${participant.id}`}
                      className="flex items-center gap-2 px-2 py-2 rounded-md hover:bg-muted/50 transition-colors group"
                    >
                      <Avatar className="h-7 w-7 flex-shrink-0">
                        <AvatarImage src={participant.avatar_url} />
                        <AvatarFallback className="text-xs">
                          {participant.type === 'admin' ? (
                            <User className="h-3 w-3" />
                          ) : (
                            participant.name?.charAt(0)?.toUpperCase() || 'U'
                          )}
                        </AvatarFallback>
                      </Avatar>
                      
                      <div className="flex-1 min-w-0 space-y-0.5">
                        <div className="text-sm font-medium truncate flex items-center gap-1">
                          <span className="truncate">{participant.name}</span>
                          {participant.isCurrentUser && (
                            <span className="text-xs text-muted-foreground flex-shrink-0">(You)</span>
                          )}
                        </div>
                        {participant.email && (
                          <div className="text-xs text-muted-foreground truncate">
                            {participant.email}
                          </div>
                        )}
                      </div>
                      
                      <Badge 
                        variant="secondary" 
                        className="text-xs px-2 py-1 flex-shrink-0 hidden sm:inline-flex"
                      >
                        {participant.type === 'admin' ? 'Admin' : 'Member'}
                      </Badge>
                      
                      {/* Mobile: Show role as colored dot */}
                      <div 
                        className="w-2 h-2 rounded-full flex-shrink-0 sm:hidden"
                        style={{
                          backgroundColor: participant.type === 'admin' ? '#10b981' : '#6b7280'
                        }}
                        title={participant.type === 'admin' ? 'Admin' : 'Member'}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};