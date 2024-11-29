import { format, isSameDay } from "date-fns";
import { CalendarEventType } from "@/lib/types/calendar";
import { Droppable } from "@hello-pangea/dnd";
import { DraggableEvent } from "./DraggableEvent";

interface CalendarViewProps {
  days: Date[];
  events: CalendarEventType[];
  selectedDate: Date;
  view: "month" | "week" | "day";
  onDayClick: (date: Date, hour?: number) => void;
  onEventClick: (event: CalendarEventType) => void;
}

export const CalendarView = ({
  days,
  events,
  selectedDate,
  view,
  onDayClick,
  onEventClick,
}: CalendarViewProps) => {
  const renderDayHeader = (day: string) => (
    <div key={day} className="bg-[#1e2330] p-2 sm:p-4 text-center font-semibold text-white">
      {day}
    </div>
  );

  if (view === "month") {
    return (
      <div className="grid grid-cols-7 gap-px bg-[#1e2330] rounded-lg overflow-hidden text-sm sm:text-base">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(renderDayHeader)}
        {days.map((day) => {
          const dayEvents = events.filter((event) => 
            isSameDay(new Date(event.start_date), day)
          );

          return (
            <Droppable key={day.toISOString()} droppableId={day.toISOString()}>
              {(provided) => (
                <div
                  ref={provided.innerRef}
                  {...provided.droppableProps}
                  className="bg-[#1e2330] p-2 sm:p-4 min-h-[80px] sm:min-h-[120px] cursor-pointer hover:bg-[#252b3b] border border-[#2a3142]"
                  onClick={() => onDayClick(day)}
                >
                  <div className="font-medium text-white">{format(day, "d")}</div>
                  <div className="mt-1 sm:mt-2 space-y-1">
                    {dayEvents.map((event, index) => (
                      <DraggableEvent
                        key={event.id}
                        event={event}
                        index={index}
                        onClick={onEventClick}
                      />
                    ))}
                    {provided.placeholder}
                  </div>
                </div>
              )}
            </Droppable>
          );
        })}
      </div>
    );
  }

  return (
    <div className="flex-1 grid bg-[#1e2330] rounded-lg overflow-y-auto" 
         style={{ gridTemplateColumns: `repeat(${view === 'week' ? 7 : 1}, 1fr)` }}>
      <div className="contents">
        {days.map((day) => (
          <div 
            key={day.toISOString()} 
            className="bg-[#1e2330] p-2 sm:p-4 text-center border-b border-[#2a3142]"
          >
            <div className="font-semibold text-sm text-white">{format(day, "EEE")}</div>
            <div className="text-xs text-gray-400">{format(day, "MMM d")}</div>
          </div>
        ))}
      </div>
      
      <div className="contents">
        {days.map((day) => (
          <div 
            key={day.toISOString()} 
            className="relative bg-[#1e2330] border-r border-[#2a3142]"
          >
            {Array.from({ length: 24 }).map((_, hour) => (
              <Droppable key={hour} droppableId={`${day.toISOString()}-${hour}`}>
                {(provided) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className="h-20 border-b border-[#2a3142] hover:bg-[#252b3b] transition-colors cursor-pointer"
                    onClick={() => onDayClick(day, hour)}
                  >
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            ))}
            {events
              .filter((event) => isSameDay(new Date(event.start_date), day))
              .map((event, index) => {
                const start = new Date(event.start_date);
                const end = new Date(event.end_date);
                const top = (start.getHours() + start.getMinutes() / 60) * 80;
                const height = ((end.getHours() + end.getMinutes() / 60) - 
                              (start.getHours() + start.getMinutes() / 60)) * 80;
                
                return (
                  <DraggableEvent
                    key={event.id}
                    event={event}
                    index={index}
                    style={{
                      top: `${top}px`,
                      height: `${Math.max(height, 20)}px`,
                    }}
                    onClick={onEventClick}
                  />
                );
              })}
          </div>
        ))}
      </div>
    </div>
  );
};