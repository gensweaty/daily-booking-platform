
import { useState } from "react";
import { useCalendar } from "./hooks/useCalendar";
import { CalendarHeader } from "./CalendarHeader";
import { CalendarView } from "./CalendarView";
import { EventDialog } from "./EventDialog";
import { TimeIndicator } from "./TimeIndicator";
import { CalendarViewType } from "@/lib/types/calendar";
import { Skeleton } from "@/components/ui/skeleton";

interface CalendarContainerProps {
  defaultView?: CalendarViewType;
  publicMode?: boolean;
  externalEvents?: any[];
  businessId?: string;
  fromDashboard?: boolean;
}

export const CalendarContainer = ({
  defaultView = "week",
  publicMode = false,
  externalEvents,
  businessId,
  fromDashboard = false
}: CalendarContainerProps) => {
  const {
    selectedDate,
    view,
    days,
    displayEvents,
    isLoading,
    error,
    publicMode: isPublic,
    user,
    navigate,
    
    selectedEvent,
    setSelectedEvent,
    isNewEventDialogOpen,
    setIsNewEventDialogOpen,
    dialogSelectedDate,
    
    setView,
    handlePrevious,
    handleNext,
    handleCalendarDayClick,
    handleAddEventClick,
    handleCreateEvent,
    handleUpdateEvent,
    handleDeleteEvent
  } = useCalendar(defaultView, publicMode, externalEvents, businessId, fromDashboard);

  if (!publicMode && !user) {
    navigate("/signin");
    return null;
  }

  if (error && !publicMode) {
    return <div className="text-red-500">Error loading calendar: {error.message}</div>;
  }

  if (isLoading && !publicMode && !externalEvents) {
    return (
      <div className="space-y-4">
        <div className="h-10 w-full bg-gray-200 animate-pulse rounded" />
        <div className="grid grid-cols-7 gap-px">
          {Array.from({ length: 35 }).map((_, i) => (
            <Skeleton key={i} className="h-32 w-full" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col gap-4">
      <CalendarHeader
        selectedDate={selectedDate}
        view={view}
        onViewChange={setView}
        onPrevious={handlePrevious}
        onNext={handleNext}
        onAddEvent={!publicMode ? handleAddEventClick : undefined}
      />

      <div className={`flex-1 flex ${view !== 'month' ? 'overflow-hidden' : ''}`}>
        {view !== 'month' && <TimeIndicator />}
        <div className="flex-1">
          <CalendarView
            days={days}
            events={displayEvents}
            selectedDate={selectedDate}
            view={view}
            onDayClick={handleCalendarDayClick}
            onEventClick={!publicMode ? setSelectedEvent : () => {}}
            publicMode={publicMode}
          />
        </div>
      </div>

      {!publicMode && (
        <>
          <EventDialog
            key={`new-${dialogSelectedDate?.getTime()}`}
            open={isNewEventDialogOpen}
            onOpenChange={setIsNewEventDialogOpen}
            selectedDate={dialogSelectedDate}
            onSubmit={handleCreateEvent}
            businessId={businessId}
          />

          {selectedEvent && (
            <EventDialog
              key={`edit-${selectedEvent.id}`}
              open={!!selectedEvent}
              onOpenChange={() => setSelectedEvent(null)}
              selectedDate={new Date(selectedEvent.start_date)}
              event={selectedEvent}
              onSubmit={handleUpdateEvent}
              onDelete={handleDeleteEvent}
              businessId={businessId || selectedEvent.business_id}
            />
          )}
        </>
      )}

      {publicMode && isNewEventDialogOpen && dialogSelectedDate && (
        <EventDialog
          key={`public-${dialogSelectedDate?.getTime()}`}
          open={isNewEventDialogOpen}
          onOpenChange={setIsNewEventDialogOpen}
          selectedDate={dialogSelectedDate}
          onSubmit={handleCreateEvent}
          businessId={businessId}
        />
      )}
    </div>
  );
};
