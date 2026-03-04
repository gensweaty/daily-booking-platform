import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.47.2";
import { Resend } from "https://esm.sh/resend@4.3.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Track recently sent emails to prevent duplicates
const recentlySentEmails = new Map<string, number>();
const DUPLICATE_WINDOW_MS = 10 * 60 * 1000; // 10 minutes

// Clean up old entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, timestamp] of recentlySentEmails.entries()) {
    if (now - timestamp > DUPLICATE_WINDOW_MS) {
      recentlySentEmails.delete(key);
    }
  }
}, 5 * 60 * 1000); // Clean up every 5 minutes

interface CustomReminderEmailRequest {
  reminderId: string;
  userEmail: string;
  title: string;
  message?: string;
  reminderTime: string;
  userId: string;
  recipientUserId?: string;
  createdByType?: string;
  createdBySubUserId?: string;
  recipientEmail?: string;
  recipientName?: string;
  eventId?: string;
  customerId?: string;
}

// Format event date and time
const formatEventTimeForLocale = (dateISO: string, lang: string): string => {
  const date = new Date(dateISO);
  const locale = lang === 'ka' ? 'ka-GE' : lang === 'es' ? 'es-ES' : lang === 'ru' ? 'ru-RU' : 'en-US';

  const formatter = new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: 'long',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'Asia/Tbilisi',
  });

  return formatter.format(date);
};

