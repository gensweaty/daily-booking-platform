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
      if (isOpen && !target.closest('[data-participant-dropdown]') && !target.closest('[data-participant-trigger]')) {
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
          className="absolute top-full left-0 right-0 z-50 mt-1"
        >
          <div className="mx-1 rounded-md border bg-background/98 backdrop-blur-sm shadow-lg dark:bg-background/95 dark:border-border/50 overflow-hidden">
            {loading ? (
              <div className="p-2 flex items-center justify-center text-xs text-muted-foreground">
                <Users className="h-3 w-3 mr-1.5 animate-pulse" />
                Loading...
              </div>
            ) : participants.length === 0 ? (
              <div className="p-2 flex items-center justify-center text-xs text-muted-foreground">
                <Users className="h-3 w-3 mr-1.5" />
                No participants
              </div>
            ) : (
              <div className="max-h-48 overflow-y-auto">
                <div className="sticky top-0 bg-background/98 backdrop-blur-sm border-b px-2 py-1.5 text-xs font-medium text-muted-foreground">
                  Participants ({participants.length})
                </div>
                <div className="p-2">
                  {participants.map((participant) => (
                    <div
                      key={`${participant.type}-${participant.id}`}
                      className="flex items-center gap-3 px-3 py-2.5 rounded hover:bg-muted/50 transition-colors"
                    >
                      <Avatar className="h-8 w-8 flex-shrink-0">
                        <AvatarImage src={participant.avatar_url} />
                        <AvatarFallback className="text-sm">
                          {participant.type === 'admin' ? (
                            <User className="h-4 w-4" />
                          ) : (
                            participant.name?.charAt(0)?.toUpperCase() || 'U'
                          )}
                        </AvatarFallback>
                      </Avatar>
                      
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate flex items-center gap-2">
                          <span className="truncate">{participant.name}</span>
                          {participant.isCurrentUser && (
                            <span className="text-xs text-muted-foreground">(You)</span>
                          )}
                        </div>
                        {participant.email && (
                          <div className="text-xs text-muted-foreground truncate">
                            {participant.email}
                          </div>
                        )}
                      </div>
                      
                      <div className="flex-shrink-0">
                        <Badge 
                          variant={participant.type === 'admin' ? 'default' : 'secondary'}
                          className={`text-xs px-2 py-1 ${
                            participant.type === 'admin' 
                              ? 'bg-green-500 hover:bg-green-600 text-white' 
                              : 'bg-green-500/20 hover:bg-green-500/30 text-green-700 dark:text-green-400'
                          }`}
                        >
                          {participant.type === 'admin' ? 'Admin' : 'Member'}
                        </Badge>
                      </div>
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