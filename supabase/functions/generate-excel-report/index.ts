import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.47.2';
import * as XLSX from 'https://cdn.sheetjs.com/xlsx-0.20.1/package/xlsx.mjs';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { reportType, months = 12, userId } = await req.json();
    
    console.log(`📊 Generating ${reportType} report for user ${userId}, ${months} months`);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const today = new Date();
    const startDate = new Date(today);
    startDate.setMonth(today.getMonth() - months);

    let data: any[] = [];
    let columns: string[] = [];
    let filename = '';

    switch (reportType) {
      case 'payments': {
        const { data: events } = await supabase
          .from('events')
          .select('title, user_surname, user_number, start_date, payment_amount, payment_status, created_at')
          .eq('user_id', userId)
          .gte('created_at', startDate.toISOString())
          .is('deleted_at', null)
          .order('created_at', { ascending: false });

        const { data: customers } = await supabase
          .from('customers')
          .select('title, user_surname, user_number, start_date, payment_amount, payment_status, created_at')
          .eq('user_id', userId)
          .gte('created_at', startDate.toISOString())
          .is('deleted_at', null)
          .order('created_at', { ascending: false });

        data = [
          ...(events || []).map(e => ({
            'Title': e.title,
            'Customer Name': e.user_surname || '',
            'Phone': e.user_number || '',
            'Date': new Date(e.start_date || e.created_at).toLocaleDateString(),
            'Amount': e.payment_amount || 0,
            'Status': e.payment_status || 'not_paid',
            'Source': 'Event'
          })),
          ...(customers || []).map(c => ({
            'Title': c.title,
            'Customer Name': c.user_surname || '',
            'Phone': c.user_number || '',
            'Date': new Date(c.start_date || c.created_at).toLocaleDateString(),
            'Amount': c.payment_amount || 0,
            'Status': c.payment_status || 'not_paid',
            'Source': 'Customer'
          }))
        ];
        filename = `payment-history-${months}months-${Date.now()}.xlsx`;
        break;
      }

      case 'events': {
        const { data: events } = await supabase
          .from('events')
          .select('title, user_surname, user_number, social_network_link, start_date, end_date, payment_amount, payment_status, event_notes, created_at')
          .eq('user_id', userId)
          .gte('created_at', startDate.toISOString())
          .is('deleted_at', null)
          .order('start_date', { ascending: false });

        data = (events || []).map(e => ({
          'Title': e.title,
          'Customer Name': e.user_surname || '',
          'Phone': e.user_number || '',
          'Social Network': e.social_network_link || '',
          'Start Date': new Date(e.start_date).toLocaleString(),
          'End Date': new Date(e.end_date).toLocaleString(),
          'Amount': e.payment_amount || 0,
          'Payment Status': e.payment_status || 'not_paid',
          'Notes': e.event_notes || '',
          'Created': new Date(e.created_at).toLocaleDateString()
        }));
        filename = `events-${months}months-${Date.now()}.xlsx`;
        break;
      }

      case 'tasks': {
        console.log(`📋 Fetching tasks for user ${userId} from ${startDate.toISOString()}`);
        const { data: tasks, error: tasksError } = await supabase
          .from('tasks')
          .select('title, description, status, position, deadline_at, assigned_to_name, created_at, updated_at, created_by_name, last_edited_by_name')
          .eq('user_id', userId)
          .gte('created_at', startDate.toISOString())
          .is('archived_at', null)
          .order('created_at', { ascending: false });
        
        if (tasksError) {
          console.error('❌ Error fetching tasks:', tasksError);
          throw tasksError;
        }
        
        console.log(`✅ Found ${tasks?.length || 0} tasks`);

        data = (tasks || []).map(t => ({
          'Title': t.title,
          'Description': t.description || '',
          'Status': t.status,
          'Position': t.position || '',
          'Assigned To': t.assigned_to_name || 'Unassigned',
          'Deadline': t.deadline_at ? new Date(t.deadline_at).toLocaleDateString() : '',
          'Created By': t.created_by_name || '',
          'Last Edited By': t.last_edited_by_name || '',
          'Created': new Date(t.created_at).toLocaleDateString(),
          'Updated': t.updated_at ? new Date(t.updated_at).toLocaleDateString() : ''
        }));
        filename = `tasks-${months}months-${Date.now()}.xlsx`;
        break;
      }

      case 'customers': {
        const { data: customers } = await supabase
          .from('customers')
          .select('title, user_surname, user_number, social_network_link, payment_amount, payment_status, event_notes, created_at')
          .eq('user_id', userId)
          .gte('created_at', startDate.toISOString())
          .is('deleted_at', null)
          .order('created_at', { ascending: false });

        data = (customers || []).map(c => ({
          'Title': c.title,
          'Name': c.user_surname || '',
          'Phone': c.user_number || '',
          'Social Network': c.social_network_link || '',
          'Payment Amount': c.payment_amount || 0,
          'Payment Status': c.payment_status || 'not_paid',
          'Notes': c.event_notes || '',
          'Created': new Date(c.created_at).toLocaleDateString()
        }));
        filename = `customers-${months}months-${Date.now()}.xlsx`;
        break;
      }

      case 'bookings': {
        const { data: bookings } = await supabase
          .from('booking_requests')
          .select('title, requester_name, requester_email, requester_phone, start_date, end_date, payment_amount, payment_status, status, created_at')
          .gte('created_at', startDate.toISOString())
          .order('created_at', { ascending: false });

        data = (bookings || []).map(b => ({
          'Title': b.title,
          'Requester Name': b.requester_name,
          'Email': b.requester_email,
          'Phone': b.requester_phone || '',
          'Start Date': new Date(b.start_date).toLocaleString(),
          'End Date': new Date(b.end_date).toLocaleString(),
          'Amount': b.payment_amount || 0,
          'Payment Status': b.payment_status || 'not_paid',
          'Booking Status': b.status,
          'Created': new Date(b.created_at).toLocaleDateString()
        }));
        filename = `bookings-${months}months-${Date.now()}.xlsx`;
        break;
      }

      default:
        throw new Error(`Unknown report type: ${reportType}`);
    }

    if (data.length === 0) {
      console.log(`ℹ️ No data found for ${reportType} report`);
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'No data found for the specified period',
          recordCount: 0
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create workbook and worksheet
    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Report');

    // Generate Excel file as buffer
    const excelBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    // Upload to Supabase storage using service role (full access)
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('excel-reports')
      .upload(`${userId}/${filename}`, excelBuffer, {
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        upsert: true,
        cacheControl: '3600'
      });

    if (uploadError) {
      console.error('❌ Upload error:', uploadError);
      throw uploadError;
    }

    console.log(`✅ File uploaded successfully: ${userId}/${filename}`);

    // Get public URL (bucket is now public for easy access)
    const { data: urlData } = supabase.storage
      .from('excel-reports')
      .getPublicUrl(`${userId}/${filename}`, {
        download: true
      });

    if (!urlData?.publicUrl) {
      console.error('❌ No public URL in response');
      throw new Error('Failed to generate download URL');
    }

    console.log(`✅ Public URL created: ${urlData.publicUrl.substring(0, 100)}...`);
    
    // Background cleanup: delete files older than 24 hours
    const oneDayAgo = new Date();
    oneDayAgo.setDate(oneDayAgo.getDate() - 1);
    
    supabase.storage
      .from('excel-reports')
      .list(userId, { limit: 100 })
      .then(({ data: files }) => {
        if (files) {
          const oldFiles = files.filter(f => new Date(f.created_at) < oneDayAgo);
          if (oldFiles.length > 0) {
            const filesToDelete = oldFiles.map(f => `${userId}/${f.name}`);
            supabase.storage.from('excel-reports').remove(filesToDelete)
              .then(() => console.log(`🗑️ Cleaned up ${oldFiles.length} old files`))
              .catch(err => console.error('⚠️ Cleanup error:', err));
          }
        }
      })
      .catch(err => console.error('⚠️ Cleanup listing error:', err));

    console.log(`📊 Report complete: ${filename} with ${data.length} records`);

    return new Response(
      JSON.stringify({
        success: true,
        downloadUrl: urlData.publicUrl,
        filename,
        recordCount: data.length
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error generating Excel report:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
