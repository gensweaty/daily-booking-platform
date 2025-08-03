
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { Resend } from "https://esm.sh/resend@4.3.0";

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

// Initialize Resend and Supabase
const resend = new Resend(Deno.env.get('RESEND_API_KEY'));
const supabase = createClient<Database>(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

// Multi-language translations
const translations = {
  en: {
    subject: "Event Reminder - {eventTitle}",
    greeting: "Hello {name}!",
    reminderText: "This is a reminder about your upcoming event:",
    eventDetails: "Event Details",
    eventTitle: "Event",
    startDate: "Start Date",
    endDate: "End Date",
    notes: "Notes",
    paymentStatus: "Payment Status",
    paymentAmount: "Amount",
    footer: "Best regards,<br>SmartBookly Team",
    paymentStatuses: {
      paid: "Paid",
      not_paid: "Not Paid",
      partial: "Partially Paid"
    }
  },
  ka: {
    subject: "ღონისძიების შეხსენება - {eventTitle}",
    greeting: "გამარჯობა {name}!",
    reminderText: "ეს არის შეხსენება თქვენი მომავალი ღონისძიების შესახებ:",
    eventDetails: "ღონისძიების დეტალები",
    eventTitle: "ღონისძიება",
    startDate: "დაწყების თარიღი",
    endDate: "დასრულების თარიღი",
    notes: "შენიშვნები",
    paymentStatus: "გადახდის სტატუსი",
    paymentAmount: "თანხა",
    footer: "პატივისცემით,<br>SmartBookly გუნდი",
    paymentStatuses: {
      paid: "გადახდილია",
      not_paid: "არ არის გადახდილი",
      partial: "ნაწილობრივ გადახდილია"
    }
  },
  es: {
    subject: "Recordatorio de Evento - {eventTitle}",
    greeting: "¡Hola {name}!",
    reminderText: "Este es un recordatorio sobre tu próximo evento:",
    eventDetails: "Detalles del Evento",
    eventTitle: "Evento",
    startDate: "Fecha de Inicio",
    endDate: "Fecha de Fin",
    notes: "Notas",
    paymentStatus: "Estado de Pago",
    paymentAmount: "Cantidad",
    footer: "Saludos cordiales,<br>Equipo SmartBookly",
    paymentStatuses: {
      paid: "Pagado",
      not_paid: "No Pagado",
      partial: "Parcialmente Pagado"
    }
  }
};

function getCurrencySymbol(language: string): string {
  switch (language) {
    case 'ka': return '₾';
    case 'es': return '€';
    default: return '$';
  }
}

function formatDate(dateStr: string, language: string): string {
  const date = new Date(dateStr);
  const options: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short'
  };

  const locale = language === 'ka' ? 'ka-GE' : language === 'es' ? 'es-ES' : 'en-US';
  return date.toLocaleDateString(locale, options);
}

