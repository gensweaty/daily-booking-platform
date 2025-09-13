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
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.2, ease: "easeInOut" }}
          className="overflow-hidden"
        >
          <div className="mt-2 mx-3 rounded-lg border bg-background/95 backdrop-blur shadow-lg dark:bg-background/90 dark:border-border/50">
            {loading ? (
              <div className="p-3 flex items-center justify-center text-sm text-muted-foreground">
                <Users className="h-4 w-4 mr-2" />
                Loading participants...
              </div>
            ) : participants.length === 0 ? (
              <div className="p-3 flex items-center justify-center text-sm text-muted-foreground">
                <Users className="h-4 w-4 mr-2" />
                No participants found
              </div>
            ) : (
              <div className="p-2 max-h-48 overflow-y-auto">
                <div className="text-xs font-medium text-muted-foreground px-2 py-1 mb-1">
                  Participants ({participants.length})
                </div>
                {participants.map((participant) => (
                  <div
                    key={`${participant.type}-${participant.id}`}
                    className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-muted/50 transition-colors"
                  >
                    <Avatar className="h-6 w-6">
                      <AvatarImage src={participant.avatar_url} />
                      <AvatarFallback className="text-xs">
                        {participant.type === 'admin' ? (
                          <User className="h-3 w-3" />
                        ) : (
                          participant.name?.charAt(0)?.toUpperCase() || 'U'
                        )}
                      </AvatarFallback>
                    </Avatar>
                    
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">
                        {participant.name}
                        {participant.isCurrentUser && (
                          <span className="text-xs text-muted-foreground ml-1">(You)</span>
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
                      className="text-xs px-1.5 py-0.5"
                    >
                      {participant.type === 'admin' ? 'Admin' : 'Member'}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};