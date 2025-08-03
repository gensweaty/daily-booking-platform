
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

interface Database {
  public: {
    Tables: {
      events: {
        Row: {
          id: string;
          title: string;
          user_surname: string;
          user_number: string | null;
          social_network_link: string | null;
          event_notes: string | null;
          start_date: string;
          end_date: string;
          payment_status: string | null;
          payment_amount: number | null;
          user_id: string;
          language: string | null;
          reminder_at: string | null;
          email_reminder_enabled: boolean | null;
          reminder_sent_at: string | null;
          deleted_at: string | null;
        };
      };
      customers: {
        Row: {
          id: string;
          event_id: string | null;
          user_surname: string;
          social_network_link: string | null;
          payment_status: string | null;
          payment_amount: number | null;
        };
      };
    };
  };
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabase = createClient<Database>(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🔔 Event reminder function triggered');

    const now = new Date().toISOString();
    console.log('⏰ Current UTC time:', now);

    console.log('🔍 Querying for due reminder events...');
    const { data: dueEvents, error: queryError } = await supabase
      .from('events')
      .select('*')
      .not('reminder_at', 'is', null)
      .eq('email_reminder_enabled', true)
      .is('reminder_sent_at', null)
      .is('deleted_at', null)
      .lte('reminder_at', now);

    if (queryError) {
      console.error('❌ Error querying due events:', queryError);
      throw queryError;
    }

    console.log(`📧 Found ${dueEvents?.length || 0} events due for reminder emails`);
    
    if (dueEvents && dueEvents.length > 0) {
      console.log('🔍 Events found:', dueEvents.map(e => ({
        id: e.id,
        title: e.title,
        reminder_at: e.reminder_at,
        email: e.social_network_link,
        email_reminder_enabled: e.email_reminder_enabled
      })));
    }

    if (!dueEvents || dueEvents.length === 0) {
      console.log('✅ No reminder emails to send at this time');
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'No reminder emails to send',
          timestamp: now
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }

    let emailsSent = 0;
    let errors = 0;

    for (const event of dueEvents) {
      try {
        console.log(`📮 Processing reminder for event: ${event.id} - ${event.title}`);
        console.log(`⏰ Event reminder was due at: ${event.reminder_at}`);

        // Build the list of recipients (primary + additional persons)
        const recipients: { email: string, name: string }[] = [];

        // Primary person (event's main contact)
        if (event.social_network_link && event.social_network_link.includes('@')) {
          recipients.push({ 
            email: event.social_network_link, 
            name: event.user_surname || 'Guest' 
          });
        }

        // Fetch additional persons associated with this event from customers table
        const { data: persons, error: personsError } = await supabase
          .from('customers')
          .select('*')
          .eq('event_id', event.id);

        if (personsError) {
          console.error(`❌ Error fetching additional persons for event ${event.id}:`, personsError);
          errors++;
          continue;
        }

        if (persons && persons.length > 0) {
          console.log(`👥 Found ${persons.length} additional person(s) for event ${event.id}. Adding them as recipients.`);
          for (const person of persons) {
            // Only add if there's a valid email
            if (person.social_network_link && person.social_network_link.includes('@')) {
              console.log(`📧 Adding customer email to recipients: ${person.social_network_link} (${person.user_surname})`);
              recipients.push({ 
                email: person.social_network_link, 
                name: person.user_surname || 'Guest' 
              });
            }
          }
        }

        if (recipients.length === 0) {
          console.log(`⚠️ No valid email recipients for event ${event.id}, skipping...`);
          // Still mark as sent to avoid retrying events with no valid emails
          const { error: updateError } = await supabase
            .from('events')
            .update({ reminder_sent_at: now })
            .eq('id', event.id);
          if (updateError) {
            console.error(`❌ Error updating reminder_sent_at for event ${event.id}:`, updateError);
            errors++;
          }
          continue;
        }

        console.log(`📬 Sending reminders to ${recipients.length} recipient(s) for event ${event.id}`);

        // Send email to each recipient
        let anyFailed = false;
        for (const recipient of recipients) {
          console.log(`📧 Sending reminder email to: ${recipient.email} (${recipient.name})`);
          
          const { error: emailError } = await supabase.functions.invoke('send-booking-approval-email', {
            body: {
              recipientEmail: recipient.email,
              fullName: recipient.name,
              eventTitle: event.title,
              startDate: event.start_date,
              endDate: event.end_date,
              eventNotes: event.event_notes,
              paymentStatus: event.payment_status,
              paymentAmount: event.payment_amount,
              language: event.language || 'en',
              source: 'event-reminder'
            }
          });

          if (emailError) {
            console.error(`❌ Failed to send reminder to ${recipient.email} for event ${event.id}:`, emailError);
            errors++;
            anyFailed = true;
          } else {
            console.log(`✅ Reminder email sent to ${recipient.email} for event ${event.id}`);
            emailsSent++;
          }
        }

        // Mark the event as having its reminder sent only if all emails succeeded
        if (!anyFailed) {
          const { error: updateError } = await supabase
            .from('events')
            .update({ reminder_sent_at: now })
            .eq('id', event.id);

          if (updateError) {
            console.error(`❌ Error updating reminder_sent_at for event ${event.id}:`, updateError);
            errors++;
          } else {
            console.log(`🎉 Marked event ${event.id} as reminder sent (all ${recipients.length} recipients notified)`);
          }
        } else {
          console.log(`↩️ One or more emails failed for event ${event.id}. It will be retried on the next run.`);
          // Do not set reminder_sent_at so the function will retry next time
        }

      } catch (eventError) {
        console.error(`💥 Unexpected error processing event ${event.id}:`, eventError);
        errors++;
      }
    }

    console.log(`📊 Email processing complete. Sent: ${emailsSent}, Errors: ${errors}`);

    return new Response(
      JSON.stringify({
        success: true,
        emailsSent,
        errors,
        totalProcessed: dueEvents.length,
        timestamp: now,
        processedEvents: dueEvents.map(e => ({
          id: e.id,
          title: e.title,
          reminder_at: e.reminder_at,
          email: e.social_network_link
        }))
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('💥 Fatal error in send-event-reminder-email function:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        success: false,
        timestamp: new Date().toISOString()
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
