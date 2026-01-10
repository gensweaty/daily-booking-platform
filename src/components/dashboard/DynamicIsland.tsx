import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, X, CheckCheck, Trash2, Sparkles } from 'lucide-react';
import { useDashboardNotifications } from '@/hooks/useDashboardNotifications';
import { NotificationItem } from './NotificationItem';
import { useLanguage } from '@/contexts/LanguageContext';
import { GeorgianAuthText } from '@/components/shared/GeorgianAuthText';
import { LanguageText } from '@/components/shared/LanguageText';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';

interface DynamicIslandProps {
  username: string;
  userProfileName?: string;
}

export const DynamicIsland = ({ username, userProfileName }: DynamicIslandProps) => {
  const { language, t } = useLanguage();
  const [isExpanded, setIsExpanded] = useState(false);
  const { 
    notifications, 
    latestNotification, 
    unreadCount,
    markAsRead,
    markAllAsRead,
    clearAll 
  } = useDashboardNotifications();

  const isGeorgian = language === 'ka';
  const displayName = userProfileName || username;

  const handleNotificationClick = useCallback((notification: typeof notifications[0]) => {
    markAsRead(notification.id);
    
    // Handle navigation based on notification type
    switch (notification.type) {
      case 'comment':
      case 'task_reminder':
        if (notification.actionData?.taskId) {
          window.dispatchEvent(new CustomEvent('open-task', { 
            detail: { taskId: notification.actionData.taskId } 
          }));
        }
        break;
      case 'chat':
        if (notification.actionData?.channelId) {
          window.dispatchEvent(new CustomEvent('open-chat-channel', { 
            detail: { channelId: notification.actionData.channelId } 
          }));
        }
        break;
      case 'booking':
        // Switch to business tab
        window.dispatchEvent(new CustomEvent('switch-dashboard-tab', { 
          detail: { tab: 'business' } 
        }));
        break;
      case 'event_reminder':
        // Switch to calendar tab
        window.dispatchEvent(new CustomEvent('switch-dashboard-tab', { 
          detail: { tab: 'calendar' } 
        }));
        break;
      default:
        break;
    }
    
    setIsExpanded(false);
  }, [markAsRead]);

  const toggleExpanded = useCallback(() => {
    setIsExpanded(prev => !prev);
  }, []);

  return (
    <div className="flex justify-center mb-2 relative px-4">
      <motion.div
        layout
        initial={false}
        animate={{
          width: isExpanded ? '100%' : 'auto',
          maxWidth: isExpanded ? '420px' : '340px',
        }}
        transition={{ 
          type: 'spring', 
          stiffness: 400, 
          damping: 30,
          layout: { duration: 0.25 }
        }}
        className={`relative overflow-hidden ${
          isExpanded 
            ? 'rounded-3xl' 
            : 'rounded-full cursor-pointer hover:scale-[1.02] active:scale-[0.98]'
        } transition-transform duration-200`}
        style={{
          background: 'linear-gradient(145deg, hsl(220 26% 14% / 0.98), hsl(220 26% 10% / 0.95))',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          border: '1px solid hsl(var(--primary) / 0.15)',
          boxShadow: unreadCount > 0 
            ? `
              0 0 0 1px hsl(var(--primary) / 0.1),
              0 0 30px hsl(var(--primary) / 0.15),
              0 8px 32px hsl(0 0% 0% / 0.4),
              inset 0 1px 0 hsl(255 255% 255% / 0.05)
            `
            : `
              0 0 0 1px hsl(var(--border) / 0.1),
              0 8px 32px hsl(0 0% 0% / 0.3),
              inset 0 1px 0 hsl(255 255% 255% / 0.05)
            `,
        }}
        onClick={!isExpanded ? toggleExpanded : undefined}
      >
        {/* Animated gradient border for unread notifications */}
        {unreadCount > 0 && !isExpanded && (
          <motion.div
            className="absolute inset-0 rounded-full pointer-events-none"
            initial={{ opacity: 0 }}
            animate={{ opacity: [0.5, 0.8, 0.5] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
            style={{
              background: 'linear-gradient(90deg, hsl(var(--primary) / 0), hsl(var(--primary) / 0.3), hsl(var(--primary) / 0))',
              backgroundSize: '200% 100%',
            }}
          />
        )}

        {/* Collapsed State */}
        <AnimatePresence mode="wait">
          {!isExpanded && (
            <motion.div
              key="collapsed"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.15 }}
              className="flex items-center gap-3 px-5 py-3"
            >
              {/* Icon with glow effect */}
              <motion.div 
                className="relative shrink-0"
                animate={unreadCount > 0 ? { scale: [1, 1.1, 1] } : {}}
                transition={{ duration: 0.5, repeat: unreadCount > 0 ? Infinity : 0, repeatDelay: 2 }}
              >
                <div 
                  className={`relative z-10 flex items-center justify-center w-8 h-8 rounded-full ${
                    unreadCount > 0 
                      ? 'bg-gradient-to-br from-primary/30 to-primary/10' 
                      : 'bg-muted/30'
                  }`}
                >
                  {unreadCount > 0 ? (
                    <Sparkles className="h-4 w-4 text-primary" />
                  ) : (
                    <Bell className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
                {unreadCount > 0 && (
                  <div className="absolute inset-0 rounded-full bg-primary/20 blur-md" />
                )}
              </motion.div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <AnimatePresence mode="wait">
                  {latestNotification ? (
                    <NotificationItem 
                      key={latestNotification.id}
                      notification={latestNotification} 
                      onClick={() => handleNotificationClick(latestNotification)}
                      compact 
                    />
                  ) : (
                    <motion.div
                      key="greeting"
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -5 }}
                      transition={{ duration: 0.15 }}
                      className="text-left"
                    >
                      <h1 className="text-sm font-semibold text-foreground truncate">
                        {isGeorgian ? (
                          <GeorgianAuthText fontWeight="bold">მოგესალმებით, {displayName}</GeorgianAuthText>
                        ) : (
                          <LanguageText>{t('dashboard.welcome')}, {displayName}</LanguageText>
                        )}
                      </h1>
                      <p className="text-[11px] text-muted-foreground/70 truncate">
                        {isGeorgian ? (
                          <GeorgianAuthText fontWeight="medium">თქვენი პროდუქტიულობის ცენტრი</GeorgianAuthText>
                        ) : (
                          <LanguageText>{t('dashboard.subtitle')}</LanguageText>
                        )}
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Badge & Arrow */}
              <div className="flex items-center gap-2 shrink-0">
                {unreadCount > 0 && (
                  <motion.div
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="flex items-center justify-center h-5 min-w-5 px-1.5 rounded-full 
                      bg-gradient-to-r from-primary to-primary/80 
                      text-primary-foreground text-[10px] font-bold shadow-lg shadow-primary/30"
                  >
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </motion.div>
                )}
                <motion.svg 
                  width="12" 
                  height="12" 
                  viewBox="0 0 12 12" 
                  className="text-muted-foreground/50"
                  animate={{ rotate: isExpanded ? 180 : 0 }}
                >
                  <path 
                    d="M2.5 4.5L6 8L9.5 4.5" 
                    stroke="currentColor" 
                    strokeWidth="1.5" 
                    strokeLinecap="round" 
                    strokeLinejoin="round"
                    fill="none"
                  />
                </motion.svg>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Expanded State */}
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              key="expanded"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-5 py-4">
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5">
                    <Bell className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <span className="text-sm font-semibold text-foreground">
                      {isGeorgian ? (
                        <GeorgianAuthText fontWeight="bold">შეტყობინებები</GeorgianAuthText>
                      ) : (
                        language === 'es' ? 'Notificaciones' : 'Notifications'
                      )}
                    </span>
                    {unreadCount > 0 && (
                      <p className="text-[11px] text-primary">
                        {unreadCount} {isGeorgian ? 'ახალი' : language === 'es' ? 'nuevas' : 'new'}
                      </p>
                    )}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-xl bg-muted/30 hover:bg-muted/50"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsExpanded(false);
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>

              {/* Divider */}
              <div className="mx-4 h-px bg-gradient-to-r from-transparent via-border/50 to-transparent" />

              {/* Notification List */}
              <ScrollArea className="max-h-72">
                <div className="p-3 space-y-1.5">
                  {notifications.length === 0 ? (
                    <div className="py-10 text-center">
                      <div className="mx-auto w-12 h-12 rounded-2xl bg-muted/20 flex items-center justify-center mb-3">
                        <Bell className="h-5 w-5 text-muted-foreground/40" />
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {isGeorgian ? (
                          <GeorgianAuthText>შეტყობინებები არ არის</GeorgianAuthText>
                        ) : (
                          language === 'es' ? 'No hay notificaciones' : 'No notifications yet'
                        )}
                      </p>
                      <p className="text-[11px] text-muted-foreground/60 mt-1">
                        {isGeorgian ? 'აქტივობები აქ გამოჩნდება' : 'Activities will appear here'}
                      </p>
                    </div>
                  ) : (
                    notifications.map((notification, index) => (
                      <motion.div
                        key={notification.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.03 }}
                      >
                        <NotificationItem
                          notification={notification}
                          onClick={() => handleNotificationClick(notification)}
                        />
                      </motion.div>
                    ))
                  )}
                </div>
              </ScrollArea>

              {/* Footer Actions */}
              {notifications.length > 0 && (
                <>
                  <div className="mx-4 h-px bg-gradient-to-r from-transparent via-border/50 to-transparent" />
                  <div className="flex items-center justify-between px-3 py-3">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 text-xs gap-1.5 rounded-xl hover:bg-primary/10 hover:text-primary"
                      onClick={(e) => {
                        e.stopPropagation();
                        markAllAsRead();
                      }}
                    >
                      <CheckCheck className="h-3.5 w-3.5" />
                      {isGeorgian ? 'ყველას წაკითხვა' : language === 'es' ? 'Marcar leído' : 'Mark all read'}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 text-xs gap-1.5 rounded-xl text-destructive hover:text-destructive hover:bg-destructive/10"
                      onClick={(e) => {
                        e.stopPropagation();
                        clearAll();
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      {isGeorgian ? 'გასუფთავება' : language === 'es' ? 'Limpiar' : 'Clear'}
                    </Button>
                  </div>
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
};
