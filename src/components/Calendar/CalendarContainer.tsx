import { DragDropContext } from "@hello-pangea/dnd";
import { CalendarEventType } from "@/lib/types/calendar";
import { CalendarHeader } from "./CalendarHeader";
import { CalendarView } from "./CalendarView";
import { TimeIndicator } from "./TimeIndicator";
import { useCalendarState } from "./hooks/useCalendarState";
import { useCalendarHandlers } from "./hooks/useCalendarHandlers";

export const CalendarContainer = () => {
  const {
    selectedDate,
    view,
    events,
    isLoading,
    error,
    selectedEvent,
    isNewEventDialogOpen,
    selectedSlot,
  } = useCalendarState();

  const {
    handleEventDrop,
    handleDayClick,
    handlePrevious,
    handleNext,
    setView,
    setSelectedEvent,
    setIsNewEventDialogOpen,
    setSelectedSlot,
  } = useCalendarHandlers();

  if (error) {
    return <div className="text-red-500">Error loading calendar: {error.message}</div>;
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-10 w-full bg-gray-200 animate-pulse rounded" />
        <div className="grid grid-cols-7 gap-px">
          {Array.from({ length: 35 }).map((_, i) => (
            <div key={i} className="h-32 w-full bg-gray-200 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <DragDropContext onDragEnd={(result) => {
      if (!result.destination) return;
      const [eventId] = result.draggableId.split("-");
      const event = events.find((e) => e.id === eventId);
      if (!event) return;

      const [destDate, destHour] = result.destination.droppableId.split("-");
      const newDate = new Date(destDate);
      const newHour = destHour ? parseInt(destHour) : undefined;

      handleEventDrop(event, newDate, newHour);
    }}>
      <div className="h-full flex flex-col gap-4">
        <CalendarHeader
          selectedDate={selectedDate}
          view={view}
          onViewChange={setView}
          onPrevious={handlePrevious}
          onNext={handleNext}
          onAddEvent={() => {
            setSelectedSlot({ date: new Date() });
            setIsNewEventDialogOpen(true);
          }}
        />

        <div className={`flex-1 flex ${view !== 'month' ? 'overflow-hidden' : ''}`}>
          {view !== 'month' && <TimeIndicator />}
          <div className="flex-1">
            <CalendarView
              days={getDaysForView(selectedDate, view)}
              events={events || []}
              selectedDate={selectedDate}
              view={view}
              onDayClick={handleDayClick}
              onEventClick={setSelectedEvent}
            />
          </div>
        </div>
      </div>
    </DragDropContext>
  );
};