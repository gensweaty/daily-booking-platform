import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, X, CheckCheck, Trash2, ChevronDown } from 'lucide-react';
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
          // Navigate to chat - this would need to be handled by the chat system
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
    <div className="text-center mb-1 relative">
      <motion.div
        layout
        className={`relative mx-auto overflow-hidden transition-all duration-300 ${
          isExpanded 
            ? 'rounded-2xl max-w-md w-full' 
            : 'rounded-full max-w-sm w-full cursor-pointer'
        }`}
        style={{
          background: 'linear-gradient(135deg, hsl(var(--background) / 0.95), hsl(var(--background) / 0.85))',
          backdropFilter: 'blur(12px)',
          border: '1px solid hsl(var(--border) / 0.3)',
          boxShadow: unreadCount > 0 
            ? '0 0 20px hsl(var(--primary) / 0.15), 0 4px 12px hsl(var(--background) / 0.5)' 
            : '0 4px 12px hsl(var(--background) / 0.5)',
        }}
        onClick={!isExpanded ? toggleExpanded : undefined}
      >
        {/* Collapsed State */}
        <AnimatePresence mode="wait">
          {!isExpanded && (
            <motion.div
              key="collapsed"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex items-center justify-between gap-3 px-4 py-2.5"
            >
              {/* Left: Greeting or notification */}
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
                      className="text-left"
                    >
                      <h1 className="text-sm font-bold text-foreground truncate">
                        {isGeorgian ? (
                          <GeorgianAuthText fontWeight="bold">მოგესალმებით, {displayName}</GeorgianAuthText>
                        ) : (
                          <LanguageText>{t('dashboard.welcome')}, {displayName}</LanguageText>
                        )}
                      </h1>
                      <p className="text-[10px] text-muted-foreground truncate">
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

              {/* Right: Notification indicator */}
              <div className="flex items-center gap-2 shrink-0">
                {unreadCount > 0 && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="flex items-center justify-center h-5 min-w-5 px-1.5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold"
                  >
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </motion.div>
                )}
                <Bell className={`h-4 w-4 ${unreadCount > 0 ? 'text-primary' : 'text-muted-foreground'}`} />
                <ChevronDown className="h-3 w-3 text-muted-foreground" />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Expanded State */}
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              key="expanded"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-border/30">
                <div className="flex items-center gap-2">
                  <Bell className="h-4 w-4 text-primary" />
                  <span className="text-sm font-semibold text-foreground">
                    {isGeorgian ? (
                      <GeorgianAuthText fontWeight="bold">შეტყობინებები</GeorgianAuthText>
                    ) : (
                      language === 'es' ? 'Notificaciones' : 'Notifications'
                    )}
                  </span>
                  {unreadCount > 0 && (
                    <span className="text-xs text-muted-foreground">
                      ({unreadCount} {isGeorgian ? 'ახალი' : language === 'es' ? 'nuevas' : 'new'})
                    </span>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsExpanded(false);
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>

              {/* Notification List */}
              <ScrollArea className="max-h-64">
                <div className="p-2 space-y-1">
                  {notifications.length === 0 ? (
                    <div className="py-8 text-center">
                      <Bell className="h-8 w-8 mx-auto text-muted-foreground/50 mb-2" />
                      <p className="text-xs text-muted-foreground">
                        {isGeorgian ? (
                          <GeorgianAuthText>შეტყობინებები არ არის</GeorgianAuthText>
                        ) : (
                          language === 'es' ? 'No hay notificaciones' : 'No notifications'
                        )}
                      </p>
                    </div>
                  ) : (
                    notifications.map((notification) => (
                      <NotificationItem
                        key={notification.id}
                        notification={notification}
                        onClick={() => handleNotificationClick(notification)}
                      />
                    ))
                  )}
                </div>
              </ScrollArea>

              {/* Footer Actions */}
              {notifications.length > 0 && (
                <div className="flex items-center justify-between px-3 py-2 border-t border-border/30 bg-background/50">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs gap-1.5"
                    onClick={(e) => {
                      e.stopPropagation();
                      markAllAsRead();
                    }}
                  >
                    <CheckCheck className="h-3 w-3" />
                    {isGeorgian ? 'ყველას წაკითხვა' : language === 'es' ? 'Marcar todo leído' : 'Mark all read'}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs gap-1.5 text-destructive hover:text-destructive"
                    onClick={(e) => {
                      e.stopPropagation();
                      clearAll();
                    }}
                  >
                    <Trash2 className="h-3 w-3" />
                    {isGeorgian ? 'გასუფთავება' : language === 'es' ? 'Limpiar' : 'Clear all'}
                  </Button>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
};
