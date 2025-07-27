
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { Resend } from 'npm:resend@2.0.0';

const resend = new Resend(Deno.env.get('RESEND_API_KEY'));

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface TaskReminderEmailRequest {
  email: string;
  fullName: string;
  taskTitle: string;
  reminderTime: string;
  language: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, fullName, taskTitle, reminderTime, language }: TaskReminderEmailRequest = await req.json();
    
    console.log('Sending task reminder email:', { email, fullName, taskTitle, reminderTime, language });

    // Format reminder time for display
    const reminderDate = new Date(reminderTime);
    const formattedTime = reminderDate.toLocaleString(
      language === 'ka' ? 'ka-GE' : language === 'es' ? 'es-ES' : 'en-US',
      {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }
    );

    // Generate localized email content
    let emailSubject: string;
    let htmlContent: string;

    if (language === 'ka') {
      emailSubject = 'ახალი შეხსენება თქვენს დავალებაზე';
      htmlContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #333; margin-bottom: 20px;">გამარჯობა, ${fullName}!</h2>
          <p style="color: #666; line-height: 1.6; margin-bottom: 15px;">
            თქვენ გაქვთ დაგეგმილი შეხსენება დავალებისთვის:
          </p>
          <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <h3 style="color: #333; margin: 0 0 10px 0;">${taskTitle}</h3>
            <p style="color: #666; margin: 0;">შეხსენების დრო: ${formattedTime}</p>
          </div>
          <p style="color: #666; line-height: 1.6;">
            დაუვიწყდეთ თქვენი დავალების შესრულება!
          </p>
          <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
          <p style="color: #999; font-size: 12px; font-style: italic;">
            ეს არის ავტომატური შეტყობინება SmartBookly-დან.
          </p>
        </div>
      `;
    } else if (language === 'es') {
      emailSubject = 'Nuevo recordatorio para tu tarea';
      htmlContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #333; margin-bottom: 20px;">¡Hola, ${fullName}!</h2>
          <p style="color: #666; line-height: 1.6; margin-bottom: 15px;">
            Tienes un recordatorio programado para la tarea:
          </p>
          <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <h3 style="color: #333; margin: 0 0 10px 0;">${taskTitle}</h3>
            <p style="color: #666; margin: 0;">Hora del recordatorio: ${formattedTime}</p>
          </div>
          <p style="color: #666; line-height: 1.6;">
            ¡No olvides completar tu tarea!
          </p>
          <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
          <p style="color: #999; font-size: 12px; font-style: italic;">
            Este es un mensaje automático de SmartBookly.
          </p>
        </div>
      `;
    } else {
      emailSubject = 'New Reminder for Your Task';
      htmlContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #333; margin-bottom: 20px;">Hello, ${fullName}!</h2>
          <p style="color: #666; line-height: 1.6; margin-bottom: 15px;">
            You have a scheduled reminder for the task:
          </p>
          <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <h3 style="color: #333; margin: 0 0 10px 0;">${taskTitle}</h3>
            <p style="color: #666; margin: 0;">Reminder time: ${formattedTime}</p>
          </div>
          <p style="color: #666; line-height: 1.6;">
            Don't forget to complete your task!
          </p>
          <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
          <p style="color: #999; font-size: 12px; font-style: italic;">
            This is an automated message from SmartBookly.
          </p>
        </div>
      `;
    }

    // Send email via Resend
    const emailResult = await resend.emails.send({
      from: 'SmartBookly <info@smartbookly.com>',
      to: [email],
      subject: emailSubject,
      html: htmlContent,
    });

    if (emailResult.error) {
      console.error('Error sending task reminder email:', emailResult.error);
      throw new Error(emailResult.error.message || 'Failed to send email');
    }

    console.log('Task reminder email sent successfully:', emailResult.data);

    return new Response(JSON.stringify({ success: true, messageId: emailResult.data?.id }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders,
      },
    });
  } catch (error: any) {
    console.error('Error in send-task-reminder-email function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      }
    );
  }
};

serve(handler);
