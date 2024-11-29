import { format, isSameDay, parseISO, addHours, setHours } from "date-fns";
import { CalendarEventType } from "@/lib/types/calendar";
import { DragDropContext, Droppable } from "@hello-pangea/dnd";
import { DraggableEvent } from "./DraggableEvent";

interface CalendarViewProps {
  days: Date[];
  events: CalendarEventType[];
  selectedDate: Date;
  view: "month" | "week" | "day";
  onDayClick: (date: Date, hour?: number) => void;
  onEventClick: (event: CalendarEventType) => void;
  onEventDrop?: (event: CalendarEventType, newDate: Date, newHour?: number) => void;
}

export const CalendarView = ({
  days,
  events,
  selectedDate,
  view,
  onDayClick,
  onEventClick,
  onEventDrop,
}: CalendarViewProps) => {
  const handleDragEnd = (result: any) => {
    if (!result.destination || !onEventDrop) return;

    const [eventId, sourceDate] = result.draggableId.split("-");
    const event = events.find((e) => e.id === eventId);
    if (!event) return;

    const [destDate, destHour] = result.destination.droppableId.split("-");
    const newDate = new Date(destDate);
    const newHour = destHour ? parseInt(destHour) : undefined;

    onEventDrop(event, newDate, newHour);
  };

  const renderDayHeader = (day: string) => (
    <div key={day} className="bg-[#1e2330] p-2 sm:p-4 text-center font-semibold text-white">
      {day}
    </div>
  );

  if (view === "month") {
    return (
      <DragDropContext onDragEnd={handleDragEnd}>
        <div className="grid grid-cols-7 gap-px bg-[#1e2330] rounded-lg overflow-hidden text-sm sm:text-base">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(renderDayHeader)}
          {days.map((day) => {
            const dayEvents = events.filter((event) => 
              isSameDay(parseISO(event.start_date), day)
            );

            return (
              <Droppable droppableId={day.toISOString()}>
                {(provided) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    key={day.toISOString()}
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
      </DragDropContext>
    );
  }

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
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
                      onClick={() => {
                        const date = new Date(day);
                        date.setHours(hour, 0, 0, 0);
                        onDayClick(date, hour);
                      }}
                    >
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              ))}
              {events
                .filter((event) => isSameDay(parseISO(event.start_date), day))
                .map((event, index) => {
                  const start = parseISO(event.start_date);
                  const end = parseISO(event.end_date);
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
    </DragDropContext>
  );
};