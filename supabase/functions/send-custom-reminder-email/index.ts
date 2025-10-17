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
  recipientEmail?: string; // NEW: Email to send reminder to (for customers/event persons)
}

// Multi-language email content
const getEmailContent = (language: string, title: string, message: string | undefined, reminderTime: string) => {
  let subject, body;
  
  if (language === 'ka') {
    subject = "🔔 შეხსენება";
    body = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 8px; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1); border: 1px solid #e5e7eb;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 24px; border-radius: 8px 8px 0 0; text-align: center;">
          <div style="margin: 0 auto 12px auto; width: 48px; height: 48px; display: flex; align-items: center; justify-content: center;">
            <span style="font-size: 32px;">🔔</span>
          </div>
          <h1 style="color: #ffffff; margin: 0; font-size: 18px; font-weight: 600;">შეხსენება</h1>
        </div>
        
        <div style="padding: 20px;">
          <div style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 6px; padding: 14px; margin-bottom: 12px;">
            <h2 style="color: #111827; margin: 0; font-size: 15px; font-weight: 600; line-height: 1.4;">${title}</h2>
          </div>
          
          ${message && message !== title ? `
            <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #667eea;">
              <p style="color: #4b5563; margin: 0; line-height: 1.6;">${message}</p>
            </div>
          ` : ''}
          
          <div style="background: #1f2937; border: 1px solid #374151; border-radius: 6px; padding: 14px; margin-bottom: 16px;">
            <div style="color: #9ca3af; font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px;">დაგეგმილია</div>
            <div style="display: flex; align-items: center;">
              <span style="color: #f3f4f6; margin-right: 6px; font-size: 14px;">🕐</span>
              <span style="color: #ffffff; font-size: 13px; font-weight: 500;">${new Date(reminderTime).toLocaleString('ka-GE')}</span>
            </div>
          </div>
          
          <div style="text-align: center; padding: 14px; background: #f3f4f6; border-radius: 6px; border: 1px solid #e5e7eb;">
            <p style="margin: 0; color: #6b7280; font-size: 12px;">
              📱 SmartBookly-დან მიღებული შეხსენება
            </p>
          </div>
        </div>
      </div>
    `;
  } else if (language === 'es') {
    subject = "🔔 Recordatorio";
    body = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 8px; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1); border: 1px solid #e5e7eb;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 24px; border-radius: 8px 8px 0 0; text-align: center;">
          <div style="margin: 0 auto 12px auto; width: 48px; height: 48px; display: flex; align-items: center; justify-content: center;">
            <span style="font-size: 32px;">🔔</span>
          </div>
          <h1 style="color: #ffffff; margin: 0; font-size: 18px; font-weight: 600;">Recordatorio</h1>
        </div>
        
        <div style="padding: 20px;">
          <div style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 6px; padding: 14px; margin-bottom: 12px;">
            <h2 style="color: #111827; margin: 0; font-size: 15px; font-weight: 600; line-height: 1.4;">${title}</h2>
          </div>
          
          ${message && message !== title ? `
            <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #667eea;">
              <p style="color: #4b5563; margin: 0; line-height: 1.6;">${message}</p>
            </div>
          ` : ''}
          
          <div style="background: #1f2937; border: 1px solid #374151; border-radius: 6px; padding: 14px; margin-bottom: 16px;">
            <div style="color: #9ca3af; font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px;">Programada Para</div>
            <div style="display: flex; align-items: center;">
              <span style="color: #f3f4f6; margin-right: 6px; font-size: 14px;">🕐</span>
              <span style="color: #ffffff; font-size: 13px; font-weight: 500;">${new Date(reminderTime).toLocaleString('es-ES')}</span>
            </div>
          </div>
          
          <div style="text-align: center; padding: 14px; background: #f3f4f6; border-radius: 6px; border: 1px solid #e5e7eb;">
            <p style="margin: 0; color: #6b7280; font-size: 12px;">
              📱 Recordatorio de SmartBookly
            </p>
          </div>
        </div>
      </div>
    `;
  } else {
    subject = "🔔 Reminder";
    body = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 8px; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1); border: 1px solid #e5e7eb;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 24px; border-radius: 8px 8px 0 0; text-align: center;">
          <div style="margin: 0 auto 12px auto; width: 48px; height: 48px; display: flex; align-items: center; justify-content: center;">
            <span style="font-size: 32px;">🔔</span>
          </div>
          <h1 style="color: #ffffff; margin: 0; font-size: 18px; font-weight: 600;">Reminder Alert</h1>
        </div>
        
        <div style="padding: 20px;">
          <div style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 6px; padding: 14px; margin-bottom: 12px;">
            <h2 style="color: #111827; margin: 0; font-size: 15px; font-weight: 600; line-height: 1.4;">${title}</h2>
          </div>
          
          ${message && message !== title ? `
            <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #667eea;">
              <p style="color: #4b5563; margin: 0; line-height: 1.6;">${message}</p>
            </div>
          ` : ''}
          
          <div style="background: #1f2937; border: 1px solid #374151; border-radius: 6px; padding: 14px; margin-bottom: 16px;">
            <div style="color: #9ca3af; font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px;">Scheduled For</div>
            <div style="display: flex; align-items: center;">
              <span style="color: #f3f4f6; margin-right: 6px; font-size: 14px;">🕐</span>
              <span style="color: #ffffff; font-size: 13px; font-weight: 500;">${new Date(reminderTime).toLocaleString('en-US')}</span>
            </div>
          </div>
          
          <div style="text-align: center; padding: 14px; background: #f3f4f6; border-radius: 6px; border: 1px solid #e5e7eb;">
            <p style="margin: 0; color: #6b7280; font-size: 12px;">
              📱 Reminder from SmartBookly
            </p>
          </div>
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
    const { reminderId, userEmail, title, message, reminderTime, userId, recipientUserId, createdByType, createdBySubUserId, recipientEmail }: CustomReminderEmailRequest = await req.json();

    // NEW: Use recipient email if provided, otherwise use admin email
    const emailToSend = recipientEmail || userEmail;

    // Validate required fields
    if (!reminderId || !emailToSend || !title || !userId) {
      console.error("❌ Missing required fields");
      return new Response(
        JSON.stringify({ success: false, error: "Missing required fields" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Check for duplicate email - IMMEDIATE check before processing
    const emailKey = `${reminderId}-${emailToSend}`;
    const lastSent = recentlySentEmails.get(emailKey);
    if (lastSent && Date.now() - lastSent < DUPLICATE_WINDOW_MS) {
      console.log(`⚠️ Duplicate email prevented for ${emailKey} (sent ${Math.round((Date.now() - lastSent) / 1000)}s ago)`);
      return new Response(
        JSON.stringify({ success: true, duplicate: true, message: "Email already sent recently" }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Mark as sent IMMEDIATELY to prevent race conditions
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

    // Get localized email content
    const { subject, body: emailBody } = getEmailContent(languagePreference, title, message, reminderTime);

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
