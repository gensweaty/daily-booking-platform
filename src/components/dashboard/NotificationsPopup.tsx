import { memo, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, X, CheckCheck, Trash2 } from 'lucide-react';
import { DashboardNotification } from '@/types/notifications';
import { NotificationItem } from './NotificationItem';
import { useLanguage } from '@/contexts/LanguageContext';
import { GeorgianAuthText } from '@/components/shared/GeorgianAuthText';
import { Button } from '@/components/ui/button';

interface NotificationsPopupProps {
  isOpen: boolean;
  onClose: () => void;
  notifications: DashboardNotification[];
  unreadCount: number;
  onNotificationClick: (notification: DashboardNotification) => void;
  onMarkAllAsRead: () => void;
  onClearAll: () => void;
}

export const NotificationsPopup = memo(({
  isOpen,
  onClose,
  notifications,
  unreadCount,
  onNotificationClick,
  onMarkAllAsRead,
  onClearAll,
}: NotificationsPopupProps) => {
  const { language } = useLanguage();
  const isGeorgian = language === 'ka';
  const [mounted, setMounted] = useState(false);
  const [currentTheme, setCurrentTheme] = useState<string>('dark');

  useEffect(() => {
    setMounted(true);
    
    const updateTheme = () => {
      const isDark = document.documentElement.classList.contains('dark');
      setCurrentTheme(isDark ? 'dark' : 'light');
    };
    
    updateTheme();
    
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.attributeName === 'class') {
          updateTheme();
        }
      });
    });
    
    observer.observe(document.documentElement, { attributes: true });
    
    return () => observer.disconnect();
  }, []);

  const isDarkMode = mounted ? currentTheme === 'dark' : true;

  // Lock body scroll when popup is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  const getTranslatedText = (key: 'notifications' | 'new' | 'noNotifications' | 'markAllRead' | 'clear' | 'allNotifications') => {
    const translations: Record<string, Record<string, string>> = {
      notifications: {
        en: 'Notifications',
        es: 'Notificaciones',
        ka: 'შეტყობინებები'
      },
      new: {
        en: 'new',
        es: 'nuevas',
        ka: 'ახალი'
      },
      noNotifications: {
        en: 'No notifications yet',
        es: 'No hay notificaciones',
        ka: 'შეტყობინებები არ არის'
      },
      markAllRead: {
        en: 'Mark all read',
        es: 'Marcar leído',
        ka: 'ყველას წაკითხვა'
      },
      clear: {
        en: 'Clear',
        es: 'Limpiar',
        ka: 'გასუფთავება'
      },
      allNotifications: {
        en: 'All Notifications',
        es: 'Todas las Notificaciones',
        ka: 'ყველა შეტყობინება'
      }
    };
    return translations[key]?.[language] || translations[key]?.en || key;
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50"
            onClick={onClose}
          />
          
          {/* Popup - Centered Modal */}
          <motion.div
            key="popup"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
            className="fixed z-50 left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 
              w-[92vw] max-w-md rounded-2xl overflow-hidden shadow-2xl flex flex-col"
            style={{
              maxHeight: 'min(85vh, 600px)',
              background: isDarkMode 
                ? 'linear-gradient(145deg, hsl(220 26% 16%), hsl(220 26% 12%))'
                : 'linear-gradient(145deg, hsl(0 0% 100%), hsl(220 14% 96%))',
              border: isDarkMode 
                ? '1px solid hsl(var(--primary) / 0.2)' 
                : '1px solid hsl(220 14% 90%)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-border/30">
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-primary/20">
                  <Bell className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <span className="text-base font-semibold text-foreground">
                    {isGeorgian ? (
                      <GeorgianAuthText fontWeight="bold">{getTranslatedText('allNotifications')}</GeorgianAuthText>
                    ) : (
                      getTranslatedText('allNotifications')
                    )}
                  </span>
                  {unreadCount > 0 && (
                    <p className="text-xs text-primary">
                      {unreadCount} {getTranslatedText('new')}
                    </p>
                  )}
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 rounded-xl bg-muted/30 hover:bg-muted/50"
                onClick={onClose}
              >
                <X className="h-5 w-5" />
              </Button>
            </div>

            {/* Notification List - Scrollable */}
            <div className="flex-1 overflow-y-auto min-h-0">
              <div className="p-3 space-y-1">
                {notifications.length === 0 ? (
                  <div className="py-12 text-center">
                    <div className="mx-auto w-14 h-14 rounded-2xl bg-muted/20 flex items-center justify-center mb-3">
                      <Bell className="h-6 w-6 text-muted-foreground/40" />
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {isGeorgian ? (
                        <GeorgianAuthText>{getTranslatedText('noNotifications')}</GeorgianAuthText>
                      ) : (
                        getTranslatedText('noNotifications')
                      )}
                    </p>
                  </div>
                ) : (
                  notifications.map((notification) => (
                    <NotificationItem
                      key={notification.id}
                      notification={notification}
                      onClick={() => {
                        onNotificationClick(notification);
                        onClose();
                      }}
                    />
                  ))
                )}
              </div>
            </div>

            {/* Footer Actions - Always visible */}
            {notifications.length > 0 && (
              <div className="border-t border-border/30 px-4 py-3 shrink-0">
                <div className="flex items-center justify-between gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-9 text-xs gap-1.5 rounded-lg hover:bg-primary/10 hover:text-primary flex-1"
                    onClick={onMarkAllAsRead}
                  >
                    <CheckCheck className="h-3.5 w-3.5" />
                    {getTranslatedText('markAllRead')}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-9 text-xs gap-1.5 rounded-lg text-destructive hover:text-destructive hover:bg-destructive/10 flex-1"
                    onClick={onClearAll}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    {getTranslatedText('clear')}
                  </Button>
                </div>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
});

NotificationsPopup.displayName = 'NotificationsPopup';
