
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ValidationRequest {
  dateTime: string;
  timezone: string;
  type: 'deadline' | 'reminder';
  deadlineDateTime?: string; // for reminder validation
}

interface ValidationResponse {
  valid: boolean;
  message?: string;
  userLocalTime: string;
  currentTime: string;
}

const validateDateTime = (req: ValidationRequest): ValidationResponse => {
  try {
    const { dateTime, timezone, type, deadlineDateTime } = req;
    
    // Get current time in user's timezone
    const now = new Date();
    const currentTimeInUserTz = new Date(now.toLocaleString("en-US", { timeZone: timezone }));
    
    // Parse the selected datetime
    const selectedTime = new Date(dateTime);
    
    // Convert selected time to user's timezone for comparison
    const selectedTimeInUserTz = new Date(selectedTime.toLocaleString("en-US", { timeZone: timezone }));
    
    // Add 1 minute buffer to account for processing time
    const bufferTime = new Date(currentTimeInUserTz.getTime() + 60000);
    
    // Check if the selected time is in the future
    if (selectedTimeInUserTz <= bufferTime) {
      return {
        valid: false,
        message: `${type === 'deadline' ? 'Deadline' : 'Reminder'} must be set for a future time. Selected time must be at least 1 minute from now.`,
        userLocalTime: selectedTimeInUserTz.toLocaleString(),
        currentTime: currentTimeInUserTz.toLocaleString()
      };
    }
    
    // Additional validation for reminders - must be before deadline
    if (type === 'reminder' && deadlineDateTime) {
      const deadlineTime = new Date(deadlineDateTime);
      if (selectedTime >= deadlineTime) {
        return {
          valid: false,
          message: 'Reminder must be set before the deadline.',
          userLocalTime: selectedTimeInUserTz.toLocaleString(),
          currentTime: currentTimeInUserTz.toLocaleString()
        };
      }
    }
    
    return {
      valid: true,
      userLocalTime: selectedTimeInUserTz.toLocaleString(),
      currentTime: currentTimeInUserTz.toLocaleString()
    };
    
  } catch (error) {
    console.error('DateTime validation error:', error);
    return {
      valid: false,
      message: 'Invalid date/time format. Please select a valid date and time.',
      userLocalTime: '',
      currentTime: new Date().toLocaleString()
    };
  }
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ error: 'Method not allowed' }),
        { 
          status: 405, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    const validationRequest: ValidationRequest = await req.json();
    
    console.log('Validating datetime:', {
      dateTime: validationRequest.dateTime,
      timezone: validationRequest.timezone,
      type: validationRequest.type
    });

    const result = validateDateTime(validationRequest);
    
    console.log('Validation result:', result);

    return new Response(
      JSON.stringify(result),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('Edge function error:', error);
    return new Response(
      JSON.stringify({ 
        valid: false, 
        message: 'Server error during validation',
        error: error.message 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
