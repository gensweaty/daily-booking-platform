
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

const formatEventTimeForLocale = (dateTimeString: string, language: string = 'en') => {
  try {
    const date = new Date(dateTimeString);
    
    // Ensure date is valid
    if (isNaN(date.getTime())) {
      console.error('Invalid date string:', dateTimeString);
      return dateTimeString;
    }

    console.log('🌍 Formatting time for locale:', {
      input: dateTimeString,
      language,
      utcTime: date.toISOString(),
      timezone: 'Asia/Tbilisi'
    });

    // Always use Asia/Tbilisi timezone regardless of language for Georgian users
    const locale = language === 'ka' ? 'ka-GE' : language === 'es' ? 'es-ES' : 'en-US';
    
    const formatter = new Intl.DateTimeFormat(locale, {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: 'Asia/Tbilisi', // ✅ FIX: Always use Georgia timezone
    });

    const formatted = formatter.format(date);
    console.log('🕐 Formatted time:', {
      original: dateTimeString,
      formatted,
      timezone: 'Asia/Tbilisi'
    });

    return formatted;
  } catch (error) {
    console.error('Error formatting time:', error);
    return dateTimeString;
  }
};

const getTranslations = (language: string = 'en') => {
  const translations = {
    en: {
      subject: "Event Reminder",
      greeting: "Hello",
      reminderText: "This is a reminder about your upcoming event:",
      eventDetails: "Event Details",
      eventTime: "Time",
      notes: "Notes",
      contactInfo: "Contact Information",
      phone: "Phone",
      email: "Email",
      footer: "Thank you for using SmartBookly!",
    },
    ka: {
      subject: "მოვლენის შეხსენება",
      greeting: "გამარჯობა",
      reminderText: "ეს არის შეხსენება თქვენი მოვლენის შესახებ:",
      eventDetails: "მოვლენის დეტალები",
      eventTime: "დრო",
      notes: "ჩანაწერები",
      contactInfo: "საკონტაქტო ინფორმაცია",
      phone: "ტელეფონი",
      email: "ელ. ფოსტა",
      footer: "გმადლობთ SmartBookly-ს გამოყენებისთვის!",
    },
    es: {
      subject: "Recordatorio de Evento",
      greeting: "Hola",
      reminderText: "Este es un recordatorio sobre tu próximo evento:",
      eventDetails: "Detalles del Evento",
      eventTime: "Hora",
      notes: "Notas",
      contactInfo: "Información de Contacto",
      phone: "Teléfono",
      email: "Correo",
      footer: "¡Gracias por usar SmartBookly!",
    }
  };

  return translations[language as keyof typeof translations] || translations.en;
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🔔 Event reminder function triggered');

    // Get current time in UTC
    const now = new Date().toISOString();
    console.log('⏰ Current UTC time:', now);

    // ✅ FIX: Query for due reminder events with precise filtering
    console.log('🔍 Querying for due reminder events...');
    const { data: dueEvents, error: queryError } = await supabase
      .from('events')
      .select('*')
      .lte('reminder_at', now) // ✅ Events where reminder time has passed
      .eq('email_reminder_enabled', true) // ✅ Only events with email reminders enabled
      .is('reminder_sent_at', null) // ✅ Only events where reminder hasn't been sent
      .is('deleted_at', null) // ✅ Only non-deleted events
      .not('social_network_link', 'is', null) // ✅ Only events with email addresses
      .ilike('social_network_link', '%@%'); // ✅ Only valid email addresses

    if (queryError) {
      console.error('❌ Error querying due events:', queryError);
      throw queryError;
    }

    console.log(`📧 Found ${dueEvents?.length || 0} events due for reminder emails`);

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

    // Process each due event
    let emailsSent = 0;
    let errors = 0;

    for (const event of dueEvents) {
      try {
        console.log(`📮 Processing reminder for event: ${event.id} - ${event.title}`);
        console.log(`⏰ Event reminder was due at: ${event.reminder_at}`);
        
        const t = getTranslations(event.language || 'en');
        
        // Format event times for Georgia timezone
        const startTimeFormatted = formatEventTimeForLocale(event.start_date, event.language || 'en');
        const endTimeFormatted = formatEventTimeForLocale(event.end_date, event.language || 'en');

        // Create email content
        const emailHtml = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #2563eb;">${t.subject}</h2>
            <p>${t.greeting} ${event.user_surname},</p>
            <p>${t.reminderText}</p>
            
            <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h3 style="margin-top: 0; color: #374151;">${t.eventDetails}</h3>
              <p><strong>${event.title}</strong></p>
              <p><strong>${t.eventTime}:</strong> ${startTimeFormatted} - ${endTimeFormatted}</p>
              ${event.event_notes ? `<p><strong>${t.notes}:</strong> ${event.event_notes}</p>` : ''}
            </div>

            ${event.user_number || event.social_network_link ? `
              <div style="background-color: #e5f3ff; padding: 15px; border-radius: 8px; margin: 20px 0;">
                <h4 style="margin-top: 0; color: #1e40af;">${t.contactInfo}</h4>
                ${event.user_number ? `<p><strong>${t.phone}:</strong> ${event.user_number}</p>` : ''}
                ${event.social_network_link ? `<p><strong>${t.email}:</strong> ${event.social_network_link}</p>` : ''}
              </div>
            ` : ''}

            <p style="color: #6b7280; font-size: 14px;">${t.footer}</p>
          </div>
        `;

        // Send email via Resend
        const { error: emailError } = await supabase.functions.invoke('send-booking-approval-email', {
          body: {
            recipientEmail: event.social_network_link,
            fullName: event.user_surname,
            eventTitle: event.title,
            startDate: event.start_date,
            endDate: event.end_date,
            eventNotes: event.event_notes,
            paymentStatus: event.payment_status,
            paymentAmount: event.payment_amount,
            language: event.language,
            source: 'event-reminder' // Special flag to indicate this is a reminder email
          }
        });

        if (emailError) {
          console.error(`❌ Failed to send reminder email for event ${event.id}:`, emailError);
          errors++;
          continue;
        }

        // ✅ FIX: Mark reminder as sent
        const { error: updateError } = await supabase
          .from('events')
          .update({ 
            reminder_sent_at: now 
          })
          .eq('id', event.id);

        if (updateError) {
          console.error(`❌ Failed to update reminder_sent_at for event ${event.id}:`, updateError);
          errors++;
        } else {
          console.log(`✅ Reminder email sent successfully for event: ${event.id}`);
          emailsSent++;
        }

      } catch (eventError) {
        console.error(`❌ Error processing event ${event.id}:`, eventError);
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
        timestamp: now
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
