
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "npm:resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface EventReminderRequest {
  eventId: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { eventId }: EventReminderRequest = await req.json();
    console.log("📅 Processing event reminder for event:", eventId);

    if (!eventId) {
      console.error("❌ No event ID provided");
      return new Response(
        JSON.stringify({ error: "Event ID is required" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Initialize Supabase client
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Get event details
    const { data: event, error: eventError } = await supabase
      .from("events")
      .select("*")
      .eq("id", eventId)
      .single();

    if (eventError || !event) {
      console.error("❌ Event not found:", eventError);
      return new Response(
        JSON.stringify({ error: "Event not found" }),
        {
          status: 404,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Get additional persons for this event
    const { data: additionalPersons, error: personsError } = await supabase
      .from("customers")
      .select("*")
      .eq("event_id", eventId);

    if (personsError) {
      console.error("❌ Error fetching additional persons:", personsError);
    }

    // Collect all email recipients
    const recipients: string[] = [];
    
    // Add main event person email
    if (event.social_network_link && event.social_network_link.includes("@")) {
      recipients.push(event.social_network_link);
    }

    // Add additional persons' emails
    if (additionalPersons) {
      for (const person of additionalPersons) {
        if (person.social_network_link && person.social_network_link.includes("@")) {
          recipients.push(person.social_network_link);
        }
      }
    }

    if (recipients.length === 0) {
      console.log("⚠️ No valid email recipients found for event:", eventId);
      return new Response(
        JSON.stringify({ error: "No valid email recipients found" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    console.log("📧 Sending reminders to:", recipients);

    // Format event date
    const eventDate = new Date(event.start_date);
    const formattedDate = eventDate.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

    // Prepare email content
    const eventTitle = event.title || event.user_surname || "Event";
    const eventName = event.event_name ? ` (${event.event_name})` : "";
    const subject = `📅 Event Reminder: ${eventTitle}${eventName}`;
    
    const emailBody = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">📅 Event Reminder</h2>
        <p>This is a friendly reminder about your upcoming event:</p>
        
        <div style="background-color: #f9f9f9; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="margin: 0 0 10px 0; color: #555;">${eventTitle}${eventName}</h3>
          <p style="margin: 5px 0;"><strong>📅 Date & Time:</strong> ${formattedDate}</p>
          ${event.event_notes ? `<p style="margin: 5px 0;"><strong>📝 Notes:</strong> ${event.event_notes}</p>` : ""}
          ${event.user_number ? `<p style="margin: 5px 0;"><strong>📞 Contact:</strong> ${event.user_number}</p>` : ""}
        </div>
        
        <p>We look forward to seeing you at the event!</p>
        
        <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; font-size: 12px; color: #888;">
          <p>This is an automated reminder email. Please don't reply to this message.</p>
        </div>
      </div>
    `;

    // Send emails to all recipients
    const emailResults = [];
    for (const recipient of recipients) {
      try {
        const emailResponse = await resend.emails.send({
          from: "Event Reminder <onboarding@resend.dev>",
          to: [recipient],
          subject: subject,
          html: emailBody,
        });

        console.log(`✅ Email sent successfully to ${recipient}:`, emailResponse);
        emailResults.push({ recipient, success: true, id: emailResponse.data?.id });
      } catch (emailError) {
        console.error(`❌ Failed to send email to ${recipient}:`, emailError);
        emailResults.push({ recipient, success: false, error: emailError.message });
      }
    }

    // Update event to mark reminder as sent
    const { error: updateError } = await supabase
      .from("events")
      .update({ reminder_sent_at: new Date().toISOString() })
      .eq("id", eventId);

    if (updateError) {
      console.error("⚠️ Failed to update reminder_sent_at:", updateError);
    }

    console.log("📊 Email reminder results:", emailResults);

    return new Response(
      JSON.stringify({
        success: true,
        event: eventTitle,
        recipients: recipients.length,
        results: emailResults,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("❌ Error in send-event-reminder-email function:", error);
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
