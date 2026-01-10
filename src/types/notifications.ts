export type NotificationType = 
  | 'comment' 
  | 'chat' 
  | 'booking' 
  | 'task_reminder' 
  | 'event_reminder' 
  | 'custom_reminder';

export interface DashboardNotification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  timestamp: Date;
  read: boolean;
  actionData?: {
    taskId?: string;
    channelId?: string;
    eventId?: string;
    bookingId?: string;
    reminderId?: string;
  };
}

export interface DashboardNotificationEvent {
  type: NotificationType;
  title: string;
  message: string;
  actionData?: DashboardNotification['actionData'];
}
