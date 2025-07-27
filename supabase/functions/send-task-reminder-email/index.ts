
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface TaskReminderEmailRequest {
  email: string;
  fullName: string;
  taskTitle: string;
  reminderTime: string;
  language?: string;
  taskId?: string;
}

// Function to get email content based on language
function getEmailContent(
  language: string,
  fullName: string,
  taskTitle: string,
  formattedReminderTime: string
): { subject: string; content: string } {
  const normalizedLang = (language || 'en').toLowerCase();
  
  let subject = '';
  let content = '';

  switch (normalizedLang) {
    case 'ka': // Georgian
      subject = `ახალი შეხსენება თქვენს დავალებაზე`;
      content = `
        <!DOCTYPE html>
        <html lang="ka">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>დავალების შეხსენება</title>
        </head>
        <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eaeaea; border-radius: 5px;">
          <h2 style="color: #333;">გამარჯობა ${fullName},</h2>
          <p>თქვენ გაქვთ დაგეგმილი შეხსენება დავალებაზე:</p>
          <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <p style="margin: 0; font-weight: bold; color: #333;">${taskTitle}</p>
            <p style="margin: 5px 0 0 0; color: #666; font-size: 14px;">შეხსენების დრო: ${formattedReminderTime}</p>
          </div>
          <p>გისურვებთ წარმატებას!</p>
          <hr style="border: none; border-top: 1px solid #eaeaea; margin: 20px 0;">
          <p style="color: #777; font-size: 14px;"><i>ეს არის ავტომატური შეტყობინება SmartBookly-სგან.</i></p>
        </body>
        </html>
      `;
      break;
      
    case 'es': // Spanish
      subject = `Nuevo recordatorio para tu tarea`;
      content = `
        <!DOCTYPE html>
        <html lang="es">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Recordatorio de Tarea</title>
        </head>
        <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eaeaea; border-radius: 5px;">
          <h2 style="color: #333;">Hola ${fullName},</h2>
          <p>Tienes un recordatorio programado para la tarea:</p>
          <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <p style="margin: 0; font-weight: bold; color: #333;">${taskTitle}</p>
            <p style="margin: 5px 0 0 0; color: #666; font-size: 14px;">Hora del recordatorio: ${formattedReminderTime}</p>
          </div>
          <p>¡Te deseamos éxito!</p>
          <hr style="border: none; border-top: 1px solid #eaeaea; margin: 20px 0;">
          <p style="color: #777; font-size: 14px;"><i>Este es un mensaje automático de SmartBookly.</i></p>
        </body>
        </html>
      `;
      break;
      
    default: // English
      subject = `Task Reminder: ${taskTitle}`;
      content = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Task Reminder</title>
        </head>
        <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eaeaea; border-radius: 5px;">
          <h2 style="color: #333;">Hello ${fullName},</h2>
          <p>You have a scheduled reminder for the task:</p>
          <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <p style="margin: 0; font-weight: bold; color: #333;">${taskTitle}</p>
            <p style="margin: 5px 0 0 0; color: #666; font-size: 14px;">Reminder time: ${formattedReminderTime}</p>
          </div>
          <p>Good luck with your task!</p>
          <hr style="border: none; border-top: 1px solid #eaeaea; margin: 20px 0;">
          <p style="color: #777; font-size: 14px;"><i>This is an automated message from SmartBookly.</i></p>
        </body>
        </html>
      `;
      break;
  }

  return { subject, content };
}

// Format reminder time for display
function formatReminderTime(isoString: string, language?: string): string {
  try {
    let locale = 'en-US';
    if (language === 'ka') {
      locale = 'ka-GE';
    } else if (language === 'es') {
      locale = 'es-ES';
    }
    
    const formatter = new Intl.DateTimeFormat(locale, {
      timeZone: 'Asia/Tbilisi',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: language !== 'ka',
    });
    
    const date = new Date(isoString);
    return formatter.format(date);
  } catch (error) {
    console.error(`Error formatting reminder time: ${error}`);
    return isoString;
  }
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  console.log("Received request to send task reminder email");

  try {
    const requestBody = await req.text();
    
    let parsedBody: TaskReminderEmailRequest;
    try {
      parsedBody = JSON.parse(requestBody);
    } catch (parseError) {
      console.error("Failed to parse JSON request:", parseError);
      return new Response(
        JSON.stringify({ error: "Invalid JSON in request body" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" }}
      );
    }
    
    const { email, fullName, taskTitle, reminderTime, language, taskId } = parsedBody;

    console.log("Request body:", {
      email,
      fullName,
      taskTitle,
      reminderTime,
      language,
      taskId
    });

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      console.error("Invalid email format:", email);
      return new Response(
        JSON.stringify({ error: "Invalid email format" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" }}
      );
    }

    // Validate required fields
    if (!fullName || !taskTitle || !reminderTime) {
      console.error("Missing required fields");
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" }}
      );
    }

    // Format reminder time
    const formattedReminderTime = formatReminderTime(reminderTime, language);
    
    // Get email content based on language
    const emailData = getEmailContent(
      language || 'en',
      fullName,
      taskTitle,
      formattedReminderTime
    );

    // Use Resend API to send the email
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      throw new Error("Missing RESEND_API_KEY");
    }

    const resend = new Resend(resendApiKey);
    
    console.log("Sending task reminder email with subject:", emailData.subject);
    
    const emailResult = await resend.emails.send({
      from: "SmartBookly <info@smartbookly.com>",
      to: [email],
      subject: emailData.subject,
      html: emailData.content,
    });

    if (emailResult.error) {
      console.error("Error from Resend API:", emailResult.error);
      throw new Error(emailResult.error.message || "Unknown Resend API error");
    }

    console.log(`Task reminder email successfully sent to ${email}, ID: ${emailResult.data?.id}`);
    
    return new Response(
      JSON.stringify({ 
        message: "Task reminder email sent successfully",
        to: email,
        id: emailResult.data?.id,
        taskTitle: taskTitle,
        language: language || 'en',
        emailSubject: emailData.subject
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" }}
    );
    
  } catch (error: any) {
    console.error("Error sending task reminder email:", error);
    return new Response(
      JSON.stringify({
        error: "Failed to send task reminder email",
        details: error.message || "Unknown error"
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" }}
    );
  }
};

serve(handler);
