
import React from 'react';
import { CalendarEventType } from '@/lib/types/calendar';

interface EventListProps {
  events: CalendarEventType[];
  onEdit: (event: CalendarEventType) => void;
  onDelete: (eventId: string) => void;
}

export const EventList: React.FC<EventListProps> = ({
  events,
  onEdit,
  onDelete
}) => {
  return (
    <div className="space-y-2">
      {events.length === 0 ? (
        <p className="text-gray-500 text-center py-4">No events found</p>
      ) : (
        events.map((event) => (
          <div key={event.id} className="border rounded p-3 bg-white shadow-sm">
            <h3 className="font-medium">{event.title}</h3>
            <p className="text-sm text-gray-600">
              {new Date(event.start_date).toLocaleDateString()}
            </p>
            <div className="flex gap-2 mt-2">
              <button 
                onClick={() => onEdit(event)}
                className="text-blue-600 hover:text-blue-800 text-sm"
              >
                Edit
              </button>
              <button 
                onClick={() => onDelete(event.id)}
                className="text-red-600 hover:text-red-800 text-sm"
              >
                Delete
              </button>
            </div>
          </div>
        ))
      )}
    </div>
  );
};
