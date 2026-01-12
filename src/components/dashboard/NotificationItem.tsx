import { memo } from 'react';
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
      return { iconBg: 'bg-blue-500/20', iconColor: 'text-blue-400' };
    case 'chat':
      return { iconBg: 'bg-emerald-500/20', iconColor: 'text-emerald-400' };
    case 'booking':
      return { iconBg: 'bg-orange-500/20', iconColor: 'text-orange-400' };
    case 'task_reminder':
      return { iconBg: 'bg-amber-500/20', iconColor: 'text-amber-400' };
    case 'event_reminder':
      return { iconBg: 'bg-cyan-500/20', iconColor: 'text-cyan-400' };
    case 'custom_reminder':
      return { iconBg: 'bg-pink-500/20', iconColor: 'text-pink-400' };
    default:
      return { iconBg: 'bg-primary/20', iconColor: 'text-primary' };
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
      <div className="flex items-center gap-2.5 min-w-0">
        <div className={`flex items-center justify-center w-5 h-5 rounded-md shrink-0 ${styles.iconBg}`}>
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
      </div>
    );
  }

  return (
    <button
      onClick={onClick}
      className={`w-full flex items-start gap-3 p-2.5 rounded-lg transition-colors duration-150 text-left relative
        ${notification.read 
          ? 'hover:bg-muted/20' 
          : 'bg-primary/5 hover:bg-primary/10'
        }`}
    >
      {/* Unread indicator */}
      {!notification.read && (
        <div className={`absolute left-0 top-0 bottom-0 w-0.5 rounded-full ${styles.iconColor.replace('text-', 'bg-')}`} />
      )}

      {/* Icon */}
      <div className={`flex items-center justify-center w-7 h-7 rounded-lg shrink-0 ${styles.iconBg}`}>
        <Icon className={`h-3.5 w-3.5 ${styles.iconColor}`} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 space-y-0.5">
        <div className="flex items-start justify-between gap-2">
          <span className={`text-xs font-semibold truncate ${notification.read ? 'text-foreground/70' : 'text-foreground'}`}>
            {notification.title}
          </span>
          <div className="flex items-center gap-1 text-[10px] text-muted-foreground/50 shrink-0">
            <Clock className="h-2.5 w-2.5" />
            <span>{timeAgo}</span>
          </div>
        </div>
        <p className={`text-[11px] line-clamp-1 ${notification.read ? 'text-muted-foreground/50' : 'text-muted-foreground/80'}`}>
          {notification.message}
        </p>
      </div>

      {/* Unread dot */}
      {!notification.read && (
        <div className={`h-1.5 w-1.5 rounded-full shrink-0 mt-1.5 ${styles.iconColor.replace('text-', 'bg-')}`} />
      )}
    </button>
  );
});

NotificationItem.displayName = 'NotificationItem';
