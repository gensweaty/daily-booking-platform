
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    
    const supabase = createClient(supabaseUrl, supabaseKey)
    
    console.log('Starting event reminder email processing...')

    // Get events that need reminder emails sent
    const { data: events, error: eventsError } = await supabase
      .from('events')
      .select(`
        id,
        title,
        user_surname,
        social_network_link,
        event_notes,
        start_date,
        end_date,
        reminder_at,
        language,
        user_id
      `)
      .eq('email_reminder_enabled', true)
      .lte('reminder_at', new Date().toISOString())
      .is('reminder_sent_at', null)
      .is('deleted_at', null)
      .limit(50) // Process in batches

    if (eventsError) {
      console.error('Error fetching events:', eventsError)
      throw eventsError
    }

    if (!events || events.length === 0) {
      console.log('No events found that need reminder emails')
      return new Response(
        JSON.stringify({ message: 'No events found that need reminder emails', count: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`Found ${events.length} events that need reminder emails`)
    
    let successCount = 0
    let errorCount = 0

    // Process each event
    for (const event of events) {
      try {
        console.log(`Processing reminder for event: ${event.id} - ${event.title}`)

        // Get all participants for this event (main contact + additional persons)
        const participants = []
        
        // Add main event contact if email exists
        if (event.social_network_link && event.social_network_link.includes('@')) {
          participants.push({
            email: event.social_network_link,
            name: event.user_surname || event.title
          })
        }

        // Get additional persons from customers table
        const { data: customers, error: customersError } = await supabase
          .from('customers')
          .select('user_surname, social_network_link')
          .eq('event_id', event.id)
          .is('deleted_at', null)

        if (!customersError && customers) {
          for (const customer of customers) {
            if (customer.social_network_link && customer.social_network_link.includes('@')) {
              participants.push({
                email: customer.social_network_link,
                name: customer.user_surname || 'Guest'
              })
            }
          }
        }

        if (participants.length === 0) {
          console.log(`No email participants found for event ${event.id}`)
          // Still mark as sent to avoid reprocessing
          await supabase
            .from('events')
            .update({ reminder_sent_at: new Date().toISOString() })
            .eq('id', event.id)
          continue
        }

        // Format event datetime
        const eventDateTime = new Date(event.start_date).toLocaleString('en-US', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          timeZoneName: 'short'
        })

        // Send email to each participant
        for (const participant of participants) {
          try {
            const { error: emailError } = await supabase.functions.invoke('send-task-reminder-email', {
              body: {
                to: participant.email,
                subject: `Event Reminder: ${event.title}`,
                html: `
                  <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: #333; margin-bottom: 20px;">Event Reminder</h2>
                    <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
                      <h3 style="color: #495057; margin: 0 0 15px 0;">${event.title}</h3>
                      <p style="margin: 5px 0;"><strong>Date & Time:</strong> ${eventDateTime}</p>
                      ${event.event_notes ? `<p style="margin: 10px 0 0 0;"><strong>Notes:</strong><br>${event.event_notes}</p>` : ''}
                    </div>
                    <p style="color: #666; font-size: 14px;">
                      This is an automated reminder for your upcoming event. Please make sure to attend on time.
                    </p>
                    <hr style="border: none; border-top: 1px solid #e9ecef; margin: 20px 0;">
                    <p style="color: #999; font-size: 12px; text-align: center;">
                      This email was sent automatically. Please do not reply to this email.
                    </p>
                  </div>
                `,
                text: `
Event Reminder: ${event.title}

Date & Time: ${eventDateTime}
${event.event_notes ? `Notes: ${event.event_notes}` : ''}

This is an automated reminder for your upcoming event. Please make sure to attend on time.
                `.trim()
              }
            })

            if (emailError) {
              console.error(`Error sending email to ${participant.email} for event ${event.id}:`, emailError)
            } else {
              console.log(`Successfully sent reminder email to ${participant.email} for event ${event.id}`)
            }
          } catch (emailErr) {
            console.error(`Failed to send email to ${participant.email} for event ${event.id}:`, emailErr)
          }
        }

        // Mark reminder as sent
        const { error: updateError } = await supabase
          .from('events')
          .update({ reminder_sent_at: new Date().toISOString() })
          .eq('id', event.id)

        if (updateError) {
          console.error(`Error updating reminder_sent_at for event ${event.id}:`, updateError)
          errorCount++
        } else {
          console.log(`Successfully processed reminder for event ${event.id}`)
          successCount++
        }

      } catch (eventError) {
        console.error(`Error processing event ${event.id}:`, eventError)
        errorCount++
      }
    }

    console.log(`Event reminder processing completed. Success: ${successCount}, Errors: ${errorCount}`)

    return new Response(
      JSON.stringify({ 
        message: 'Event reminder emails processed',
        total: events.length,
        success: successCount,
        errors: errorCount
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Fatal error in send-event-reminder-email:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
