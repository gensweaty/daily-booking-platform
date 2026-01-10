import { memo } from 'react';
import { motion } from 'framer-motion';
import { 
  MessageSquare, 
  MessagesSquare, 
  Calendar, 
  CheckSquare, 
  Bell, 
  Clock 
} from 'lucide-react';
import { DashboardNotification, NotificationType } from '@/types/notifications';
import { useLanguage } from '@/contexts/LanguageContext';
import { formatDistanceToNow } from 'date-fns';
import { es, ka } from 'date-fns/locale';

interface NotificationItemProps {
  notification: DashboardNotification;
  onClick: () => void;
  compact?: boolean;
}

const getNotificationIcon = (type: NotificationType) => {
  switch (type) {
    case 'comment':
      return MessageSquare;
    case 'chat':
      return MessagesSquare;
    case 'booking':
      return Calendar;
    case 'task_reminder':
      return CheckSquare;
    case 'event_reminder':
      return Calendar;
    case 'custom_reminder':
      return Bell;
    default:
      return Bell;
  }
};

const getNotificationColor = (type: NotificationType) => {
  switch (type) {
    case 'comment':
      return 'text-blue-400';
    case 'chat':
      return 'text-green-400';
    case 'booking':
      return 'text-purple-400';
    case 'task_reminder':
      return 'text-amber-400';
    case 'event_reminder':
      return 'text-cyan-400';
    case 'custom_reminder':
      return 'text-pink-400';
    default:
      return 'text-primary';
  }
};

export const NotificationItem = memo(({ notification, onClick, compact = false }: NotificationItemProps) => {
  const { language } = useLanguage();
  const Icon = getNotificationIcon(notification.type);
  const iconColor = getNotificationColor(notification.type);

  const getLocale = () => {
    switch (language) {
      case 'es': return es;
      case 'ka': return ka;
      default: return undefined;
    }
  };

  const timeAgo = formatDistanceToNow(new Date(notification.timestamp), { 
    addSuffix: true,
    locale: getLocale()
  });

  if (compact) {
    return (
      <motion.div
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        className="flex items-center gap-2 min-w-0"
      >
        <Icon className={`h-3.5 w-3.5 shrink-0 ${iconColor}`} />
        <span className="text-xs font-medium text-foreground truncate">
          {notification.title}
        </span>
        <span className="text-[10px] text-muted-foreground truncate hidden sm:inline">
          {notification.message}
        </span>
      </motion.div>
    );
  }

  return (
    <motion.button
      initial={{ opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -5 }}
      onClick={onClick}
      className={`w-full flex items-start gap-3 p-3 rounded-lg transition-colors text-left
        ${notification.read 
          ? 'bg-background/50 hover:bg-background/80' 
          : 'bg-primary/5 hover:bg-primary/10 border-l-2 border-primary'
        }`}
    >
      <div className={`p-1.5 rounded-full bg-background/80 shrink-0 ${iconColor}`}>
        <Icon className="h-3.5 w-3.5" />
      </div>
      <div className="flex-1 min-w-0 space-y-0.5">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-semibold text-foreground truncate">
            {notification.title}
          </span>
          <div className="flex items-center gap-1 text-[10px] text-muted-foreground shrink-0">
            <Clock className="h-2.5 w-2.5" />
            <span>{timeAgo}</span>
          </div>
        </div>
        <p className="text-[11px] text-muted-foreground line-clamp-2">
          {notification.message}
        </p>
      </div>
      {!notification.read && (
        <div className="h-2 w-2 rounded-full bg-primary shrink-0 mt-1" />
      )}
    </motion.button>
  );
});

NotificationItem.displayName = 'NotificationItem';