// Multi-language email content - matching event reminder format
const getEmailContent = (
  language: string, 
  title: string, 
  recipientName: string,
  message: string | undefined, 
  reminderTime: string,
  isEventReminder: boolean,
  eventDetails?: {
    startDate: string;
    endDate: string;
    paymentStatus?: string;
    businessAddress?: string;
  }
) => {
  let subject, body;
  
  const formattedStartDate = eventDetails?.startDate ? formatEventTimeForLocale(eventDetails.startDate, language) : null;
  const formattedEndDate = eventDetails?.endDate ? formatEventTimeForLocale(eventDetails.endDate, language) : null;
  
  // Create address section if business address is available
  const addressSection = eventDetails?.businessAddress ? 
    (language === 'ka' ? 
      `<p style="margin: 8px 0; font-size: 14px; color: #666;"><strong>მისამართი:</strong> ${eventDetails.businessAddress}</p>` :
      language === 'es' ?
      `<p style="margin: 8px 0; font-size: 14px; color: #666;"><strong>Dirección:</strong> ${eventDetails.businessAddress}</p>` :
      language === 'ru' ?
      `<p style="margin: 8px 0; font-size: 14px; color: #666;"><strong>Адрес:</strong> ${eventDetails.businessAddress}</p>` :
      `<p style="margin: 8px 0; font-size: 14px; color: #666;"><strong>Address:</strong> ${eventDetails.businessAddress}</p>`
    ) : '';
  
  if (language === 'ka') {
    subject = isEventReminder ? "📅 მოვლენის შეხსენება - " + title : "🔔 შეხსენება - " + title;
    const emoji = isEventReminder ? "📅" : "🔔";
    const headerTitle = isEventReminder ? "მოვლენის შეხსენება -" : "შეხსენება -";
    body = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border-radius: 12px; overflow: hidden;">
        <div style="background: linear-gradient(45deg, #667eea, #764ba2); padding: 30px; text-align: center;">
          <div style="font-size: 40px; margin-bottom: 10px;">${emoji}</div>
          <h1 style="margin: 0; font-size: 28px; font-weight: bold;">${headerTitle}</h1>
          <h2 style="margin: 10px 0 0 0; font-size: 24px; opacity: 0.9;">${title}</h2>
        </div>
        
        <div style="background: white; color: #333; padding: 30px; margin: 0;">
          <p style="font-size: 18px; line-height: 1.6; margin-bottom: 20px;">
            გამარჯობა ${recipientName}!
          </p>
          <p style="font-size: 16px; line-height: 1.6; margin-bottom: 25px;">
            ეს არის შეხსენება თქვენი მოახლოებული მოვლენის შესახებ:
          </p>
          ${message ? `<p style="font-size: 16px; line-height: 1.6; margin-bottom: 20px; font-style: italic; color: #555;">${message}</p>` : ''}
          
          <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; border-left: 4px solid #667eea; margin: 25px 0;">
            <h3 style="margin: 0 0 15px 0; color: #333; font-size: 18px;">📋 მოვლენის დეტალები</h3>
            
            <p style="margin: 8px 0; font-size: 14px; color: #666;"><strong>მოვლენა:</strong> ${title}</p>
            ${formattedStartDate ? `<p style="margin: 8px 0; font-size: 14px; color: #666;"><strong>დაწყების თარიღი:</strong> ${formattedStartDate}</p>` : ''}
            ${formattedEndDate ? `<p style="margin: 8px 0; font-size: 14px; color: #666;"><strong>დასრულების თარიღი:</strong> ${formattedEndDate}</p>` : ''}
            ${addressSection}
            ${eventDetails?.paymentStatus ? `<p style="margin: 8px 0; font-size: 14px; color: #666;"><strong>გადახდის სტატუსი:</strong> <span style="background: ${eventDetails.paymentStatus === 'fully_paid' ? '#d4edda' : eventDetails.paymentStatus === 'partly_paid' ? '#fff3cd' : '#f8d7da'}; color: ${eventDetails.paymentStatus === 'fully_paid' ? '#155724' : eventDetails.paymentStatus === 'partly_paid' ? '#856404' : '#721c24'}; padding: 4px 8px; border-radius: 4px; font-weight: bold;">${eventDetails.paymentStatus === 'fully_paid' ? 'სრულად გადახდილი' : eventDetails.paymentStatus === 'partly_paid' ? 'ნაწილობრივ გადახდილი' : 'არ არის გადახდილი'}</span></p>` : ''}
          </div>
          
          <div style="text-align: center; margin: 30px 0;">
            <p style="margin: 0; font-size: 18px; color: #333;">🎉 არ დაგავიწყდეს!</p>
          </div>
          
          <hr style="border: none; border-top: 1px solid #eee; margin: 25px 0;">
          <p style="font-size: 12px; color: #999; text-align: center; margin: 0;">
            მიღებულია SmartBookly-დან - თქვენი ჭკვიანი დაჯავშნის სისტემა
          </p>
        </div>
      </div>
    `;
  } else if (language === 'es') {
    subject = isEventReminder ? "📅 Recordatorio de Evento - " + title : "🔔 Recordatorio - " + title;
    const emoji = isEventReminder ? "📅" : "🔔";
    const headerTitle = isEventReminder ? "Recordatorio de Evento -" : "Recordatorio -";
    body = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border-radius: 12px; overflow: hidden;">
        <div style="background: linear-gradient(45deg, #667eea, #764ba2); padding: 30px; text-align: center;">
          <div style="font-size: 40px; margin-bottom: 10px;">${emoji}</div>
          <h1 style="margin: 0; font-size: 28px; font-weight: bold;">${headerTitle}</h1>
          <h2 style="margin: 10px 0 0 0; font-size: 24px; opacity: 0.9;">${title}</h2>
        </div>
        
        <div style="background: white; color: #333; padding: 30px; margin: 0;">
          <p style="font-size: 18px; line-height: 1.6; margin-bottom: 20px;">
            ¡Hola ${recipientName}!
          </p>
          <p style="font-size: 16px; line-height: 1.6; margin-bottom: 25px;">
            Este es un recordatorio sobre tu próximo evento:
          </p>
          ${message ? `<p style="font-size: 16px; line-height: 1.6; margin-bottom: 20px; font-style: italic; color: #555;">${message}</p>` : ''}
          
          <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; border-left: 4px solid #667eea; margin: 25px 0;">
            <h3 style="margin: 0 0 15px 0; color: #333; font-size: 18px;">📋 Detalles del Evento</h3>
            
            <p style="margin: 8px 0; font-size: 14px; color: #666;"><strong>Evento:</strong> ${title}</p>
            ${formattedStartDate ? `<p style="margin: 8px 0; font-size: 14px; color: #666;"><strong>Fecha de Inicio:</strong> ${formattedStartDate}</p>` : ''}
            ${formattedEndDate ? `<p style="margin: 8px 0; font-size: 14px; color: #666;"><strong>Fecha de Fin:</strong> ${formattedEndDate}</p>` : ''}
            ${addressSection}
            ${eventDetails?.paymentStatus ? `<p style="margin: 8px 0; font-size: 14px; color: #666;"><strong>Estado de Pago:</strong> <span style="background: ${eventDetails.paymentStatus === 'fully_paid' ? '#d4edda' : eventDetails.paymentStatus === 'partly_paid' ? '#fff3cd' : '#f8d7da'}; color: ${eventDetails.paymentStatus === 'fully_paid' ? '#155724' : eventDetails.paymentStatus === 'partly_paid' ? '#856404' : '#721c24'}; padding: 4px 8px; border-radius: 4px; font-weight: bold;">${eventDetails.paymentStatus === 'fully_paid' ? 'PAGADO' : eventDetails.paymentStatus === 'partly_paid' ? 'PARCIALMENTE PAGADO' : 'NO PAGADO'}</span></p>` : ''}
          </div>
          
          <div style="text-align: center; margin: 30px 0;">
            <p style="margin: 0; font-size: 18px; color: #333;">🎉 ¡No lo olvides!</p>
          </div>
          
          <hr style="border: none; border-top: 1px solid #eee; margin: 25px 0;">
          <p style="font-size: 12px; color: #999; text-align: center; margin: 0;">
            SmartBookly - Sistema de Gestión de Reservas Inteligente
          </p>
        </div>
      </div>
    `;
  } else if (language === 'ru') {
    subject = isEventReminder ? "📅 Напоминание о Событии - " + title : "🔔 Напоминание - " + title;
    const emoji = isEventReminder ? "📅" : "🔔";
    const headerTitle = isEventReminder ? "Напоминание о Событии -" : "Напоминание -";
    body = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border-radius: 12px; overflow: hidden;">
        <div style="background: linear-gradient(45deg, #667eea, #764ba2); padding: 30px; text-align: center;">
          <div style="font-size: 40px; margin-bottom: 10px;">${emoji}</div>
          <h1 style="margin: 0; font-size: 28px; font-weight: bold;">${headerTitle}</h1>
          <h2 style="margin: 10px 0 0 0; font-size: 24px; opacity: 0.9;">${title}</h2>
        </div>
        
        <div style="background: white; color: #333; padding: 30px; margin: 0;">
          <p style="font-size: 18px; line-height: 1.6; margin-bottom: 20px;">
            Здравствуйте ${recipientName}!
          </p>
          <p style="font-size: 16px; line-height: 1.6; margin-bottom: 25px;">
            Это напоминание о вашем предстоящем событии:
          </p>
          ${message ? `<p style="font-size: 16px; line-height: 1.6; margin-bottom: 20px; font-style: italic; color: #555;">${message}</p>` : ''}
          
          <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; border-left: 4px solid #667eea; margin: 25px 0;">
            <h3 style="margin: 0 0 15px 0; color: #333; font-size: 18px;">📋 Детали События</h3>
            
            <p style="margin: 8px 0; font-size: 14px; color: #666;"><strong>Событие:</strong> ${title}</p>
            ${formattedStartDate ? `<p style="margin: 8px 0; font-size: 14px; color: #666;"><strong>Дата Начала:</strong> ${formattedStartDate}</p>` : ''}
            ${formattedEndDate ? `<p style="margin: 8px 0; font-size: 14px; color: #666;"><strong>Дата Окончания:</strong> ${formattedEndDate}</p>` : ''}
            ${addressSection}
            ${eventDetails?.paymentStatus ? `<p style="margin: 8px 0; font-size: 14px; color: #666;"><strong>Статус Оплаты:</strong> <span style="background: ${eventDetails.paymentStatus === 'fully_paid' ? '#d4edda' : eventDetails.paymentStatus === 'partly_paid' ? '#fff3cd' : '#f8d7da'}; color: ${eventDetails.paymentStatus === 'fully_paid' ? '#155724' : eventDetails.paymentStatus === 'partly_paid' ? '#856404' : '#721c24'}; padding: 4px 8px; border-radius: 4px; font-weight: bold;">${eventDetails.paymentStatus === 'fully_paid' ? 'ОПЛАЧЕНО' : eventDetails.paymentStatus === 'partly_paid' ? 'ЧАСТИЧНО ОПЛАЧЕНО' : 'НЕ ОПЛАЧЕНО'}</span></p>` : ''}
          </div>
          
          <div style="text-align: center; margin: 30px 0;">
            <p style="margin: 0; font-size: 18px; color: #333;">🎉 Не забудьте!</p>
          </div>
          
          <hr style="border: none; border-top: 1px solid #eee; margin: 25px 0;">
          <p style="font-size: 12px; color: #999; text-align: center; margin: 0;">
            SmartBookly - Умная Система Управления Бронированиями
          </p>
        </div>
      </div>
    `;
  } else {
    subject = isEventReminder ? "📅 Event Reminder - " + title : "🔔 Reminder - " + title;
    const emoji = isEventReminder ? "📅" : "🔔";
    const headerTitle = isEventReminder ? "Event Reminder -" : "Reminder -";
    body = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border-radius: 12px; overflow: hidden;">
        <div style="background: linear-gradient(45deg, #667eea, #764ba2); padding: 30px; text-align: center;">
          <div style="font-size: 40px; margin-bottom: 10px;">${emoji}</div>
          <h1 style="margin: 0; font-size: 28px; font-weight: bold;">${headerTitle}</h1>
          <h2 style="margin: 10px 0 0 0; font-size: 24px; opacity: 0.9;">${title}</h2>
        </div>
        
        <div style="background: white; color: #333; padding: 30px; margin: 0;">
          <p style="font-size: 18px; line-height: 1.6; margin-bottom: 20px;">
            Hello ${recipientName}!
          </p>
          <p style="font-size: 16px; line-height: 1.6; margin-bottom: 25px;">
            This is a reminder about your upcoming event:
          </p>
          ${message ? `<p style="font-size: 16px; line-height: 1.6; margin-bottom: 20px; font-style: italic; color: #555;">${message}</p>` : ''}
          
          <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; border-left: 4px solid #667eea; margin: 25px 0;">
            <h3 style="margin: 0 0 15px 0; color: #333; font-size: 18px;">📋 Event Details</h3>
            
            <p style="margin: 8px 0; font-size: 14px; color: #666;"><strong>Event:</strong> ${title}</p>
            ${formattedStartDate ? `<p style="margin: 8px 0; font-size: 14px; color: #666;"><strong>Start Date:</strong> ${formattedStartDate}</p>` : ''}
            ${formattedEndDate ? `<p style="margin: 8px 0; font-size: 14px; color: #666;"><strong>End Date:</strong> ${formattedEndDate}</p>` : ''}
            ${addressSection}
            ${eventDetails?.paymentStatus ? `<p style="margin: 8px 0; font-size: 14px; color: #666;"><strong>Payment Status:</strong> <span style="background: ${eventDetails.paymentStatus === 'fully_paid' ? '#d4edda' : eventDetails.paymentStatus === 'partly_paid' ? '#fff3cd' : '#f8d7da'}; color: ${eventDetails.paymentStatus === 'fully_paid' ? '#155724' : eventDetails.paymentStatus === 'partly_paid' ? '#856404' : '#721c24'}; padding: 4px 8px; border-radius: 4px; font-weight: bold;">${eventDetails.paymentStatus === 'fully_paid' ? 'PAID' : eventDetails.paymentStatus === 'partly_paid' ? 'PARTLY PAID' : 'NOT PAID'}</span></p>` : ''}
          </div>
          
          <div style="text-align: center; margin: 30px 0;">
            <p style="margin: 0; font-size: 18px; color: #333;">🎉 Don't forget!</p>
          </div>
          
          <hr style="border: none; border-top: 1px solid #eee; margin: 25px 0;">
          <p style="font-size: 12px; color: #999; text-align: center; margin: 0;">
            SmartBookly - Smart Booking Management System
          </p>
        </div>
      </div>
    `;
  }
  
  return { subject, body };
};

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    
    if (!supabaseUrl || !supabaseServiceKey || !resendApiKey) {
      console.error("❌ Missing required environment variables");
      return new Response(
        JSON.stringify({ success: false, error: "Email service not configured" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const resend = new Resend(resendApiKey);
    const { 
      reminderId, 
      userEmail, 
      title, 
      message, 
      reminderTime, 
      userId, 
      recipientUserId, 
      createdByType, 
      createdBySubUserId, 
      recipientEmail,
      recipientName,
      eventId,
      customerId
    }: CustomReminderEmailRequest = await req.json();

    // Use recipient email if provided, otherwise use admin email
    const emailToSend = recipientEmail || userEmail;

    // Validate required fields
    if (!reminderId || !emailToSend || !title || !userId) {
      console.error("❌ Missing required fields");
      return new Response(
        JSON.stringify({ success: false, error: "Missing required fields" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Check for duplicate email
    const emailKey = `${reminderId}-${emailToSend}`;
    const lastSent = recentlySentEmails.get(emailKey);
    if (lastSent && Date.now() - lastSent < DUPLICATE_WINDOW_MS) {
      console.log(`⚠️ Duplicate email prevented for ${emailKey} (sent ${Math.round((Date.now() - lastSent) / 1000)}s ago)`);
      return new Response(
        JSON.stringify({ success: true, duplicate: true, message: "Email already sent recently" }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Mark as sent IMMEDIATELY
    recentlySentEmails.set(emailKey, Date.now());

    // CRITICAL FIX: Use the language stored in the reminder itself (from AI chat)
    // This preserves the language the user was speaking when they created the reminder
    let languagePreference = 'en'; // Default to English
    
    try {
      // First priority: Check if reminder has language stored (from AI chat)
      const { data: reminderData } = await supabase
        .from('custom_reminders')
        .select('language')
        .eq('id', reminderId)
        .single();
      
      if (reminderData?.language) {
        languagePreference = reminderData.language;
        console.log(`📧 Using reminder's stored language: ${languagePreference}`);
      } else {
        // Fallback: Get language from user profile
        if (createdByType === 'sub_user' && createdBySubUserId) {
          // For sub-users, get language from sub_users table
          const { data: subUser } = await supabase
            .from('sub_users')
            .select('language')
            .eq('id', createdBySubUserId)
            .single();
          
          if (subUser?.language) {
            languagePreference = subUser.language;
            console.log(`📧 Using sub-user language preference: ${languagePreference}`);
          }
        } else {
          // For admin users, get language from profiles table
          const { data: profile } = await supabase
            .from('profiles')
            .select('language')
            .eq('id', recipientUserId || userId)
            .single();
          
          if (profile?.language) {
            languagePreference = profile.language;
            console.log(`📧 Using admin language preference: ${languagePreference}`);
          }
        }
      }
    } catch (error) {
      console.error(`⚠️ Error fetching language preference, using default 'en':`, error);
    }

    console.log(`📧 Sending custom reminder email in ${languagePreference} for reminder ${reminderId} to ${emailToSend}`);
    if (recipientEmail) {
      console.log(`📧 Sending to customer/event person email: ${recipientEmail}`);
    }

    // Try to fetch event details if eventId is provided
    let eventDetails;
    let recipientDisplayName = recipientName || title;
    
    if (eventId) {
      try {
        const { data: event } = await supabase
          .from('events')
          .select('start_date, end_date, payment_status, user_id, title, user_surname')
          .eq('id', eventId)
          .is('deleted_at', null)
          .single();
        
        if (event) {
          recipientDisplayName = recipientName || event.user_surname || event.title;
          
          // Get business address
          const { data: businessProfile } = await supabase
            .from('business_profiles')
            .select('contact_address')
            .eq('user_id', event.user_id)
            .single();
          
          eventDetails = {
            startDate: event.start_date,
            endDate: event.end_date,
            paymentStatus: event.payment_status,
            businessAddress: businessProfile?.contact_address
          };
        }
      } catch (error) {
        console.error('Error fetching event details:', error);
      }
    }
    
    // If no event but customer ID provided, try to fetch customer name
    if (!recipientDisplayName && customerId) {
      try {
        const { data: customer } = await supabase
          .from('customers')
          .select('user_surname, title')
          .eq('id', customerId)
          .single();
        
        if (customer) {
          recipientDisplayName = customer.user_surname || customer.title;
        }
      } catch (error) {
        console.error('Error fetching customer details:', error);
      }
    }

    // Get localized email content
    const { subject, body: rawEmailBody } = getEmailContent(
      languagePreference, 
      title, 
      recipientDisplayName,
      message, 
      reminderTime,
      !!eventId, // isEventReminder: true if eventId exists, false for custom reminders
      eventDetails
    );

    // Add CTA button
    const ctaLabel = languagePreference === 'ka' ? '🔔 დაფის გახსნა' : languagePreference === 'es' ? '🔔 Abrir Panel' : '🔔 Open Dashboard';
    const ctaButtonHtml = `
              <div style="text-align: center; margin: 20px 0;">
                <a href="https://smartbookly.com/dashboard" style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #ffffff; padding: 12px 28px; border-radius: 6px; text-decoration: none; font-weight: 600; font-size: 14px;">${ctaLabel}</a>
              </div>`;
    const emailBody = rawEmailBody.replace(/<hr style="border: none; border-top: 1px solid #eee; margin: 25px 0;">/, ctaButtonHtml + '<hr style="border: none; border-top: 1px solid #eee; margin: 25px 0;">');

    const emailResponse = await resend.emails.send({
      from: "SmartBookly <noreply@smartbookly.com>",
      to: [emailToSend],
      subject: subject,
      html: emailBody,
    });

    if (emailResponse.error) {
      console.error("❌ Resend API error:", emailResponse.error);
      // Remove from sent map if email failed
      recentlySentEmails.delete(emailKey);
      return new Response(
        JSON.stringify({ success: false, error: emailResponse.error.message }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log(`✅ Custom reminder email sent successfully in ${languagePreference}:`, emailResponse);

    return new Response(
      JSON.stringify({ success: true, data: emailResponse.data, language: languagePreference }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("❌ Error sending custom reminder email:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
