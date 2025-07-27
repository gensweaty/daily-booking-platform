
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.47.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface TaskReminderRow {
  id: string;
  title: string;
  reminder_at: string;
  email_reminder: boolean;
  reminder_sent: boolean;
  user_id: string;
  user_email?: string;
  user_username?: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  console.log("Processing task reminder queue...");

  try {
    // Initialize Supabase client with service role key for admin access
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Missing Supabase configuration");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get current time
    const now = new Date().toISOString();
    console.log("Current time:", now);

    // Query tasks that need reminder emails
    const { data: tasks, error: queryError } = await supabase
      .from('tasks')
      .select(`
        id,
        title,
        reminder_at,
        email_reminder,
        reminder_sent,
        user_id,
        profiles!inner(username)
      `)
      .eq('email_reminder', true)
      .eq('reminder_sent', false)
      .lte('reminder_at', now)
      .is('deleted_at', null);

    if (queryError) {
      console.error("Error querying tasks:", queryError);
      throw queryError;
    }

    console.log(`Found ${tasks?.length || 0} tasks requiring reminder emails`);

    if (!tasks || tasks.length === 0) {
      return new Response(
        JSON.stringify({ 
          message: "No tasks requiring reminders found",
          processed: 0 
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" }}
      );
    }

    let processedCount = 0;
    let errorCount = 0;

    // Process each task
    for (const task of tasks) {
      try {
        console.log(`Processing task: ${task.id} - ${task.title}`);

        // Get user email from auth.users table
        const { data: userAuth, error: userError } = await supabase.auth.admin.getUserById(task.user_id);
        
        if (userError || !userAuth.user?.email) {
          console.error(`Error getting user email for task ${task.id}:`, userError);
          errorCount++;
          continue;
        }

        const userEmail = userAuth.user.email;
        const userName = (task as any).profiles?.username || userEmail.split('@')[0];

        console.log(`Sending reminder email to: ${userEmail} for task: ${task.title}`);

        // Send reminder email by calling our dedicated email function
        const emailResponse = await fetch(`${supabaseUrl}/functions/v1/send-task-reminder-email`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseServiceKey}`,
          },
          body: JSON.stringify({
            email: userEmail,
            fullName: userName,
            taskTitle: task.title,
            reminderTime: task.reminder_at,
            language: 'en', // Default to English, could be enhanced to get user's language preference
            taskId: task.id
          })
        });

        if (!emailResponse.ok) {
          const errorText = await emailResponse.text();
          console.error(`Failed to send email for task ${task.id}:`, errorText);
          errorCount++;
          continue;
        }

        console.log(`Email sent successfully for task ${task.id}`);

        // Mark reminder as sent
        const { error: updateError } = await supabase
          .from('tasks')
          .update({ reminder_sent: true })
          .eq('id', task.id);

        if (updateError) {
          console.error(`Error updating task ${task.id}:`, updateError);
          errorCount++;
          continue;
        }

        console.log(`Task ${task.id} marked as reminder sent`);
        processedCount++;

      } catch (taskError) {
        console.error(`Error processing task ${task.id}:`, taskError);
        errorCount++;
      }
    }

    console.log(`Task reminder processing complete. Processed: ${processedCount}, Errors: ${errorCount}`);

    return new Response(
      JSON.stringify({
        message: "Task reminder processing completed",
        processed: processedCount,
        errors: errorCount,
        total: tasks.length
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" }}
    );

  } catch (error: any) {
    console.error("Error in process-task-reminder-queue:", error);
    return new Response(
      JSON.stringify({
        error: "Failed to process task reminders",
        details: error.message || "Unknown error"
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" }}
    );
  }
};

serve(handler);
