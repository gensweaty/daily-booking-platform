import React, { useState, useEffect } from 'react';
import { Calendar as CalendarIcon } from "lucide-react";
import { format, startOfWeek, addDays, startOfMonth, endOfMonth, isSameDay, isSameMonth, parseISO } from 'date-fns';
import { DateRange } from "react-day-picker";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar as CalendarUI } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from '@/lib/supabase';
import { EventForm } from '../events/EventForm';
import { Event } from '@/types/database';
import { EventList } from '../events/EventList';
import { useLanguage } from '@/contexts/LanguageContext';
import { BookingRequestList } from '../booking-requests/BookingRequestList';
import { EventReminderNotifications } from "./EventReminderNotifications";

interface Filter {
  label: string;
  value: string;
}

export const Calendar = () => {
  const [date, setDate] = useState<DateRange | undefined>({
    from: startOfWeek(new Date()),
    to: addDays(startOfWeek(new Date()), 6),
  });
  const [isEventFormOpen, setIsEventFormOpen] = useState(false);
  const [events, setEvents] = useState<Event[]>([]);
  const { user } = useAuth();
  const { t } = useLanguage();
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [filters, setFilters] = useState<Filter[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (!user) return;

    const fetchEvents = async () => {
      try {
        const startDate = date?.from ? format(date.from, 'yyyy-MM-dd') : null;
        const endDate = date?.to ? format(date.to, 'yyyy-MM-dd') : null;

        let query = supabase
          .from('events')
          .select('*')
          .eq('user_id', user.id)
          .order('start_date', { ascending: true });

        if (startDate && endDate) {
          query = query.gte('start_date', startDate).lte('start_date', endDate);
        }

        const { data: eventsData, error } = await query;

        if (error) {
          console.error("Error fetching events:", error);
        } else {
          setEvents(eventsData || []);
        }
      } catch (error) {
        console.error("Failed to fetch events:", error);
      }
    };

    fetchEvents();
  }, [date, user, isEventFormOpen]);

  const handleDateSelect = (newDate: DateRange | undefined) => {
    setDate(newDate);
  };

  const handleEventCreate = () => {
    setIsEventFormOpen(true);
    setSelectedEvent(null);
    setIsEditMode(false);
  };

  const handleEventEdit = (event: Event) => {
    setSelectedEvent(event);
    setIsEventFormOpen(true);
    setIsEditMode(true);
  };

  const handleEventDelete = async (eventId: string) => {
    try {
      const { error } = await supabase
        .from('events')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', eventId);

      if (error) {
        console.error("Error deleting event:", error);
      } else {
        setEvents(events.filter(event => event.id !== eventId));
      }
    } catch (error) {
      console.error("Failed to delete event:", error);
    }
  };

  const handleFormClose = () => {
    setIsEventFormOpen(false);
    setSelectedEvent(null);
    setIsEditMode(false);
  };

  const handleFilterChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { value, checked } = e.target;
    setFilters(prevFilters => {
      if (checked) {
        return [...prevFilters, { label: value, value }];
      } else {
        return prevFilters.filter(filter => filter.value !== value);
      }
    });
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
  };

  const filteredEvents = events.filter(event => {
    const matchesFilters = filters.length === 0 || filters.some(filter => event.type === filter.value);
    const matchesSearch = searchTerm === '' || event.title?.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesFilters && matchesSearch;
  });

  return (
    <>
      <EventReminderNotifications />
      <div className="flex flex-col md:flex-row gap-4">
        <div className="w-full md:w-1/3">
          <div className="border rounded-md p-4">
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant={"outline"}
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !date && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {date?.from ? (
                    date.to ? (
                      `${format(date.from, "LLL dd, y")} - ${format(
                        date.to,
                        "LLL dd, y"
                      )}`
                    ) : (
                      format(date.from, "LLL dd, y")
                    )
                  ) : (t('common.pickDate'))}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <CalendarUI
                  initialFocus
                  mode="range"
                  defaultMonth={date?.from}
                  selected={date}
                  onSelect={handleDateSelect}
                  numberOfMonths={1}
                  pagedNavigation
                  className="border-0 rounded-md"
                />
              </PopoverContent>
            </Popover>
            <Button className="w-full mt-4" onClick={handleEventCreate}>{t('events.createEvent')}</Button>

            <div className="mt-4">
              <Input
                type="text"
                placeholder={t('common.search')}
                value={searchTerm}
                onChange={handleSearchChange}
              />
            </div>

            <div className="mt-4">
              <Label>{t('common.filterByType')}</Label>
              <div>
                <label className="block">
                  <Input
                    type="checkbox"
                    value="meeting"
                    checked={filters.some(filter => filter.value === 'meeting')}
                    onChange={handleFilterChange}
                  />
                  {t('events.meeting')}
                </label>
                <label className="block">
                  <Input
                    type="checkbox"
                    value="task"
                    checked={filters.some(filter => filter.value === 'task')}
                    onChange={handleFilterChange}
                  />
                  {t('tasks.task')}
                </label>
                <label className="block">
                  <Input
                    type="checkbox"
                    value="event"
                    checked={filters.some(filter => filter.value === 'event')}
                    onChange={handleFilterChange}
                  />
                  {t('events.event')}
                </label>
              </div>
            </div>
          </div>
          <div className="mt-4">
            <BookingRequestList />
          </div>
        </div>
        <div className="w-full md:w-2/3">
          <EventList
            events={filteredEvents}
            onEdit={handleEventEdit}
            onDelete={handleEventDelete}
          />
        </div>
      </div>

      {isEventFormOpen && (
        <EventForm
          isOpen={isEventFormOpen}
          onClose={handleFormClose}
          onEventCreated={() => setIsEventFormOpen(false)}
          event={selectedEvent}
          isEditMode={isEditMode}
        />
      )}
    </>
  );
};
