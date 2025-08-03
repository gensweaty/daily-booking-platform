import React, { useState, useEffect, useCallback } from 'react';
import { Calendar as CalendarIcon } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { EventDialog } from "@/components/Calendar/EventDialog";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CalendarEvent } from "@/lib/types";
import { supabase } from '@/integrations/supabase/client';
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";

interface Filter {
  label: string;
  value: string;
  checked: boolean;
}

const defaultFilters: Filter[] = [
  { label: 'Show Bookings', value: 'booking', checked: true },
  { label: 'Show Events', value: 'event', checked: true },
];

export function CalendarPage() {
  const [date, setDate] = useState<Date>(new Date());
  const [isCreateEventDialogOpen, setIsCreateEventDialogOpen] = useState(false);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [selectedEventForEdit, setSelectedEventForEdit] = useState<CalendarEvent | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { t } = useLanguage();
  const { toast } = useToast();
  const [filters, setFilters] = useState(defaultFilters);
  const [searchTerm, setSearchTerm] = useState('');

  // Function to toggle filter
  const toggleFilter = (value: string) => {
    setFilters(
      filters.map((filter) =>
        filter.value === value ? { ...filter, checked: !filter.checked } : filter
      )
    );
  };

  // Function to check if a type is active
  const isTypeActive = (type: string) => {
    return filters.find((filter) => filter.value === type)?.checked || false;
  };

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Get current user from auth context instead of Clerk
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        console.warn('User not available, skipping fetch.');
        return;
      }

      let query = supabase
        .from('events')
        .select('*')
        .eq('user_id', user.id)
        .order('start_date', { ascending: true });

      // Apply date filter
      const startOfDay = format(date, 'yyyy-MM-dd') + 'T00:00:00.000Z';
      const endOfDay = format(date, 'yyyy-MM-dd') + 'T23:59:59.999Z';

      query = query.gte('start_date', startOfDay).lte('start_date', endOfDay);

      const { data, error } = await query;

      if (error) {
        console.error("Error fetching events:", error);
        setError(t("calendar.fetchEventsError"));
      } else {
        const typedData = data as CalendarEvent[];
        setEvents(typedData || []);
      }
    } catch (err) {
      console.error("Unexpected error fetching events:", err);
      setError(t("calendar.fetchEventsError"));
    } finally {
      setLoading(false);
    }
  }, [date, t]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleEventCreated = async () => {
    toast({
      title: t("success.title"),
      description: t("calendar.eventCreated"),
    });
    await fetchData();
    setIsCreateEventDialogOpen(false);
  };

  const handleEventUpdated = async () => {
    toast({
      title: t("success.title"),
      description: t("calendar.eventUpdated"),
    });
    await fetchData();
    setSelectedEventForEdit(null);
  };

  const handleEventDeleted = async (eventId: string, deleteAll?: boolean) => {
    try {
      // Optimistically update the UI
      setEvents(prevEvents => prevEvents.filter(event => event.id !== eventId));

      // Delete the event using Supabase
      const { error } = await supabase
        .from('events')
        .delete()
        .eq('id', eventId);

      if (error) {
        console.error("Error deleting event:", error);
        toast({
          title: t("error.title"),
          description: t("calendar.eventDeleteError"),
          variant: "destructive",
        });
        // Revert the UI update if the deletion fails
        await fetchData();
        return;
      }

      toast({
        title: t("success.title"),
        description: t("calendar.eventDeleted"),
      });
    } catch (error) {
      console.error("Error deleting event:", error);
      toast({
        title: t("error.title"),
        description: t("calendar.eventDeleteError"),
        variant: "destructive",
      });
      // Revert the UI update if an error occurs
      await fetchData();
    } finally {
      setSelectedEventForEdit(null);
    }
  };

  // Filter events based on search term and type
  const filteredEvents = events.filter((event) => {
    const searchTermLower = searchTerm.toLowerCase();
    const matchesSearch =
      event.title.toLowerCase().includes(searchTermLower) ||
      event.user_surname.toLowerCase().includes(searchTermLower) ||
      (event.event_notes?.toLowerCase().includes(searchTermLower) ?? false);

    return matchesSearch && isTypeActive(event.type || 'event');
  });

  return (
    <div className="container mx-auto px-4 py-6">
      <div className="md:flex flex-row justify-between items-center mb-4">
        <div className="flex-1 flex items-center space-x-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant={"outline"}
                className={cn(
                  "w-[300px] justify-start text-left font-normal",
                  !date && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {date ? format(date, "PPP") : <span>{t("common.pickDate")}</span>}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={date}
                onSelect={setDate}
                initialFocus
              />
            </PopoverContent>
          </Popover>
          <Button onClick={fetchData} disabled={loading}>
            {loading && <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />}
            {t("common.refresh")}
          </Button>
        </div>
        <div className="md:flex-none flex flex-row items-center justify-end w-full md:w-auto">
          <Input
            type="search"
            placeholder={t("calendar.searchEvents")}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="max-w-md md:mr-4"
          />
          <Button onClick={() => setIsCreateEventDialogOpen(true)}>
            {t("calendar.addEvent")}
          </Button>
        </div>
      </div>

      <div className="mb-4">
        <Label className="block text-sm font-medium text-gray-700">{t("common.filters")}</Label>
        <div className="flex flex-wrap gap-2 mt-2">
          {filters.map((filter) => (
            <div key={filter.value} className="flex items-center space-x-2">
              <Checkbox
                id={filter.value}
                checked={filter.checked}
                onCheckedChange={() => toggleFilter(filter.value)}
              />
              <Label htmlFor={filter.value} className="text-gray-900">
                {filter.label}
              </Label>
            </div>
          ))}
        </div>
      </div>

      {error && (
        <div className="rounded-md bg-red-50 p-4">
          <div className="flex">
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">{t("error.title")}</h3>
              <div className="mt-2 text-sm text-red-700">
                <p>{error}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="mr-2 h-6 w-6 animate-spin rounded-full border-2 border-current border-t-transparent" />
          <span>{t("common.loading")}</span>
        </div>
      ) : filteredEvents.length === 0 ? (
        <div className="flex items-center justify-center h-48">
          <span>{t("calendar.noEvents")}</span>
        </div>
      ) : (
        <ScrollArea className="h-[400px] w-full rounded-md border">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 p-4">
            {filteredEvents.map((event) => (
              <Card key={event.id} onClick={() => setSelectedEventForEdit(event)} className="cursor-pointer">
                <CardHeader>
                  <CardTitle>{event.title}</CardTitle>
                  <CardDescription>
                    {format(new Date(event.start_date), "Pp")}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p>{event.user_surname}</p>
                  {event.type === 'booking' && (
                    <Badge variant="secondary">{t("common.booking")}</Badge>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </ScrollArea>
      )}

      {/* Create Event Dialog */}
      {isCreateEventDialogOpen && (
        <EventDialog
          key={date?.getTime() || 0}
          open={isCreateEventDialogOpen}
          onClose={() => setIsCreateEventDialogOpen(false)}
          selectedDate={date}
          onSave={handleEventCreated}
        />
      )}

      {/* Edit Event Dialog */}
      {selectedEventForEdit && (
        <EventDialog
          key={selectedEventForEdit.id}
          open={!!selectedEventForEdit}
          onClose={() => setSelectedEventForEdit(null)}
          selectedDate={date}
          initialData={selectedEventForEdit}
          onSave={handleEventUpdated}
          onDelete={handleEventDeleted}
          mode="edit"
        />
      )}
    </div>
  );
}

// Export both named and default exports for compatibility
export { CalendarPage as Calendar };
export default CalendarPage;
