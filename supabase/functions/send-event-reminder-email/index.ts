
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { Resend } from "npm:resend@2.0.0"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface EventData {
  id: string;
  title: string;
  user_surname: string;
  user_number?: string;
  social_network_link?: string;
  event_notes?: string;
  start_date: string;
  end_date: string;
  reminder_at: string;
  language: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const resend = new Resend(Deno.env.get('RESEND_API_KEY'));

    // Get current time
    const now = new Date();
    console.log('Checking for event reminders at:', now.toISOString());

    // Find events that need reminder emails
    const { data: events, error: fetchError } = await supabaseClient
      .from('events')
      .select('*')
      .eq('email_reminder_enabled', true)
      .is('reminder_sent_at', null)
      .lte('reminder_at', now.toISOString())
      .is('deleted_at', null);

    if (fetchError) {
      console.error('Error fetching events:', fetchError);
      throw fetchError;
    }

    console.log(`Found ${events?.length || 0} events needing reminders`);

    if (!events || events.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No events need reminders' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let sentCount = 0;

    for (const event of events) {
      try {
        console.log(`Processing reminder for event: ${event.id}`);

        // Get all persons for this event (main person + additional persons)
        const persons = [];
        
        // Add main person
        if (event.social_network_link) {
          persons.push({
            name: event.user_surname || event.title,
            email: event.social_network_link,
            phone: event.user_number
          });
        }

        // Get additional persons from customers table
        const { data: customers, error: customersError } = await supabaseClient
          .from('customers')
          .select('user_surname, social_network_link, user_number')
          .eq('event_id', event.id)
          .not('social_network_link', 'is', null);

        if (!customersError && customers) {
          for (const customer of customers) {
            persons.push({
              name: customer.user_surname,
              email: customer.social_network_link,
              phone: customer.user_number
            });
          }
        }

        console.log(`Found ${persons.length} persons to notify for event ${event.id}`);

        // Send reminder email to each person
        for (const person of persons) {
          if (!person.email) continue;

          try {
            const eventDateTime = new Date(event.start_date);
            const formattedDate = eventDateTime.toLocaleDateString(
              event.language === 'ka' ? 'ka-GE' : event.language === 'es' ? 'es-ES' : 'en-US'
            );
            const formattedTime = eventDateTime.toLocaleTimeString(
              event.language === 'ka' ? 'ka-GE' : event.language === 'es' ? 'es-ES' : 'en-US',
              { hour: '2-digit', minute: '2-digit' }
            );

            // Determine subject and content based on language
            let subject, greeting, eventReminder, eventDetails, dateLabel, timeLabel, notesLabel, thankYou;

            if (event.language === 'ka') {
              subject = `შეხსენება: ${event.title}`;
              greeting = `გამარჯობა ${person.name},`;
              eventReminder = 'ეს არის შეხსენება თქვენი დაგეგმილი მოვლენის შესახებ:';
              eventDetails = 'მოვლენის დეტალები:';
              dateLabel = 'თარიღი:';
              timeLabel = 'დრო:';
              notesLabel = 'შენიშვნები:';
              thankYou = 'მადლობთ!';
            } else if (event.language === 'es') {
              subject = `Recordatorio: ${event.title}`;
              greeting = `Hola ${person.name},`;
              eventReminder = 'Este es un recordatorio de su evento programado:';
              eventDetails = 'Detalles del evento:';
              dateLabel = 'Fecha:';
              timeLabel = 'Hora:';
              notesLabel = 'Notas:';
              thankYou = '¡Gracias!';
            } else {
              subject = `Reminder: ${event.title}`;
              greeting = `Hello ${person.name},`;
              eventReminder = 'This is a reminder about your scheduled event:';
              eventDetails = 'Event Details:';
              dateLabel = 'Date:';
              timeLabel = 'Time:';
              notesLabel = 'Notes:';
              thankYou = 'Thank you!';
            }

            const emailContent = `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #333;">${subject}</h2>
                <p>${greeting}</p>
                <p>${eventReminder}</p>
                
                <div style="background-color: #f5f5f5; padding: 20px; border-radius: 5px; margin: 20px 0;">
                  <h3 style="margin-top: 0; color: #555;">${eventDetails}</h3>
                  <p><strong>${event.title}</strong></p>
                  <p><strong>${dateLabel}</strong> ${formattedDate}</p>
                  <p><strong>${timeLabel}</strong> ${formattedTime}</p>
                  ${event.event_notes ? `<p><strong>${notesLabel}</strong> ${event.event_notes}</p>` : ''}
                </div>
                
                <p>${thankYou}</p>
              </div>
            `;

            const { error: emailError } = await resend.emails.send({
              from: 'Event Reminder <onboarding@resend.dev>',
              to: [person.email],
              subject: subject,
              html: emailContent
            });

            if (emailError) {
              console.error(`Failed to send email to ${person.email}:`, emailError);
            } else {
              console.log(`Email sent successfully to ${person.email}`);
            }
          } catch (emailError) {
            console.error(`Error sending email to ${person.email}:`, emailError);
          }
        }

        // Mark reminder as sent
        const { error: updateError } = await supabaseClient
          .from('events')
          .update({ reminder_sent_at: now.toISOString() })
          .eq('id', event.id);

        if (updateError) {
          console.error(`Failed to update reminder_sent_at for event ${event.id}:`, updateError);
        } else {
          sentCount++;
          console.log(`Marked reminder as sent for event ${event.id}`);
        }

      } catch (eventError) {
        console.error(`Error processing event ${event.id}:`, eventError);
      }
    }

    return new Response(
      JSON.stringify({
        message: `Processed ${sentCount} event reminders successfully`,
        processedCount: sentCount
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in send-event-reminder-email function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
