import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.47.2';
import * as XLSX from 'https://cdn.sheetjs.com/xlsx-0.20.1/package/xlsx.mjs';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Helper functions for resilient field access
const pick = (obj: any, keys: string[], fallback: any = "") =>
  keys.find(k => obj?.[k] !== undefined && obj?.[k] !== null) ? obj[keys.find(k => obj?.[k] !== undefined && obj?.[k] !== null)!] : fallback;

const normTaskStatus = (s?: string) => (s ? ( { inprogress: "in_progress", "in-progress": "in_progress" } as any)[s] || s : "");

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

        // Try owner_id variants & archived filter without breaking if a column doesn't exist
        const combos = [
          { ownerCol: "user_id",   archivedCol: "archived_at" },
          { ownerCol: "owner_id",  archivedCol: "archived_at" },
          { ownerCol: "board_owner_id", archivedCol: "archived_at" },
          { ownerCol: "user_id",   archivedCol: null },
          { ownerCol: "owner_id",  archivedCol: null },
          { ownerCol: "board_owner_id", archivedCol: null },
        ];

        let tasks: any[] = [];
        for (const c of combos) {
          try {
            let q = supabase.from('tasks').select('*').eq(c.ownerCol as any, userId);
            if (c.archivedCol) q = q.is(c.archivedCol as any, null);
            q = q.gte('created_at', startDate.toISOString()).order('created_at', { ascending: false });

            const { data, error } = await q;
            if (error) {
              if (/column .* does not exist/i.test(error.message)) continue;
              throw error;
            }
            tasks = data || [];
            console.log(`✅ Tasks pull via ${c.ownerCol}${c.archivedCol ? '+archived_at' : ''}: ${tasks.length}`);
            break;
          } catch (e) {
            console.log('↩︎ try next owner/archived combo', e instanceof Error ? e.message : e);
            continue;
          }
        }

        console.log(`✅ Consolidated tasks count: ${tasks.length}`);

        data = tasks.map(t => {
          const deadline = pick(t, ['deadline_at','due_date'], '');
          const assignedTo = pick(t, ['assigned_to_name','assignee_name','assignee','assigned_to'], 'Unassigned');
          const created = pick(t, ['created_at'], null);
          const updated = pick(t, ['updated_at'], null);
          const priority = pick(t, ['priority'], '');

          return {
            'Title': t.title || '',
            'Description': t.description || '',
            'Status': normTaskStatus(t.status) || '',
            'Priority': priority,
            'Assigned To': assignedTo,
            'Deadline': deadline ? new Date(deadline).toLocaleString() : '',
            'Created': created ? new Date(created).toLocaleString() : '',
            'Updated': updated ? new Date(updated).toLocaleString() : ''
          };
        });

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

    // Generate signed URL with 1-hour expiry
    const { data: signed, error: signErr } = await supabase.storage
      .from('excel-reports')
      .createSignedUrl(`${userId}/${filename}`, 3600, { download: filename });

    if (signErr || !signed?.signedUrl) {
      console.error('❌ Signed URL error:', signErr);
      throw new Error('Failed to generate signed download URL');
    }

    console.log(`✅ Signed URL created (expires in 1h): ${signed.signedUrl.substring(0, 100)}...`);
    
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
        downloadUrl: signed.signedUrl,
        filename,
        recordCount: data.length,
        expiresInSeconds: 3600
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
