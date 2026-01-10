import { memo } from 'react';
import { motion } from 'framer-motion';
import { 
  MessageSquare, 
  MessagesSquare, 
  Calendar, 
  CheckSquare, 
  Bell, 
  Clock,
  CalendarCheck,
  Store
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
      return Store;
    case 'task_reminder':
      return CheckSquare;
    case 'event_reminder':
      return CalendarCheck;
    case 'custom_reminder':
      return Bell;
    default:
      return Bell;
  }
};

const getNotificationStyles = (type: NotificationType) => {
  switch (type) {
    case 'comment':
      return {
        iconBg: 'bg-blue-500/20',
        iconColor: 'text-blue-400',
        accentColor: 'from-blue-500/10 to-blue-500/0'
      };
    case 'chat':
      return {
        iconBg: 'bg-emerald-500/20',
        iconColor: 'text-emerald-400',
        accentColor: 'from-emerald-500/10 to-emerald-500/0'
      };
    case 'booking':
      return {
        iconBg: 'bg-orange-500/20',
        iconColor: 'text-orange-400',
        accentColor: 'from-orange-500/10 to-orange-500/0'
      };
    case 'task_reminder':
      return {
        iconBg: 'bg-amber-500/20',
        iconColor: 'text-amber-400',
        accentColor: 'from-amber-500/10 to-amber-500/0'
      };
    case 'event_reminder':
      return {
        iconBg: 'bg-cyan-500/20',
        iconColor: 'text-cyan-400',
        accentColor: 'from-cyan-500/10 to-cyan-500/0'
      };
    case 'custom_reminder':
      return {
        iconBg: 'bg-pink-500/20',
        iconColor: 'text-pink-400',
        accentColor: 'from-pink-500/10 to-pink-500/0'
      };
    default:
      return {
        iconBg: 'bg-primary/20',
        iconColor: 'text-primary',
        accentColor: 'from-primary/10 to-primary/0'
      };
  }
};

export const NotificationItem = memo(({ notification, onClick, compact = false }: NotificationItemProps) => {
  const { language } = useLanguage();
  const Icon = getNotificationIcon(notification.type);
  const styles = getNotificationStyles(notification.type);

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
        exit={{ opacity: 0, x: 10 }}
        className="flex items-center gap-2.5 min-w-0"
      >
        <div className={`flex items-center justify-center w-5 h-5 rounded-md ${styles.iconBg}`}>
          <Icon className={`h-3 w-3 ${styles.iconColor}`} />
        </div>
        <div className="flex-1 min-w-0 flex items-center gap-2">
          <span className="text-xs font-medium text-foreground truncate">
            {notification.title}
          </span>
          <span className="text-[10px] text-muted-foreground/70 truncate hidden sm:inline">
            · {notification.message}
          </span>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.button
      whileHover={{ scale: 1.01 }}
      whileTap={{ scale: 0.99 }}
      onClick={onClick}
      className={`w-full flex items-start gap-3 p-3 rounded-xl transition-all duration-200 text-left group relative overflow-hidden
        ${notification.read 
          ? 'hover:bg-muted/30' 
          : 'bg-gradient-to-r ' + styles.accentColor + ' hover:bg-muted/20'
        }`}
    >
      {/* Unread indicator line */}
      {!notification.read && (
        <div className={`absolute left-0 top-0 bottom-0 w-0.5 ${styles.iconColor.replace('text-', 'bg-')}`} />
      )}

      {/* Icon */}
      <div className={`relative flex items-center justify-center w-8 h-8 rounded-lg ${styles.iconBg} shrink-0 
        transition-transform duration-200 group-hover:scale-110`}>
        <Icon className={`h-4 w-4 ${styles.iconColor}`} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 space-y-0.5">
        <div className="flex items-start justify-between gap-2">
          <span className={`text-xs font-semibold truncate ${notification.read ? 'text-foreground/80' : 'text-foreground'}`}>
            {notification.title}
          </span>
          <div className="flex items-center gap-1 text-[10px] text-muted-foreground/60 shrink-0">
            <Clock className="h-2.5 w-2.5" />
            <span>{timeAgo}</span>
          </div>
        </div>
        <p className={`text-[11px] line-clamp-2 ${notification.read ? 'text-muted-foreground/60' : 'text-muted-foreground'}`}>
          {notification.message}
        </p>
      </div>

      {/* Unread dot */}
      {!notification.read && (
        <motion.div 
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className={`h-2 w-2 rounded-full ${styles.iconColor.replace('text-', 'bg-')} shrink-0 mt-1 shadow-lg`}
          style={{ boxShadow: `0 0 8px ${styles.iconColor.includes('blue') ? 'rgb(59 130 246 / 0.5)' : 
            styles.iconColor.includes('emerald') ? 'rgb(16 185 129 / 0.5)' :
            styles.iconColor.includes('orange') ? 'rgb(249 115 22 / 0.5)' :
            styles.iconColor.includes('amber') ? 'rgb(245 158 11 / 0.5)' :
            styles.iconColor.includes('cyan') ? 'rgb(6 182 212 / 0.5)' :
            styles.iconColor.includes('pink') ? 'rgb(236 72 153 / 0.5)' : 'hsl(var(--primary) / 0.5)'}`
          }}
        />
      )}
    </motion.button>
  );
});

NotificationItem.displayName = 'NotificationItem';