function generateEmailHTML(event: any, recipientName: string, language: string): string {
  const t = translations[language as keyof typeof translations] || translations.en;
  const currencySymbol = getCurrencySymbol(language);
  
  const subject = t.subject.replace('{eventTitle}', event.title);
  const greeting = t.greeting.replace('{name}', recipientName);
  
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${subject}</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 8px 8px 0 0; text-align: center; }
          .content { background: #ffffff; border: 1px solid #e1e5e9; border-top: none; padding: 30px; }
          .event-card { background: #f8f9fa; border-left: 4px solid #667eea; padding: 20px; margin: 20px 0; border-radius: 0 8px 8px 0; }
          .detail-row { display: flex; justify-content: space-between; margin: 10px 0; padding: 8px 0; border-bottom: 1px solid #e9ecef; }
          .label { font-weight: bold; color: #495057; }
          .value { color: #6c757d; }
          .footer { background: #f8f9fa; padding: 20px; text-align: center; border-radius: 0 0 8px 8px; color: #6c757d; font-size: 14px; }
          .payment-status { padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: bold; text-transform: uppercase; }
          .payment-paid { background: #d4edda; color: #155724; }
          .payment-not-paid { background: #f8d7da; color: #721c24; }
          .payment-partial { background: #fff3cd; color: #856404; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>📅 ${t.subject.replace('{eventTitle}', '')}</h1>
          <h2>${event.title}</h2>
        </div>
        
        <div class="content">
          <p><strong>${greeting}</strong></p>
          <p>${t.reminderText}</p>
          
          <div class="event-card">
            <h3>${t.eventDetails}</h3>
            
            <div class="detail-row">
              <span class="label">${t.eventTitle}:</span>
              <span class="value">${event.title}</span>
            </div>
            
            <div class="detail-row">
              <span class="label">${t.startDate}:</span>
              <span class="value">${formatDate(event.start_date, language)}</span>
            </div>
            
            <div class="detail-row">
              <span class="label">${t.endDate}:</span>
              <span class="value">${formatDate(event.end_date, language)}</span>
            </div>
            
            ${event.event_notes ? `
            <div class="detail-row">
              <span class="label">${t.notes}:</span>
              <span class="value">${event.event_notes}</span>
            </div>
            ` : ''}
            
            ${event.payment_status ? `
            <div class="detail-row">
              <span class="label">${t.paymentStatus}:</span>
              <span class="value">
                <span class="payment-status payment-${event.payment_status.replace('_', '-')}">
                  ${t.paymentStatuses[event.payment_status as keyof typeof t.paymentStatuses] || event.payment_status}
                </span>
              </span>
            </div>
            ` : ''}
            
            ${event.payment_amount ? `
            <div class="detail-row">
              <span class="label">${t.paymentAmount}:</span>
              <span class="value">${currencySymbol}${event.payment_amount}</span>
            </div>
            ` : ''}
          </div>
        </div>
        
        <div class="footer">
          <p>${t.footer}</p>
          <p><small>SmartBookly - Smart Booking Management System</small></p>
        </div>
      </body>
    </html>
  `;
}

async function sendEventReminderEmail(event: any, recipientEmail: string, recipientName: string): Promise<boolean> {
  try {
    const language = event.language || 'en';
    const t = translations[language as keyof typeof translations] || translations.en;
    
    const subject = t.subject.replace('{eventTitle}', event.title);
    const emailHtml = generateEmailHTML(event, recipientName, language);

    console.log(`📧 Sending reminder email to: ${recipientEmail} for event: ${event.title}`);

    const { data, error } = await resend.emails.send({
      from: "SmartBookly <onboarding@resend.dev>",
      to: [recipientEmail],
      subject: subject,
      html: emailHtml,
    });

    if (error) {
      console.error(`❌ Failed to send email to ${recipientEmail}:`, error);
      return false;
    }

    console.log(`✅ Email sent successfully to ${recipientEmail}, ID: ${data?.id}`);
    return true;
  } catch (error) {
    console.error(`💥 Exception sending email to ${recipientEmail}:`, error);
    return false;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🔔 Event reminder function triggered');

    const now = new Date().toISOString();
    console.log('⏰ Current UTC time:', now);

    // Query for events due for reminders
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
          console.log(`👥 Found ${persons.length} additional person(s) for event ${event.id}`);
          for (const person of persons) {
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
          console.log(`⚠️ No valid email recipients for event ${event.id}, marking as sent to avoid retry...`);
          // Mark as sent to avoid retrying events with no valid emails
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
        let allEmailsSent = true;
        for (const recipient of recipients) {
          const emailSent = await sendEventReminderEmail(event, recipient.email, recipient.name);
          if (emailSent) {
            emailsSent++;
          } else {
            allEmailsSent = false;
            errors++;
          }
        }

        // Mark the event as having its reminder sent only if all emails succeeded
        if (allEmailsSent) {
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
          console.log(`↩️ Some emails failed for event ${event.id}. It will be retried on the next run.`);
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
