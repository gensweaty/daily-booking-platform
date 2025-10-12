import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CustomReminderEmailRequest {
  reminderId: string;
  userEmail: string;
  title: string;
  message?: string;
  reminderTime: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { reminderId, userEmail, title, message, reminderTime }: CustomReminderEmailRequest = await req.json();

    console.log(`📧 Sending custom reminder email for reminder ${reminderId} to ${userEmail}`);

    const emailResponse = await resend.emails.send({
      from: "Smartbookly Reminders <onboarding@resend.dev>",
      to: [userEmail],
      subject: `🔔 Reminder: ${title}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 24px;">🔔 Reminder Alert</h1>
          </div>
          
          <div style="background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px;">
            <h2 style="color: #1f2937; margin-top: 0;">${title}</h2>
            
            ${message ? `
              <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #667eea;">
                <p style="color: #4b5563; margin: 0; line-height: 1.6;">${message}</p>
              </div>
            ` : ''}
            
            <div style="background: white; padding: 15px; border-radius: 8px; margin: 20px 0;">
              <p style="color: #6b7280; margin: 0; font-size: 14px;">
                <strong>⏰ Scheduled for:</strong> ${new Date(reminderTime).toLocaleString()}
              </p>
            </div>
            
            <div style="text-align: center; margin-top: 30px;">
              <p style="color: #6b7280; font-size: 14px; margin: 0;">
                This reminder was scheduled through Smartbookly AI
              </p>
            </div>
          </div>
        </div>
      `,
    });

    console.log("✅ Custom reminder email sent successfully:", emailResponse);

    return new Response(JSON.stringify({ success: true, emailResponse }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  } catch (error: any) {
    console.error("❌ Error sending custom reminder email:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
