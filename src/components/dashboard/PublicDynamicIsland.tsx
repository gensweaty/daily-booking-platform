import { useState, useCallback, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Bell, X, CheckCheck, Trash2, Sparkles, Maximize2 } from 'lucide-react';
import { usePublicBoardNotifications } from '@/hooks/usePublicBoardNotifications';
import { NotificationItem } from './NotificationItem';
import { NotificationsPopup } from './NotificationsPopup';
import { useLanguage } from '@/contexts/LanguageContext';
import { GeorgianAuthText } from '@/components/shared/GeorgianAuthText';
import { LanguageText } from '@/components/shared/LanguageText';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useTheme } from 'next-themes';

interface PublicDynamicIslandProps {
  username: string;
  boardUserId: string;
}

export const PublicDynamicIsland = ({ username, boardUserId }: PublicDynamicIslandProps) => {
  const { language } = useLanguage();
  const { resolvedTheme, theme } = useTheme();
  const [isExpanded, setIsExpanded] = useState(false);
  const [showFullPopup, setShowFullPopup] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [currentTheme, setCurrentTheme] = useState<string>('dark');
  // Use public board notifications hook for sub-users (separate from internal dashboard)
  const { 
    notifications, 
    latestNotification, 
    unreadCount,
    markAsRead,
    markAllAsRead,
    clearAll 
  } = usePublicBoardNotifications();

  const isGeorgian = language === 'ka';
  const displayName = username;

  // Handle theme detection after mount
  useEffect(() => {
    setMounted(true);
    
    const updateTheme = () => {
      const isDark = document.documentElement.classList.contains('dark');
      setCurrentTheme(isDark ? 'dark' : 'light');
    };
    
    // Initial check
    updateTheme();
    
    // Listen for theme changes
    const handleThemeChange = () => updateTheme();
    document.addEventListener('themeChanged', handleThemeChange);
    document.addEventListener('themeInit', handleThemeChange);
    
    // Also use MutationObserver to catch class changes
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.attributeName === 'class') {
          updateTheme();
        }
      });
    });
    
    observer.observe(document.documentElement, { attributes: true });
    
    return () => {
      document.removeEventListener('themeChanged', handleThemeChange);
      document.removeEventListener('themeInit', handleThemeChange);
      observer.disconnect();
    };
  }, []);

  // Determine actual theme for styling
  const isDarkMode = mounted ? currentTheme === 'dark' : true;

  // Helper to store pending intent in sessionStorage
  const storePendingIntent = (tab: string, action: string, id?: string) => {
    const intent = {
      tab,
      action,
      id,
      createdAt: Date.now()
    };
    sessionStorage.setItem('public-board-pending-intent', JSON.stringify(intent));
    console.log('📌 Stored pending intent:', intent);
  };

  const handleNotificationClick = useCallback((notification: typeof notifications[0]) => {
    markAsRead(notification.id);
    
    // For public board, dispatch events and store pending intent for reliable navigation
    switch (notification.type) {
      case 'comment':
      case 'task_reminder':
        // Open the task where the comment was made or deadline reminder
        if (notification.actionData?.taskId) {
          // Store pending intent BEFORE switching tab
          storePendingIntent('tasks', 'open-task', notification.actionData.taskId);
          window.dispatchEvent(new CustomEvent('switch-public-tab', { 
            detail: { tab: 'tasks' } 
          }));
          // Also dispatch immediate event (will be caught if component is already mounted)
          setTimeout(() => {
            window.dispatchEvent(new CustomEvent('open-task', { 
              detail: { taskId: notification.actionData?.taskId } 
            }));
          }, 100);
        }
        break;
      case 'chat':
        // Open chat with the specific channel/team member
        if (notification.actionData?.channelId) {
          storePendingIntent('chat', 'open-chat-channel', notification.actionData.channelId);
          window.dispatchEvent(new CustomEvent('open-chat-channel', { 
            detail: { channelId: notification.actionData.channelId } 
          }));
        }
        break;
      case 'event_reminder':
        // Open the event edit popup
        if (notification.actionData?.eventId) {
          storePendingIntent('calendar', 'open-event-edit', notification.actionData.eventId);
          window.dispatchEvent(new CustomEvent('switch-public-tab', { 
            detail: { tab: 'calendar' } 
          }));
          setTimeout(() => {
            window.dispatchEvent(new CustomEvent('open-event-edit', { 
              detail: { eventId: notification.actionData?.eventId } 
            }));
          }, 100);
        } else {
          window.dispatchEvent(new CustomEvent('switch-public-tab', { 
            detail: { tab: 'calendar' } 
          }));
        }
        break;
      case 'custom_reminder':
        // AI reminder - open AI chat if available
        storePendingIntent('chat', 'open-ai-chat');
        window.dispatchEvent(new CustomEvent('open-ai-chat', {}));
        break;
      default:
        break;
    }
    
    setIsExpanded(false);
  }, [markAsRead]);

  const toggleExpanded = useCallback(() => {
    setIsExpanded(prev => !prev);
  }, []);

  const openFullPopup = useCallback(() => {
    setShowFullPopup(true);
    setIsExpanded(false);
  }, []);

  const getViewAllText = () => {
    if (isGeorgian) return 'ყველა';
    if (language === 'es') return 'Ver todo';
    return 'View all';
  };

  return (
    <div className="flex justify-center mb-2 relative px-2 sm:px-4">
      <motion.div
        className="relative overflow-hidden cursor-pointer w-full sm:w-auto"
        initial={false}
        animate={{
          borderRadius: isExpanded ? 16 : 9999,
          width: isExpanded ? '100%' : 'auto',
          maxWidth: isExpanded ? 420 : 380,
          minWidth: isExpanded ? 280 : undefined,
        }}
        style={{
          background: isDarkMode 
            ? 'linear-gradient(145deg, hsl(220 26% 16%), hsl(220 26% 12%))'
            : 'linear-gradient(145deg, hsl(0 0% 100%), hsl(220 14% 96%))',
          border: isDarkMode 
            ? '1px solid hsl(var(--primary) / 0.2)' 
            : '1px solid hsl(220 14% 90%)',
          boxShadow: unreadCount > 0 
            ? isDarkMode
              ? '0 0 20px hsl(var(--primary) / 0.15), 0 4px 20px hsl(0 0% 0% / 0.3)'
              : '0 0 20px hsl(var(--primary) / 0.1), 0 4px 16px hsl(220 14% 50% / 0.15)'
            : isDarkMode
              ? '0 4px 20px hsl(0 0% 0% / 0.25)'
              : '0 4px 16px hsl(220 14% 50% / 0.12)',
        }}
        transition={{ 
          type: "spring",
          stiffness: 400,
          damping: 30,
          mass: 0.8
        }}
        onClick={!isExpanded ? toggleExpanded : undefined}
        whileHover={!isExpanded ? { scale: 1.015, transition: { duration: 0.2 } } : undefined}
        whileTap={!isExpanded ? { scale: 0.985, transition: { duration: 0.1 } } : undefined}
      >
        <AnimatePresence mode="wait" initial={false}>
          {/* Collapsed State */}
          {!isExpanded && (
            <motion.div 
              key="collapsed"
              className="flex items-center gap-3 px-4 py-2"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15, ease: "easeOut" }}
            >
              {/* Icon */}
              <div className={`flex items-center justify-center w-7 h-7 rounded-full shrink-0 ${
                unreadCount > 0 ? 'bg-primary/20' : 'bg-muted/30'
              }`}>
                {unreadCount > 0 ? (
                  <Sparkles className="h-3.5 w-3.5 text-primary" />
                ) : (
                  <Bell className="h-3.5 w-3.5 text-muted-foreground" />
                )}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0 flex items-center gap-3">
                {latestNotification ? (
                  <NotificationItem 
                    notification={latestNotification} 
                    onClick={() => handleNotificationClick(latestNotification)}
                    compact 
                  />
                ) : (
                  <>
                    <div className="text-left flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-medium tracking-wider uppercase bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
                          {isGeorgian ? (
                            <GeorgianAuthText fontWeight="medium">მოგესალმებით</GeorgianAuthText>
                          ) : (
                            'Welcome back'
                          )}
                        </span>
                        <span className="text-sm font-semibold text-foreground truncate">
                          {isGeorgian ? (
                            <GeorgianAuthText fontWeight="bold">{displayName}</GeorgianAuthText>
                          ) : (
                            <LanguageText>{displayName}</LanguageText>
                          )}
                        </span>
                      </div>
                      <p className="text-[10px] text-muted-foreground/60 truncate">
                        {isGeorgian ? (
                          <GeorgianAuthText fontWeight="medium">შეამოწმეთ შეტყობინებები</GeorgianAuthText>
                        ) : (
                          'Check your latest notifications'
                        )}
                      </p>
                    </div>
                  </>
                )}
              </div>

              {/* Badge & Arrow */}
              <div className="flex items-center gap-2 shrink-0">
                {unreadCount > 0 && (
                  <div className="flex items-center justify-center h-5 min-w-5 px-1.5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </div>
                )}
                <svg 
                  width="10" 
                  height="10" 
                  viewBox="0 0 12 12" 
                  className="text-muted-foreground/50"
                >
                  <path 
                    d="M2.5 4.5L6 8L9.5 4.5" 
                    stroke="currentColor" 
                    strokeWidth="1.5" 
                    strokeLinecap="round" 
                    strokeLinejoin="round"
                    fill="none"
                  />
                </svg>
              </div>
            </motion.div>
          )}

          {/* Expanded State */}
          {isExpanded && (
            <motion.div
              key="expanded"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15, ease: "easeOut" }}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/20">
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
                  className="h-7 w-7 rounded-lg bg-muted/30 hover:bg-muted/50"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsExpanded(false);
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>

              {/* Divider */}
              <div className="mx-4 h-px bg-border/30" />

              {/* Notification List */}
              <ScrollArea className="max-h-64">
                <div className="p-2 space-y-1">
                  {notifications.length === 0 ? (
                    <div className="py-8 text-center">
                      <div className="mx-auto w-10 h-10 rounded-xl bg-muted/20 flex items-center justify-center mb-2">
                        <Bell className="h-4 w-4 text-muted-foreground/40" />
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {isGeorgian ? (
                          <GeorgianAuthText>შეტყობინებები არ არის</GeorgianAuthText>
                        ) : (
                          language === 'es' ? 'No hay notificaciones' : 'No notifications yet'
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
                <>
                  <div className="mx-4 h-px bg-border/30" />
                  <div className="flex items-center justify-between px-3 py-2 gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs gap-1.5 rounded-lg hover:bg-primary/10 hover:text-primary"
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
                      className="h-7 text-xs gap-1.5 rounded-lg hover:bg-muted/50 text-foreground"
                      onClick={(e) => {
                        e.stopPropagation();
                        openFullPopup();
                      }}
                    >
                      <Maximize2 className="h-3.5 w-3.5" />
                      {getViewAllText()}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs gap-1.5 rounded-lg text-destructive hover:text-destructive hover:bg-destructive/10"
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

      {/* Full Notifications Popup */}
      <NotificationsPopup
        isOpen={showFullPopup}
        onClose={() => setShowFullPopup(false)}
        notifications={notifications}
        unreadCount={unreadCount}
        onNotificationClick={handleNotificationClick}
        onMarkAllAsRead={markAllAsRead}
        onClearAll={clearAll}
      />
    </div>
  );
};
