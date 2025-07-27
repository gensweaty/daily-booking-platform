
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Processing task reminder queue...');

    // Initialize Supabase client with service role key
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get current timestamp
    const now = new Date().toISOString();

    // Query for tasks that need reminder emails
    const { data: tasks, error: queryError } = await supabase
      .from('tasks')
      .select(`
        id,
        title,
        reminder_at,
        send_email_reminder,
        reminder_sent,
        user_id,
        profiles:user_id (
          username
        )
      `)
      .eq('send_email_reminder', true)
      .eq('reminder_sent', false)
      .not('reminder_at', 'is', null)
      .lte('reminder_at', now)
      .not('deleted_at', 'is', null); // Only non-deleted tasks

    if (queryError) {
      console.error('Error querying tasks:', queryError);
      throw queryError;
    }

    console.log(`Found ${tasks?.length || 0} tasks needing reminder emails`);

    if (!tasks || tasks.length === 0) {
      return new Response(JSON.stringify({ processed: 0, message: 'No tasks to process' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    let successCount = 0;
    let errorCount = 0;

    // Process each task
    for (const task of tasks) {
      try {
        // Get user email from auth.users
        const { data: userData, error: userError } = await supabase.auth.admin.getUserById(task.user_id);
        
        if (userError || !userData.user?.email) {
          console.error(`Error getting user data for task ${task.id}:`, userError);
          errorCount++;
          continue;
        }

        const userEmail = userData.user.email;
        const userName = task.profiles?.username || 'User';

        // Get user's language preference (default to 'en' if not available)
        const { data: profileData } = await supabase
          .from('profiles')
          .select('language')
          .eq('id', task.user_id)
          .single();

        const userLanguage = profileData?.language || 'en';

        // Send reminder email
        const emailResponse = await fetch(
          `${Deno.env.get('SUPABASE_URL')}/functions/v1/send-task-reminder-email`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}`,
            },
            body: JSON.stringify({
              email: userEmail,
              fullName: userName,
              taskTitle: task.title,
              reminderTime: task.reminder_at,
              language: userLanguage,
            }),
          }
        );

        if (!emailResponse.ok) {
          const errorText = await emailResponse.text();
          console.error(`Failed to send email for task ${task.id}:`, errorText);
          errorCount++;
          continue;
        }

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

        console.log(`Successfully sent reminder for task ${task.id} to ${userEmail}`);
        successCount++;

      } catch (error) {
        console.error(`Error processing task ${task.id}:`, error);
        errorCount++;
      }
    }

    const result = {
      processed: successCount + errorCount,
      successful: successCount,
      failed: errorCount,
      message: `Processed ${successCount + errorCount} tasks, ${successCount} successful, ${errorCount} failed`
    };

    console.log('Task reminder queue processing complete:', result);

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });

  } catch (error: any) {
    console.error('Error in process-task-reminder-queue function:', error);
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
