import { useQuery } from "@tanstack/react-query";
import { getReminders } from "@/lib/api";
import { Reminder } from "@/lib/types";
import { format } from "date-fns";

export const ReminderList = () => {
  const { data: reminders, isLoading } = useQuery({
    queryKey: ['reminders'],
    queryFn: getReminders,
  });

  if (isLoading) return <div>Loading reminders...</div>;

  return (
    <div className="space-y-4">
      {reminders?.map((reminder: Reminder) => (
        <div
          key={reminder.id}
          className="p-4 bg-white rounded-lg shadow border border-gray-200"
        >
          <h3 className="font-semibold">{reminder.title}</h3>
          {reminder.description && (
            <p className="text-gray-600 mt-1">{reminder.description}</p>
          )}
          <div className="mt-2 text-sm text-gray-500">
            Due: {format(new Date(reminder.due_date), 'PPP')}
          </div>
        </div>
      ))}
    </div>
  );
};