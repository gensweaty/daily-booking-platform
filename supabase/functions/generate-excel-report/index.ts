import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.47.2';
import * as XLSX from 'https://esm.sh/xlsx@0.20.1';

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
    
    // CRITICAL FIX: Handle "this month" and "last month" as calendar months, not rolling periods
    // "this month" = first day of current month to today
    // "last month" = first day of previous month to last day of previous month
    // Everything else = rolling period (e.g., "last 3 months" = 3 months ago from today)
    if (months === 1) {
      // For 1 month, assume "this month" - start from first day of current month
      startDate.setDate(1);
      startDate.setHours(0, 0, 0, 0);
    } else if (months > 1 && months < 2) {
      // For values like 1.5, treat as "last month" - previous calendar month
      startDate.setMonth(today.getMonth() - 1);
      startDate.setDate(1);
      startDate.setHours(0, 0, 0, 0);
    } else {
      // For other values, use rolling period (e.g., last 3 months from today)
      startDate.setMonth(today.getMonth() - months);
    }

    let data: any[] = [];
    let columns: string[] = [];
    let filename = '';

    switch (reportType) {
      case 'payments': {
        // CRITICAL FIX: Match statistics page logic exactly
        // Filter events by start_date (when they occur), handle recurring properly
        
        const endDate = new Date(today);
        if (months === 1) {
          endDate.setMonth(endDate.getMonth() + 1);
          endDate.setDate(0);
          endDate.setHours(23, 59, 59, 999);
        } else {
          endDate.setHours(23, 59, 59, 999);
        }
        const startDateStr = startDate.toISOString();
        const endDateStr = endDate.toISOString();

        // Get events by start_date (when they occur)
        const { data: events } = await supabase
          .from('events')
          .select('id, title, user_surname, user_number, start_date, payment_amount, payment_status, is_recurring, parent_event_id, created_at')
          .eq('user_id', userId)
          .gte('start_date', startDateStr)
          .lte('start_date', endDateStr)
          .is('deleted_at', null)
          .order('start_date', { ascending: false });

        // Get approved booking requests by start_date
        const { data: bookingRequests } = await supabase
          .from('booking_requests')
          .select('id, title, requester_name, requester_phone, start_date, payment_amount, payment_status, created_at')
          .eq('user_id', userId)
          .eq('status', 'approved')
          .gte('start_date', startDateStr)
          .lte('start_date', endDateStr)
          .is('deleted_at', null);

        // Process recurring series - only count payment once per series
        const recurringSeriesMap = new Map();
        const processedEvents = [];
        const seenSeriesPayments = new Set();

        for (const event of (events || [])) {
          if (event.is_recurring && event.parent_event_id) {
            // Child instance - track by parent ID
            const parentId = event.parent_event_id;
            if (!seenSeriesPayments.has(parentId)) {
              processedEvents.push(event);
              seenSeriesPayments.add(parentId);
            }
          } else if (event.is_recurring && !event.parent_event_id) {
            // Parent event - track by own ID
            if (!seenSeriesPayments.has(event.id)) {
              processedEvents.push(event);
              seenSeriesPayments.add(event.id);
            }
          } else {
            // Non-recurring event - always include
            processedEvents.push(event);
          }
        }

        // Get additional persons for ALL parent events (including parents of child instances)
        const parentEventIdsSet = new Set();
        (events || []).forEach(e => {
          if (!e.parent_event_id) {
            parentEventIdsSet.add(e.id);
          } else {
            parentEventIdsSet.add(e.parent_event_id);
          }
        });
        
        const parentEventIds = Array.from(parentEventIdsSet);

        let additionalPersons = [];
        if (parentEventIds.length > 0) {
          const { data: customers } = await supabase
            .from('customers')
            .select('event_id, title, user_surname, user_number, start_date, payment_amount, payment_status, created_at')
            .in('event_id', parentEventIds)
            .eq('type', 'customer')
            .is('deleted_at', null);
          additionalPersons = customers || [];
        }

        // Get standalone customers (without events)
        const { data: standaloneCustomers } = await supabase
          .from('customers')
          .select('title, user_surname, user_number, start_date, payment_amount, payment_status, created_at')
          .eq('user_id', userId)
          .is('event_id', null)
          .gte('created_at', startDateStr)
          .lte('created_at', endDateStr)
          .is('deleted_at', null);

        // Calculate total income correctly
        let totalIncome = 0;

        // Add event payments (deduplicated)
        processedEvents.forEach(e => {
          if ((e.payment_status?.includes('partly') || e.payment_status?.includes('fully')) && e.payment_amount) {
            totalIncome += Number(e.payment_amount) || 0;
          }
        });

        // Add additional persons payments
        additionalPersons.forEach(p => {
          if ((p.payment_status?.includes('partly') || p.payment_status?.includes('fully')) && p.payment_amount) {
            totalIncome += Number(p.payment_amount) || 0;
          }
        });

        // Add standalone customers payments
        (standaloneCustomers || []).forEach(c => {
          if ((c.payment_status?.includes('partly') || c.payment_status?.includes('fully')) && c.payment_amount) {
            totalIncome += Number(c.payment_amount) || 0;
          }
        });

        // Add booking requests payments
        (bookingRequests || []).forEach(b => {
          if ((b.payment_status?.includes('partly') || b.payment_status?.includes('fully')) && b.payment_amount) {
            totalIncome += Number(b.payment_amount) || 0;
          }
        });

        console.log(`📊 Payments Excel: Total income ${totalIncome}, Events: ${processedEvents.length}, Customers: ${additionalPersons.length}, Standalone: ${standaloneCustomers?.length || 0}, Bookings: ${bookingRequests?.length || 0}`);

        data = [
          ...processedEvents.map(e => ({
            'Title': e.title,
            'Customer Name': e.user_surname || '',
            'Phone': e.user_number || '',
            'Date': new Date(e.start_date || e.created_at).toLocaleDateString(),
            'Amount': e.payment_amount || 0,
            'Status': e.payment_status || 'not_paid',
            'Source': 'Event'
          })),
          ...additionalPersons.map(c => ({
            'Title': c.title,
            'Customer Name': c.user_surname || '',
            'Phone': c.user_number || '',
            'Date': new Date(c.start_date || c.created_at).toLocaleDateString(),
            'Amount': c.payment_amount || 0,
            'Status': c.payment_status || 'not_paid',
            'Source': 'Additional Person'
          })),
          ...(standaloneCustomers || []).map(c => ({
            'Title': c.title,
            'Customer Name': c.user_surname || '',
            'Phone': c.user_number || '',
            'Date': new Date(c.start_date || c.created_at).toLocaleDateString(),
            'Amount': c.payment_amount || 0,
            'Status': c.payment_status || 'not_paid',
            'Source': 'Standalone Customer'
          })),
          ...(bookingRequests || []).map(b => ({
            'Title': b.title,
            'Customer Name': b.requester_name || '',
            'Phone': b.requester_phone || '',
            'Date': new Date(b.start_date || b.created_at).toLocaleDateString(),
            'Amount': b.payment_amount || 0,
            'Status': b.payment_status || 'not_paid',
            'Source': 'Booking Request'
          })),
          // Add total row
          {
            'Title': '--- TOTAL ---',
            'Customer Name': '',
            'Phone': '',
            'Date': '',
            'Amount': totalIncome,
            'Status': '',
            'Source': 'TOTAL INCOME'
          }
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
        // CRITICAL FIX: Replicate exact CRM page logic
        // CRM combines: customers (by created_at), events (by start_date), booking requests (by start_date)
        // Then deduplicates based on signatures and IDs
        
        // For "this month" (months === 1), use END OF MONTH not today
        // This matches CRM behavior which shows entire current month
        const endDate = new Date(today);
        if (months === 1) {
          // Set to last day of current month
          endDate.setMonth(endDate.getMonth() + 1);
          endDate.setDate(0); // Last day of previous month (which is current month)
          endDate.setHours(23, 59, 59, 999);
        } else {
          endDate.setHours(23, 59, 59, 999);
        }
        const startDateStr = startDate.toISOString();
        const endDateStr = endDate.toISOString();
        
        // 1. Get all customers (standalone + event-linked) by created_at
        const { data: allCustomers } = await supabase
          .from('customers')
          .select('id, title, user_surname, user_number, social_network_link, payment_amount, payment_status, event_notes, created_at, start_date, type')
          .eq('user_id', userId)
          .gte('created_at', startDateStr)
          .lte('created_at', endDateStr)
          .is('deleted_at', null);

        // 2. Get events (parent only) by start_date
        const { data: events } = await supabase
          .from('events')
          .select('id, booking_request_id, title, user_surname, user_number, social_network_link, payment_amount, payment_status, event_notes, created_at, start_date')
          .eq('user_id', userId)
          .gte('start_date', startDateStr)
          .lte('start_date', endDateStr)
          .is('deleted_at', null)
          .is('parent_event_id', null);

        // 3. Get approved booking requests by start_date
        const { data: bookingRequests } = await supabase
          .from('booking_requests')
          .select('id, title, requester_name, requester_phone, requester_email, payment_amount, payment_status, description, created_at, start_date')
          .eq('user_id', userId)
          .eq('status', 'approved')
          .gte('start_date', startDateStr)
          .lte('start_date', endDateStr)
          .is('deleted_at', null);

        // Helper: normalize payment status
        const normalizePaymentStatus = (status: string | undefined): string => {
          if (!status) return 'not_paid';
          if (status === 'partly') return 'partly_paid';
          if (status === 'fully') return 'fully_paid';
          return status;
        };

        // Combine all data sources (matching CRM exact logic with signature-based deduplication)
        const combined: any[] = [];
        const seenSignatures = new Set<string>();
        const customerIdSet = new Set((allCustomers || []).map(c => c.id));

        // Add customers with signature-based deduplication (matching CRM lines 254-266)
        for (const customer of (allCustomers || [])) {
          const signature = `${customer.title}:::${customer.start_date}:::${customer.user_number}`;
          if (!seenSignatures.has(signature)) {
            combined.push({
              ...customer,
              payment_status: normalizePaymentStatus(customer.payment_status)
            });
            seenSignatures.add(signature);
          }
        }

        // Add events that aren't duplicates (matching CRM lines 269-286)
        for (const event of (events || [])) {
          // Skip if event's booking_request_id matches a customer
          if (event.booking_request_id && customerIdSet.has(event.booking_request_id)) {
            continue;
          }
          
          const signature = `${event.title}:::${event.start_date}`;
          if (!seenSignatures.has(signature)) {
            combined.push({
              ...event,
              payment_status: normalizePaymentStatus(event.payment_status)
            });
            seenSignatures.add(signature);
          }
        }

        // Add booking requests (matching CRM lines 289-294)
        for (const booking of (bookingRequests || [])) {
          combined.push({
            id: booking.id,
            title: booking.title || booking.requester_name,
            user_surname: booking.requester_name,
            user_number: booking.requester_phone,
            social_network_link: booking.requester_email,
            payment_amount: booking.payment_amount,
            payment_status: normalizePaymentStatus(booking.payment_status),
            event_notes: booking.description,
            created_at: booking.created_at,
            start_date: booking.start_date,
            source: 'booking_request'
          });
        }

        // ID-based deduplication (matching CRM lines 297-313)
        const uniqueData = new Map();
        combined.forEach(item => {
          let key;
          if (item.source === 'booking_request') {
            key = `booking-${item.id}`;
          } else if (item.id?.toString().startsWith('event-')) {
            key = item.id;
          } else {
            key = `customer-${item.id}`;
          }
          
          // Keep the most recent version if duplicate found
          if (!uniqueData.has(key) || new Date(item.created_at || 0) > new Date(uniqueData.get(key).created_at || 0)) {
            uniqueData.set(key, item);
          }
        });

        // Convert to array and sort by created_at descending
        const finalData = Array.from(uniqueData.values()).sort((a, b) => {
          const dateA = new Date(a.created_at || 0).getTime();
          const dateB = new Date(b.created_at || 0).getTime();
          return dateB - dateA;
        });

        data = finalData.map(c => ({
          'Title': c.title,
          'Name': c.user_surname || '',
          'Phone': c.user_number || '',
          'Social Network': c.social_network_link || '',
          'Payment Amount': c.payment_amount || 0,
          'Payment Status': c.payment_status || 'not_paid',
          'Notes': c.event_notes || '',
          'Created': new Date(c.created_at).toLocaleDateString()
        }));

        console.log(`📊 Customer Excel: ${finalData.length} total records (customers: ${allCustomers?.length || 0}, events: ${events?.length || 0}, bookings: ${bookingRequests?.length || 0})`);
        
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
    const filePath = `${userId}/${filename}`;
    
    console.log(`📤 Uploading file to: ${filePath}`);
    
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('excel-reports')
      .upload(filePath, excelBuffer, {
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        upsert: true,
        cacheControl: '3600'
      });

    if (uploadError) {
      console.error('❌ Upload error:', uploadError);
      throw uploadError;
    }

    console.log(`✅ File uploaded successfully: ${filePath}`);

    // CRITICAL FIX: Wait 500ms for storage to sync and file to be fully available
    // This prevents "signature verification failed" errors on rapid consecutive requests
    await new Promise(resolve => setTimeout(resolve, 500));

    // Verify file exists before creating signed URL
    const { data: fileCheck, error: checkError } = await supabase.storage
      .from('excel-reports')
      .list(userId, {
        search: filename
      });

    if (checkError || !fileCheck || fileCheck.length === 0) {
      console.error('❌ File verification failed:', checkError);
      throw new Error('File upload verification failed - file not found in storage');
    }

    console.log(`✅ File verified in storage: ${filename}`);

    // Generate signed URL with 1-hour expiry using absolute path
    const { data: signed, error: signErr } = await supabase.storage
      .from('excel-reports')
      .createSignedUrl(filePath, 3600, { 
        download: filename
      });

    if (signErr || !signed?.signedUrl) {
      console.error('❌ Signed URL error:', signErr);
      throw new Error('Failed to generate signed download URL: ' + (signErr?.message || 'Unknown error'));
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
