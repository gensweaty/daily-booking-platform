
import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export const RecurringEventDebugger = () => {
  const { user } = useAuth();
  const [isCreatingTest, setIsCreatingTest] = useState(false);

  // Fetch ALL events for debugging
  const { data: allEvents = [], refetch: refetchEvents } = useQuery({
    queryKey: ['debug-all-events', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .eq('user_id', user.id)
        .is('deleted_at', null)
        .order('start_date', { ascending: true });
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id,
  });

  // Separate parent and child events
  const parentEvents = allEvents.filter(event => !event.parent_event_id);
  const childEvents = allEvents.filter(event => !!event.parent_event_id);
  const recurringParentEvents = parentEvents.filter(event => event.is_recurring);

  // Get current date for filtering recent events
  const now = new Date();
  const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const oneMonthFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  
  const recentEvents = allEvents.filter(event => {
    const eventDate = new Date(event.start_date);
    return eventDate >= oneWeekAgo && eventDate <= oneMonthFromNow;
  });

  const createTestRecurringSeries = async () => {
    if (!user?.id) return;
    
    setIsCreatingTest(true);
    try {
      console.log("🚀 Creating test recurring series...");
      
      // Create a weekly recurring event starting from next Monday
      const nextMonday = getNextMonday();
      const endTime = new Date(nextMonday.getTime() + 60 * 60 * 1000); // 1 hour later
      const repeatUntil = new Date(nextMonday.getTime() + 21 * 24 * 60 * 60 * 1000); // 3 weeks later
      
      const eventPayload = {
        title: "Test Weekly Series",
        user_surname: "Test Weekly Series",
        user_number: "+1234567890",
        social_network_link: "test@example.com",
        event_notes: "Auto-generated test recurring event series",
        event_name: "Test Event",
        start_date: nextMonday.toISOString(),
        end_date: endTime.toISOString(),
        payment_status: "not_paid",
        payment_amount: null,
        type: "event",
        is_recurring: true,
        repeat_pattern: "weekly",
        repeat_until: repeatUntil.toISOString().slice(0, 10) // YYYY-MM-DD format
      };

      console.log("🔄 Test event payload:", eventPayload);

      const { data: savedEventId, error } = await supabase.rpc('save_event_with_persons', {
        p_event_data: eventPayload,
        p_additional_persons: [],
        p_user_id: user.id,
        p_event_id: null
      });

      if (error) {
        console.error("❌ Error creating test series:", error);
        throw error;
      }

      console.log("✅ Test series created with parent ID:", savedEventId);
      
      // Wait for child events to be created
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Force refetch to see new events
      await refetchEvents();
      
      console.log("🔄 Refetched events after test series creation");
      
    } catch (error) {
      console.error("❌ Failed to create test series:", error);
    } finally {
      setIsCreatingTest(false);
    }
  };

  const getNextMonday = () => {
    const today = new Date();
    const daysUntilMonday = (1 + 7 - today.getDay()) % 7 || 7; // 1 = Monday
    const nextMonday = new Date(today.getTime() + daysUntilMonday * 24 * 60 * 60 * 1000);
    nextMonday.setHours(10, 0, 0, 0); // Set to 10 AM
    return nextMonday;
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString();
  };

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle className="flex justify-between items-center">
          <span>🔍 Recurring Events Debugger</span>
          <Button 
            onClick={createTestRecurringSeries}
            disabled={isCreatingTest}
            variant="outline"
            size="sm"
          >
            {isCreatingTest ? "Creating..." : "Create Test Weekly Series"}
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Summary Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
          <div className="bg-blue-50 p-3 rounded">
            <div className="text-2xl font-bold text-blue-600">{allEvents.length}</div>
            <div className="text-sm text-blue-800">Total Events</div>
          </div>
          <div className="bg-green-50 p-3 rounded">
            <div className="text-2xl font-bold text-green-600">{parentEvents.length}</div>
            <div className="text-sm text-green-800">Parent Events</div>
          </div>
          <div className="bg-purple-50 p-3 rounded">
            <div className="text-2xl font-bold text-purple-600">{childEvents.length}</div>
            <div className="text-sm text-purple-800">Child Events</div>
          </div>
          <div className="bg-orange-50 p-3 rounded">
            <div className="text-2xl font-bold text-orange-600">{recurringParentEvents.length}</div>
            <div className="text-sm text-orange-800">Recurring Series</div>
          </div>
        </div>

        {/* Recent Events (Past Week to Next Month) */}
        <div className="space-y-2">
          <h3 className="text-lg font-semibold">📅 Recent & Upcoming Events (Past Week to Next Month):</h3>
          {recentEvents.length === 0 ? (
            <p className="text-gray-500">No recent or upcoming events found.</p>
          ) : (
            <div className="max-h-60 overflow-y-auto space-y-1">
              {recentEvents.map(event => (
                <div key={event.id} className={`p-2 rounded text-sm ${
                  event.parent_event_id 
                    ? 'bg-purple-50 border-l-4 border-purple-400' 
                    : event.is_recurring 
                      ? 'bg-green-50 border-l-4 border-green-400' 
                      : 'bg-gray-50 border-l-4 border-gray-400'
                }`}>
                  <div className="font-medium">
                    {event.title} {event.parent_event_id ? '(Child)' : event.is_recurring ? '(Parent)' : '(Single)'}
                  </div>
                  <div className="text-gray-600">
                    {formatDate(event.start_date)} - {event.repeat_pattern || 'No repeat'}
                    {event.parent_event_id && ` - Parent: ${event.parent_event_id.slice(-8)}`}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recurring Series Details */}
        {recurringParentEvents.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-lg font-semibold">🔄 Recurring Series Details:</h3>
            {recurringParentEvents.map(parentEvent => {
              const children = childEvents.filter(child => child.parent_event_id === parentEvent.id);
              return (
                <div key={parentEvent.id} className="bg-green-50 p-3 rounded border">
                  <div className="font-medium text-green-800">
                    📊 {parentEvent.title} - {parentEvent.repeat_pattern} until {parentEvent.repeat_until}
                  </div>
                  <div className="text-sm text-green-700 mt-1">
                    Parent starts: {formatDate(parentEvent.start_date)}
                  </div>
                  <div className="text-sm text-green-700">
                    Child instances: {children.length}
                  </div>
                  {children.length > 0 && (
                    <div className="mt-2 ml-4 space-y-1">
                      {children.slice(0, 3).map(child => (
                        <div key={child.id} className="text-xs text-purple-700">
                          → {formatDate(child.start_date)}
                        </div>
                      ))}
                      {children.length > 3 && (
                        <div className="text-xs text-purple-700">
                          → ... and {children.length - 3} more
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Raw Data for Latest 5 Events */}
        <details className="mt-4">
          <summary className="cursor-pointer font-medium">🔍 Latest 5 Events (Raw Data)</summary>
          <pre className="mt-2 p-3 bg-gray-100 rounded text-xs overflow-auto max-h-40">
            {JSON.stringify(allEvents.slice(-5), null, 2)}
          </pre>
        </details>
      </CardContent>
    </Card>
  );
};
