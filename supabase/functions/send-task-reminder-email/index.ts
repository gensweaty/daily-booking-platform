
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface TaskReminderRequest {
  taskId: string;
  taskTitle: string;
  taskDescription?: string;
  deadlineAt?: string;
  userEmail: string;
  language: string;
}

const getEmailContent = (language: string, taskTitle: string, taskDescription?: string, deadlineAt?: string) => {
  const formatDateTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleString(language === 'ka' ? 'ka-GE' : language === 'es' ? 'es-ES' : 'en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  switch (language) {
    case 'ka':
      return {
        subject: `📋 დავალების შეხსენება: ${taskTitle}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
              <h2 style="color: #333; margin: 0 0 10px 0;">📋 დავალების შეხსენება</h2>
              <p style="color: #666; margin: 0;">თქვენ გაქვთ დაგეგმილი დავალება</p>
            </div>
            
            <div style="background-color: #fff; border: 1px solid #e9ecef; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
              <h3 style="color: #333; margin: 0 0 15px 0;">${taskTitle}</h3>
              ${taskDescription ? `<p style="color: #666; margin: 0 0 15px 0;">${taskDescription}</p>` : ''}
              ${deadlineAt ? `<p style="color: #dc3545; margin: 0; font-weight: bold;">📅 ვადა: ${formatDateTime(deadlineAt)}</p>` : ''}
            </div>
            
            <div style="background-color: #f8f9fa; padding: 15px; border-radius: 8px; text-align: center;">
              <p style="color: #666; margin: 0; font-size: 14px;">
                ეს შეხსენება გაიგზავნა SmartBookly-დან
              </p>
            </div>
          </div>
        `
      };
    case 'es':
      return {
        subject: `📋 Recordatorio de tarea: ${taskTitle}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
              <h2 style="color: #333; margin: 0 0 10px 0;">📋 Recordatorio de Tarea</h2>
              <p style="color: #666; margin: 0;">Tienes una tarea programada</p>
            </div>
            
            <div style="background-color: #fff; border: 1px solid #e9ecef; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
              <h3 style="color: #333; margin: 0 0 15px 0;">${taskTitle}</h3>
              ${taskDescription ? `<p style="color: #666; margin: 0 0 15px 0;">${taskDescription}</p>` : ''}
              ${deadlineAt ? `<p style="color: #dc3545; margin: 0; font-weight: bold;">📅 Fecha límite: ${formatDateTime(deadlineAt)}</p>` : ''}
            </div>
            
            <div style="background-color: #f8f9fa; padding: 15px; border-radius: 8px; text-align: center;">
              <p style="color: #666; margin: 0; font-size: 14px;">
                Este recordatorio fue enviado desde SmartBookly
              </p>
            </div>
          </div>
        `
      };
    default:
      return {
        subject: `📋 Task Reminder: ${taskTitle}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
              <h2 style="color: #333; margin: 0 0 10px 0;">📋 Task Reminder</h2>
              <p style="color: #666; margin: 0;">You have a scheduled task</p>
            </div>
            
            <div style="background-color: #fff; border: 1px solid #e9ecef; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
              <h3 style="color: #333; margin: 0 0 15px 0;">${taskTitle}</h3>
              ${taskDescription ? `<p style="color: #666; margin: 0 0 15px 0;">${taskDescription}</p>` : ''}
              ${deadlineAt ? `<p style="color: #dc3545; margin: 0; font-weight: bold;">📅 Deadline: ${formatDateTime(deadlineAt)}</p>` : ''}
            </div>
            
            <div style="background-color: #f8f9fa; padding: 15px; border-radius: 8px; text-align: center;">
              <p style="color: #666; margin: 0; font-size: 14px;">
                This reminder was sent from SmartBookly
              </p>
            </div>
          </div>
        `
      };
  }
};

const handler = async (req: Request): Promise<Response> => {
  console.log("Received request to send-task-reminder-email function");

  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (!RESEND_API_KEY) {
    console.error("RESEND_API_KEY is not set in environment variables");
    return new Response(
      JSON.stringify({ 
        error: "Server configuration error", 
        details: "Missing RESEND_API_KEY environment variable" 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  try {
    const taskReminderRequest: TaskReminderRequest = await req.json();
    console.log("Processing task reminder request:", taskReminderRequest);

    const { subject, html } = getEmailContent(
      taskReminderRequest.language,
      taskReminderRequest.taskTitle,
      taskReminderRequest.taskDescription,
      taskReminderRequest.deadlineAt
    );

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "SmartBookly <onboarding@resend.dev>",
        to: [taskReminderRequest.userEmail],
        subject: subject,
        html: html,
      }),
    });

    const data = await res.json();
    console.log("Resend API response:", data);

    if (!res.ok) {
      console.error("Error from Resend API:", data);
      return new Response(
        JSON.stringify({ 
          error: "Failed to send email", 
          details: data 
        }),
        {
          status: res.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    return new Response(
      JSON.stringify({ 
        message: "Task reminder email sent successfully", 
        data 
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );

  } catch (error: any) {
    console.error("Error in send-task-reminder-email function:", error);
    return new Response(
      JSON.stringify({ 
        error: "Internal server error", 
        details: error.message 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
};

serve(handler);
