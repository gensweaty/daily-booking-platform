
import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export const RecurringEventDebugger = () => {
  const { user } = useAuth();
  const [debugData, setDebugData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const checkRecurringEvents = async () => {
    if (!user?.id) return;
    
    setLoading(true);
    console.log("🔍 Debug: Checking recurring events in database...");
    
    try {
      // Get all events for the user
      const { data: allEvents, error: eventsError } = await supabase
        .from('events')
        .select('*')
        .eq('user_id', user.id)
        .is('deleted_at', null)
        .order('start_date', { ascending: true });

      if (eventsError) throw eventsError;

      // Separate parent and child events
      const parentEvents = allEvents?.filter(e => !e.parent_event_id) || [];
      const childEvents = allEvents?.filter(e => !!e.parent_event_id) || [];
      
      // Find recurring parent events
      const recurringParents = parentEvents.filter(e => e.is_recurring);
      
      // Check for July 4th events specifically
      const july4Events = allEvents?.filter(e => {
        const eventDate = new Date(e.start_date);
        return eventDate.getMonth() === 6 && eventDate.getDate() === 4;
      }) || [];
      
      // Test the database function directly
      let functionTestResult = null;
      if (recurringParents.length > 0) {
        const testEvent = recurringParents[0];
        console.log("🧪 Testing generate_recurring_events function with:", testEvent);
        
        const { data: functionResult, error: functionError } = await supabase.rpc('generate_recurring_events', {
          p_parent_event_id: testEvent.id,
          p_start_date: testEvent.start_date,
          p_end_date: testEvent.end_date,
          p_repeat_pattern: testEvent.repeat_pattern,
          p_repeat_until: testEvent.repeat_until,
          p_user_id: user.id
        });
        
        if (functionError) {
          functionTestResult = { error: functionError };
        } else {
          functionTestResult = { success: true, generated: functionResult };
        }
      }

      setDebugData({
        totalEvents: allEvents?.length || 0,
        parentEvents: parentEvents.length,
        childEvents: childEvents.length,
        recurringParents: recurringParents.length,
        july4Events: july4Events.length,
        allEvents: allEvents || [],
        parentEventsData: parentEvents,
        childEventsData: childEvents,
        recurringParentsData: recurringParents,
        july4EventsData: july4Events,
        functionTestResult
      });
      
    } catch (error) {
      console.error("❌ Debug error:", error);
      setDebugData({ error: error.message });
    } finally {
      setLoading(false);
    }
  };

  const createTestRecurringEvent = async () => {
    if (!user?.id) return;
    
    setLoading(true);
    try {
      const testEventData = {
        title: "Debug Weekly Test",
        user_surname: "Debug Weekly Test",
        start_date: "2025-07-04T09:00:00.000Z",
        end_date: "2025-07-04T10:00:00.000Z",
        is_recurring: true,
        repeat_pattern: "weekly",
        repeat_until: "2025-08-01", // Explicit YYYY-MM-DD format
        payment_status: "not_paid",
        payment_amount: "",
        type: "event"
      };

      console.log("🧪 Creating test recurring event:", testEventData);

      const { data: eventId, error } = await supabase.rpc('save_event_with_persons', {
        p_event_data: testEventData,
        p_additional_persons: [],
        p_user_id: user.id,
        p_event_id: null
      });

      if (error) throw error;
      
      console.log("✅ Test event created with ID:", eventId);
      
      // Wait a moment then check for child events
      setTimeout(() => {
        checkRecurringEvents();
      }, 2000);
      
    } catch (error) {
      console.error("❌ Test event creation error:", error);
      setDebugData({ error: error.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle>Recurring Events Debugger</CardTitle>
        <div className="flex gap-2">
          <Button onClick={checkRecurringEvents} disabled={loading}>
            {loading ? "Checking..." : "Check Database"}
          </Button>
          <Button onClick={createTestRecurringEvent} disabled={loading} variant="outline">
            Create Test Event
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {debugData && (
          <div className="space-y-4">
            {debugData.error ? (
              <div className="text-red-500">Error: {debugData.error}</div>
            ) : (
              <>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>Total Events: {debugData.totalEvents}</div>
                  <div>Parent Events: {debugData.parentEvents}</div>
                  <div>Child Events: {debugData.childEvents}</div>
                  <div>Recurring Parents: {debugData.recurringParents}</div>
                  <div>July 4th Events: {debugData.july4Events}</div>
                </div>
                
                {debugData.functionTestResult && (
                  <div className="border p-2 rounded">
                    <strong>Function Test Result:</strong>
                    <pre className="text-xs mt-1">
                      {JSON.stringify(debugData.functionTestResult, null, 2)}
                    </pre>
                  </div>
                )}
                
                {debugData.recurringParentsData.length > 0 && (
                  <div className="border p-2 rounded">
                    <strong>Recurring Parent Events:</strong>
                    <pre className="text-xs mt-1 max-h-40 overflow-y-auto">
                      {JSON.stringify(debugData.recurringParentsData, null, 2)}
                    </pre>
                  </div>
                )}
                
                {debugData.childEventsData.length > 0 && (
                  <div className="border p-2 rounded">
                    <strong>Child Events (Generated Instances):</strong>
                    <pre className="text-xs mt-1 max-h-40 overflow-y-auto">
                      {JSON.stringify(debugData.childEventsData, null, 2)}
                    </pre>
                  </div>
                )}
                
                {debugData.july4EventsData.length > 0 && (
                  <div className="border p-2 rounded">
                    <strong>July 4th Events:</strong>
                    <pre className="text-xs mt-1 max-h-40 overflow-y-auto">
                      {JSON.stringify(debugData.july4EventsData, null, 2)}
                    </pre>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
