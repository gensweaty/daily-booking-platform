
import { supabase } from "@/lib/supabase";

export const debugRecurringEvent = async (eventId: string, userId: string) => {
  console.log("🔍 DEBUG: Starting recurring event investigation for:", { eventId, userId });
  
  try {
    // Check if the parent event exists and has correct recurring settings
    const { data: parentEvent, error: parentError } = await supabase
      .from('events')
      .select('*')
      .eq('id', eventId)
      .eq('user_id', userId)
      .single();
    
    if (parentError) {
      console.error("❌ Error fetching parent event:", parentError);
      return;
    }
    
    console.log("📋 Parent event data:", {
      id: parentEvent.id,
      title: parentEvent.title,
      is_recurring: parentEvent.is_recurring,
      repeat_pattern: parentEvent.repeat_pattern,
      repeat_until: parentEvent.repeat_until,
      start_date: parentEvent.start_date,
      end_date: parentEvent.end_date
    });
    
    // Check for child events
    const { data: childEvents, error: childError } = await supabase
      .from('events')
      .select('*')
      .eq('parent_event_id', eventId)
      .eq('user_id', userId);
    
    if (childError) {
      console.error("❌ Error fetching child events:", childError);
      return;
    }
    
    console.log(`🔍 Found ${childEvents?.length || 0} child events:`);
    if (childEvents && childEvents.length > 0) {
      childEvents.forEach((child, index) => {
        console.log(`  Child Event ${index + 1}:`, {
          id: child.id,
          title: child.title,
          start_date: child.start_date,
          parent_event_id: child.parent_event_id
        });
      });
    }
    
    // Check for additional persons associated with the parent event
    const { data: parentPersons, error: personsError } = await supabase
      .from('customers')
      .select('*')
      .eq('event_id', eventId)
      .eq('user_id', userId);
    
    if (personsError) {
      console.error("❌ Error fetching parent event persons:", personsError);
    } else {
      console.log(`👥 Found ${parentPersons?.length || 0} persons for parent event`);
    }
    
    // Test the generate_recurring_events function directly
    if (parentEvent.is_recurring && parentEvent.repeat_pattern) {
      console.log("🧪 Testing generate_recurring_events function directly...");
      
      const { data: functionResult, error: functionError } = await supabase
        .rpc('generate_recurring_events', {
          p_parent_event_id: eventId,
          p_start_date: parentEvent.start_date,
          p_end_date: parentEvent.end_date,
          p_repeat_pattern: parentEvent.repeat_pattern,
          p_repeat_until: parentEvent.repeat_until,
          p_user_id: userId
        });
      
      if (functionError) {
        console.error("❌ generate_recurring_events function error:", functionError);
      } else {
        console.log("✅ generate_recurring_events function result:", functionResult);
      }
    }
    
  } catch (error) {
    console.error("❌ Debug function error:", error);
  }
};
