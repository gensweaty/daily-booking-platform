import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.47.2';
import * as XLSX from "https://esm.sh/xlsx@0.18.5";
// unpdf for PDF text extraction (no native dependencies)
import { extractText as extractPdfText } from "https://esm.sh/unpdf@0.12.1";
// PizZip for DOCX text extraction (DOCX files are ZIP archives with XML)
import PizZip from "https://esm.sh/pizzip@3.1.7";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { channelId, prompt, ownerId, conversationHistory = [], userTimezone, currentLocalTime, tzOffsetMinutes, attachments = [], senderName, senderType } = await req.json();
    
    console.log('🤖 AI Chat request:', { 
      channelId, 
      ownerId, 
      senderName,
      senderType,
      promptLength: prompt?.length, 
      historyLength: conversationHistory.length, 
      userTimezone, 
      tzOffsetMinutes, 
      attachmentsCount: attachments.length 
    });

    // Timezone validation and formatting helpers
    function isValidTimeZone(tz?: string) {
      try {
        if (!tz) return false;
        new Intl.DateTimeFormat('en-US', { timeZone: tz });
        return true;
      } catch { return false; }
    }

    // Return either a valid IANA tz or null; keep offset as fallback
    const effectiveTZ = isValidTimeZone(userTimezone) ? userTimezone : null;

    function formatInUserZone(d: Date) {
      if (effectiveTZ) {
        return d.toLocaleString('en-US', {
          timeZone: effectiveTZ,
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          hour12: true
        });
      }
      // Fallback: shift by offset minutes, then print as UTC
      if (typeof tzOffsetMinutes === 'number') {
        const shifted = new Date(d.getTime() - tzOffsetMinutes * 60_000);
        return shifted.toLocaleString('en-US', {
          timeZone: 'UTC',
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          hour12: true
        });
      }
      // Last resort: UTC
      return d.toLocaleString('en-US', {
        timeZone: 'UTC',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });
    }

    // Client with user auth for reading data
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    // Admin client for inserting AI messages (bypasses RLS)
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // 1. Verify channel is AI channel
    const { data: channel, error: channelError } = await supabaseClient
      .from('chat_channels')
      .select('is_ai, owner_id')
      .eq('id', channelId)
      .single();

    if (channelError || !channel?.is_ai) {
      console.error('❌ Invalid AI channel:', channelError);
      return new Response(
        JSON.stringify({ error: 'Invalid AI channel' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ---- FAST-PATH FOR EXCEL EXPORTS (runs before LLM) ----
    const lower = (prompt || "").toLowerCase();
    const wantsExcel = /\b(excel|xlsx|spreadsheet|export)\b/.test(lower);

    if (wantsExcel) {
      console.log('📊 Excel fast-path triggered');
      
      // Infer report type from prompt (default: tasks)
      let reportType: "tasks" | "events" | "customers" | "payments" | "bookings" = "tasks";
      if (/\b(payment|revenue|income)\b/.test(lower)) reportType = "payments";
      else if (/\b(event|schedule|calendar|appointment)\b/.test(lower)) reportType = "events";
      else if (/\bcustomer|crm|client|contact\b/.test(lower)) reportType = "customers";
      else if (/\bbooking(s)?\b/.test(lower)) reportType = "bookings";

      // Infer window
      let months = 12;
      if (/\blast\s*6\s*months|\bhalf\s*year\b/i.test(prompt)) months = 6;
      if (/\b(last|past)\s*year\b/i.test(prompt)) months = 12;
      if (/\b(last\s*3\s*months|quarter)\b/i.test(prompt)) months = 3;

      console.log(`  → Report type: ${reportType}, months: ${months}`);

      const { data: excelData, error: excelError } = await supabaseAdmin.functions.invoke(
        "generate-excel-report",
        { body: { reportType, months, userId: ownerId } }
      );

      if (excelError) {
        console.error("❌ Excel generation error:", excelError);
        const msg = "Sorry, I couldn't generate the Excel file due to a server error.";
        await supabaseAdmin.from("chat_messages").insert({
          channel_id: channelId, owner_id: ownerId, sender_type: "admin",
          sender_name: "Smartbookly AI", content: msg, message_type: "text"
        });
        return new Response(JSON.stringify({ success: false, error: msg }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const content = excelData?.success
        ? `📥 Your **${reportType}** report is ready.\n\n[Download Excel](${excelData.downloadUrl})\n\nRecords: **${excelData.recordCount}**\n\n*Link expires in 1 hour*`
        : `ℹ️ No ${reportType} data found for the selected period.`;

      await supabaseAdmin.from("chat_messages").insert({
        channel_id: channelId, owner_id: ownerId, sender_type: "admin",
        sender_name: "Smartbookly AI", content, message_type: "text"
      });

      console.log(`✅ Excel fast-path completed: ${reportType}`);

      return new Response(JSON.stringify({ success: true, content }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    // ---- END FAST-PATH ----

    // ---- FILE ANALYSIS HELPERS ----
    async function analyzeAttachment(att: any) {
      try {
        const { data: fileBlob, error } = await supabaseAdmin.storage
          .from('chat_attachments')
          .download(att.file_path);
        
        if (error || !fileBlob) {
          console.error(`Failed to download ${att.filename}:`, error);
          return `[Could not analyze ${att.filename}]`;
        }

        const contentType = att.content_type || '';
        const filename = att.filename.toLowerCase();

        // Images - use vision with Gemini
        if (contentType.startsWith('image/') || /\.(png|jpe?g|gif|webp|bmp)$/i.test(filename)) {
          const arrayBuffer = await fileBlob.arrayBuffer();
          const bytes = new Uint8Array(arrayBuffer);
          
          // Convert to base64 in chunks to avoid stack overflow
          let binary = '';
          const chunkSize = 8192;
          for (let i = 0; i < bytes.length; i += chunkSize) {
            const chunk = bytes.subarray(i, i + chunkSize);
            binary += String.fromCharCode.apply(null, Array.from(chunk));
          }
          const base64 = btoa(binary);
          
          console.log(`🖼️ Processed image: ${att.filename} (${Math.round(bytes.length / 1024)}KB)`);
          
          return {
            type: 'image',
            data: `data:${contentType};base64,${base64}`,
            filename: att.filename
          };
        }

        // Text files - read content directly
        if (contentType.startsWith('text/') || /\.(txt|md|log|json|xml|yaml|yml)$/i.test(filename)) {
          const text = await fileBlob.text();
          const preview = text.substring(0, 15000);
          console.log(`📄 Processed text file: ${att.filename} (${text.length} chars)`);
          return `📄 **${att.filename}**\n\`\`\`\n${preview}${text.length > 15000 ? '\n...(truncated, showing first 15000 characters)' : ''}\n\`\`\``;
        }

        // PDF — extract text with unpdf (no native dependencies)
        if (contentType === "application/pdf" || filename.endsWith(".pdf")) {
          try {
            const arrayBuffer = await fileBlob.arrayBuffer();
            const result = await extractPdfText(arrayBuffer, { mergePages: true });
            
            const text = result.text || '';
            const pages = result.totalPages || 0;
            const preview = text.slice(0, 15000);
            const more = text.length > 15000 ? "\n...(truncated, showing first 15000 characters)" : "";

            console.log(`📄 Parsed PDF: ${att.filename} (${pages} pages, ${text.length} chars)`);
            return `📄 **PDF: ${att.filename}**\n**Pages:** ${pages}\n**Content:**\n\`\`\`\n${preview}${more}\n\`\`\``;
          } catch (e) {
            console.error("PDF parse error:", e);
            const sizeKB = Math.round((att.size || 0) / 1024);
            return `📄 **PDF: ${att.filename}** (${sizeKB}KB)\nI couldn't extract text from this PDF. It may be scanned images or encrypted.\n• If it's scanned, OCR isn't available here — export the pages as images or upload a text-based copy.\n• If you think it should be text-based, try re-saving the PDF with "Save as PDF" and re-upload.`;
          }
        }

        // CSV files
        if (filename.endsWith('.csv') || contentType === 'text/csv') {
          try {
            const text = await fileBlob.text();
            const lines = text.split('\n').filter(l => l.trim());
            const preview = lines.slice(0, 50).join('\n');
            console.log(`📊 Processed CSV: ${att.filename} (${lines.length} rows)`);
            return `📊 **CSV: ${att.filename}**\n**Rows:** ${lines.length}\n**Preview:**\n\`\`\`csv\n${preview}${lines.length > 50 ? '\n...(showing first 50 rows)' : ''}\n\`\`\``;
          } catch (e) {
            console.error(`CSV parse error for ${att.filename}:`, e);
            return `📊 **CSV: ${att.filename}** - Unable to parse CSV file`;
          }
        }

        // Excel files (.xlsx, .xls)
        if (contentType.includes('spreadsheet') || /\.(xlsx?|xlsm)$/i.test(filename)) {
          try {
            const arrayBuffer = await fileBlob.arrayBuffer();
            const workbook = XLSX.read(arrayBuffer, { type: 'buffer' });
            
            let content = `📊 **Excel: ${att.filename}**\n**Sheets:** ${workbook.SheetNames.join(', ')}\n\n`;
            
            // Process first 3 sheets
            for (let i = 0; i < Math.min(3, workbook.SheetNames.length); i++) {
              const sheetName = workbook.SheetNames[i];
              const sheet = workbook.Sheets[sheetName];
              const csv = XLSX.utils.sheet_to_csv(sheet);
              const lines = csv.split('\n').filter(l => l.trim()).slice(0, 30);
              
              content += `**Sheet: ${sheetName}**\n\`\`\`csv\n${lines.join('\n')}${csv.split('\n').length > 30 ? '\n...(showing first 30 rows)' : ''}\n\`\`\`\n\n`;
            }
            
            if (workbook.SheetNames.length > 3) {
              content += `...(${workbook.SheetNames.length - 3} more sheets not shown)\n`;
            }
            
            console.log(`📊 Processed Excel: ${att.filename} (${workbook.SheetNames.length} sheets)`);
            return content;
          } catch (xlsError) {
            console.error(`Excel parse error for ${att.filename}:`, xlsError);
            return `📊 **Excel: ${att.filename}** - Unable to parse Excel file`;
          }
        }

        // Word documents (.docx) — extract text using PizZip (DOCX = ZIP with XML)
        if (contentType.includes("word") || /\.docx$/i.test(filename)) {
          try {
            const arrayBuffer = await fileBlob.arrayBuffer();
            const zip = new PizZip(arrayBuffer);
            
            // Extract the main document XML
            const documentXml = zip.file("word/document.xml")?.asText();
            
            if (!documentXml) {
              throw new Error("Could not find document.xml in DOCX file");
            }
            
            // Parse XML and extract text from <w:t> elements
            // Simple regex approach since we don't need DOM parsing
            const textMatches = documentXml.match(/<w:t[^>]*>([^<]*)<\/w:t>/g) || [];
            const text = textMatches
              .map(match => {
                const content = match.replace(/<w:t[^>]*>/, '').replace(/<\/w:t>/, '');
                return content;
              })
              .join(' ')
              .replace(/\s+/g, ' ')
              .trim();
            
            const preview = text.slice(0, 15000);
            const more = text.length > 15000 ? "\n...(truncated, showing first 15000 characters)" : "";
            
            console.log(`📝 Parsed DOCX: ${att.filename} (${text.length} chars)`);
            return `📝 **Word: ${att.filename}**\n**Content:**\n\`\`\`\n${preview}${more}\n\`\`\``;
          } catch (e) {
            console.error("DOCX parse error:", e);
            const sizeKB = Math.round((att.size || 0) / 1024);
            return `📝 **Word: ${att.filename}** (${sizeKB}KB)\nI couldn't extract text from this DOCX file. It may be corrupted or password-protected.\n• Try re-saving the file as a new DOCX\n• Convert to PDF and re-upload\n• Copy-paste the text content directly`;
          }
        }

        // Legacy .doc files — not supported for parsing
        if (/\.doc$/i.test(filename) && !/\.docx$/i.test(filename)) {
          return `📝 **Word (.doc)** is not supported for text extraction. Please convert to DOCX or PDF.`;
        }

        // PowerPoint (.pptx)
        if (contentType.includes('presentation') || /\.pptx?$/i.test(filename)) {
          console.log(`📊 PowerPoint detected: ${att.filename}`);
          return `📊 **PowerPoint: ${att.filename}**\nSize: ${Math.round((att.size || 0) / 1024)}KB\n\n⚠️ PowerPoint text extraction is not fully supported. Please describe the content or copy-paste key text.`;
        }

        // Fallback
        return `📎 File: ${att.filename} (${contentType})\nSize: ${Math.round((att.size || 0) / 1024)}KB`;

      } catch (error) {
        console.error(`Error analyzing ${att.filename}:`, error);
        return `[Error analyzing ${att.filename}]`;
      }
    }
    // ---- END FILE ANALYSIS ----

    // ---- TASK HELPERS (resilient to schema drift) ----
    const STATUS_ALIASES: Record<string,string> = {
      inprogress: "in_progress",
      "in-progress": "in_progress",
      todo: "todo",
      done: "done"
    };
    const normStatus = (s?: string) => (s ? (STATUS_ALIASES[s] || s) : undefined);

    function unifyStatus(s?: string) {
      if (!s) return "unknown";
      return STATUS_ALIASES[s] || s;
    }

    async function fetchTasksFlexible(client: ReturnType<typeof createClient>, ownerId: string, filters: {
      status?: string, created_after?: string, created_before?: string
    }) {
      const combos = [
        { ownerCol: "user_id",   archivedCol: "archived_at" },
        { ownerCol: "owner_id",  archivedCol: "archived_at" },
        { ownerCol: "board_owner_id", archivedCol: "archived_at" },
        { ownerCol: "user_id",   archivedCol: null },
        { ownerCol: "owner_id",  archivedCol: null },
        { ownerCol: "board_owner_id", archivedCol: null },
      ];
      const out = { tasks: [] as any[], meta: {} as any };

      for (const c of combos) {
        try {
          let q = client.from("tasks").select("*").eq(c.ownerCol as any, ownerId);

          if (c.archivedCol) q = q.is(c.archivedCol as any, null);
          if (filters.created_after)  q = q.gte("created_at", filters.created_after);
          if (filters.created_before) q = q.lte("created_at", filters.created_before);
          if (filters.status)         q = q.eq("status", normStatus(filters.status)!);

          q = q.order("created_at", { ascending: false });

          const { data, error } = await q;
          if (error) {
            // Column missing? try next combo
            if (/column .* does not exist/i.test(error.message)) continue;
            // Other errors: return immediately with empty data + error
            return { ...out, error: error.message, meta: { tried: c } };
          }
          if (Array.isArray(data)) {
            out.tasks = data;
            out.meta = { used: c, filters };
            return out;
          }
        } catch {
          // Try next combo
          continue;
        }
      }
      return out; // nothing matched → empty
    }

    // 2. Build comprehensive read-only tool functions
    const tools = [
      {
        type: "function",
        function: {
          name: "get_current_datetime",
          description: `Get the EXACT current date and time from user's device. This returns the actual current time in ISO format. For relative time calculations (e.g., 'in 2 minutes', 'in 1 hour'), parse this timestamp and add the duration.`,
          parameters: { type: "object", properties: {} }
        }
      },
      {
        type: "function",
        function: {
          name: "get_todays_schedule",
          description: "CRITICAL: Get today's calendar events and appointments. Use this IMMEDIATELY when user asks about today's schedule, what's on calendar today, or any variation asking about today's events. Do not try to answer without calling this function first.",
          parameters: { type: "object", properties: {} }
        }
      },
      {
        type: "function",
        function: {
          name: "get_upcoming_events",
          description: "Get upcoming events for the next N days",
          parameters: {
            type: "object",
            properties: {
              days: { type: "number", description: "Number of days ahead (default 7)", default: 7 }
            }
          }
        }
      },
      {
        type: "function",
        function: {
          name: "get_schedule",
          description: "Get calendar events for a specific date range",
          parameters: {
            type: "object",
            properties: {
              from: { type: "string", description: "Start date (YYYY-MM-DD)" },
              to: { type: "string", description: "End date (YYYY-MM-DD)" }
            },
            required: ["from", "to"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "get_pending_bookings",
          description: "Get pending booking requests that need approval",
          parameters: { type: "object", properties: {} }
        }
      },
      {
        type: "function",
        function: {
          name: "get_all_tasks",
          description: `**MANDATORY - CALL THIS FIRST FOR ANY TASK QUESTION**

          Use this IMMEDIATELY when user mentions:
          - "tasks", "task data", "my tasks", "show tasks"
          - "task report", "task excel", "task statistics"  
          - "last year tasks", "tasks for [period]"
          - ANY question about tasks
          
          **CRITICAL**: NEVER say "no task data" without calling this tool first!
          
          Retrieves ALL tasks with optional filters:
          - Status filter (todo/inprogress/done)
          - Date range filter (created_after, created_before)
          - Returns complete task details
          
          If this returns empty array, THEN you can say no data for that period.`,
          parameters: {
            type: "object",
            properties: {
              status: { 
                type: "string", 
                enum: ["todo", "in_progress", "done"], 
                description: "Filter by status (optional)" 
              },
              created_after: {
                type: "string",
                description: "ISO date (YYYY-MM-DD) - only tasks created after this date"
              },
              created_before: {
                type: "string", 
                description: "ISO date (YYYY-MM-DD) - only tasks created before this date"
              }
            }
          }
        }
      },
      {
        type: "function",
        function: {
          name: "get_task_statistics",
          description: "Get task completion statistics and progress",
          parameters: { type: "object", properties: {} }
        }
      },
      {
        type: "function",
        function: {
          name: "get_all_events",
          description: `**MANDATORY - CALL THIS FIRST FOR ANY CALENDAR/EVENTS QUESTION**

          Use this IMMEDIATELY when user mentions:
          - "calendar", "events", "bookings", "appointments"
          - "payment history", "revenue", "income"
          - "last year events", "events for [period]"
          - ANY question about calendar data
          
          **CRITICAL**: NEVER say "no event data" without calling this tool first!
          
          Retrieves ALL calendar events with optional filters:
          - Date range filter (start_date, end_date)
          - Returns event details, payment info, customer data
          
          If this returns empty array, THEN you can say no data for that period.`,
          parameters: {
            type: "object",
            properties: {
              start_date: {
                type: "string",
                description: "ISO date (YYYY-MM-DD) - only events starting after this date"
              },
              end_date: {
                type: "string",
                description: "ISO date (YYYY-MM-DD) - only events ending before this date"
              }
            }
          }
        }
      },
      {
        type: "function",
        function: {
          name: "get_all_customers",
          description: `**MANDATORY - CALL THIS FIRST FOR ANY CRM/CUSTOMER QUESTION**

          Use this IMMEDIATELY when user mentions:
          - "customers", "CRM", "contacts", "clients"
          - "customer data", "customer list"
          - "last year customers", "customers for [period]"
          - ANY question about CRM data
          
          **CRITICAL**: NEVER say "no customer data" without calling this tool first!
          
          Retrieves ALL customers with optional filters:
          - Date range filter (created_after, created_before)
          - Returns customer details, payment info, notes
          
          If this returns empty array, THEN you can say no data for that period.`,
          parameters: {
            type: "object",
            properties: {
              created_after: {
                type: "string",
                description: "ISO date (YYYY-MM-DD) - only customers created after this date"
              },
              created_before: {
                type: "string",
                description: "ISO date (YYYY-MM-DD) - only customers created before this date"
              }
            }
          }
        }
      },
      {
        type: "function",
        function: {
          name: "find_customer",
          description: "Search CRM for customers by name, phone, or email",
          parameters: {
            type: "object",
            properties: {
              query: { type: "string", description: "Search query" }
            },
            required: ["query"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "get_recent_customers",
          description: "Get recently added customers from CRM",
          parameters: {
            type: "object",
            properties: {
              limit: { type: "number", description: "Number to return (default 10)", default: 10 }
            }
          }
        }
      },
      {
        type: "function",
        function: {
          name: "get_payment_summary",
          description: "Get summary of payment statuses and amounts",
          parameters: { type: "object", properties: {} }
        }
      },
      {
        type: "function",
        function: {
          name: "get_business_stats",
          description: "Get business statistics: total bookings, revenue, customer count",
          parameters: { type: "object", properties: {} }
        }
      },
      {
        type: "function",
        function: {
          name: "analyze_payment_history",
          description: "Analyze payment history and revenue over a specified time period. Use this when user asks to analyze payments, revenue, or financial data over time (e.g., '1 year', '6 months', 'last quarter'). Returns detailed breakdown by month with revenue, payment status counts, and trends.",
          parameters: {
            type: "object",
            properties: {
              months: { 
                type: "number", 
                description: "Number of months to analyze backwards from now (e.g., 12 for 1 year, 6 for half year)", 
                default: 12 
              }
            }
          }
        }
      },
      {
        type: "function",
        function: {
          name: "generate_excel_report",
          description: `**MANDATORY - CALL THIS DIRECTLY FOR EXCEL REQUESTS**

          Use this IMMEDIATELY when user asks for:
          - "generate excel", "create excel", "excel report"
          - "export to excel", "download excel spreadsheet"
          - "excel about tasks/events/customers/payments/bookings"
          
          **CRITICAL**: DO NOT pre-check if data exists! Call this tool directly - it will check and return appropriate response.
          
          Available report types:
          - "tasks": Task list with status, priority, deadlines
          - "events": Calendar events with dates and payments
          - "customers": CRM contacts with payment info
          - "payments": Payment history from events and customers
          - "bookings": Booking requests with status
          
          The tool will:
          1. Query data for the specified period (months parameter)
          2. Generate Excel file if data exists
          3. Return download link OR error if no data
          
          If user mentions "last year", "last X months", "past year":
          - Use months: 12 for "last year" or "past year"
          - Use months: 6 for "last 6 months"
          - Use months: 3 for "last quarter"`,
          parameters: {
            type: "object",
            properties: {
              report_type: {
                type: "string",
                enum: ["payments", "events", "tasks", "customers", "bookings"],
                description: "Type of data to export"
              },
              months: {
                type: "number",
                description: "Number of months of historical data (default: 12). Use 12 for 'last year', 6 for 'half year', 3 for 'quarter'",
                default: 12
              }
            },
            required: ["report_type"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "get_weekly_summary",
          description: "Get a comprehensive weekly summary: events, tasks, bookings, payments",
          parameters: { type: "object", properties: {} }
        }
      },
      {
        type: "function",
        function: {
          name: "get_free_time_slots",
          description: "Find free time slots in the calendar for a specific date",
          parameters: {
            type: "object",
            properties: {
              date: { type: "string", description: "Date to check (YYYY-MM-DD)" }
            },
            required: ["date"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "summarize_channel",
          description: "Get and summarize recent messages from a chat channel",
          parameters: {
            type: "object",
            properties: {
              channelId: { type: "string", description: "Channel ID" },
              limit: { type: "number", description: "Number of messages (default 50)", default: 50 }
            },
            required: ["channelId"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "create_custom_reminder",
          description: "Creates a reminder with BOTH dashboard and email notifications. Use offset_minutes for relative times (e.g., 'in 2 minutes').",
          parameters: {
            type: "object",
            properties: {
              title: { type: "string", description: "Reminder title" },
              message: { type: "string", description: "Optional reminder message" },
              offset_minutes: { type: "number", description: "Minutes from now (browser time)", minimum: 1 },
              absolute_local: { type: "string", description: "YYYY-MM-DDTHH:mm in user's local timezone (e.g., '2025-10-12T16:45')" }
            },
            required: ["title"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "create_or_update_event",
          description: `Create or update calendar events/appointments/bookings.
          
MANDATORY fields:
- full_name: Customer/client full name
- start_date: Event start date/time (ISO format YYYY-MM-DDTHH:mm or user timezone)
- end_date: Event end date/time (ISO format YYYY-MM-DDTHH:mm or user timezone)

OPTIONAL fields (if user provides):
- phone_number: Contact phone
- social_media: Email or social network link  
- notes: Event notes or description
- payment_status: 'not_paid', 'partly_paid', or 'fully_paid'
- payment_amount: Payment amount (number)
- event_name: Type of event (birthday, meeting, etc)

For EDIT: Include event_id to update existing event`,
          parameters: {
            type: "object",
            properties: {
              event_id: { type: "string", description: "Event ID for editing (optional)" },
              full_name: { type: "string", description: "Customer full name (REQUIRED)" },
              start_date: { type: "string", description: "Event start (ISO format YYYY-MM-DDTHH:mm)" },
              end_date: { type: "string", description: "Event end (ISO format YYYY-MM-DDTHH:mm)" },
              phone_number: { type: "string" },
              social_media: { type: "string", description: "Email or social link" },
              notes: { type: "string" },
              payment_status: { type: "string", enum: ["not_paid", "partly_paid", "fully_paid"] },
              payment_amount: { type: "number" },
              event_name: { type: "string" }
            },
            required: ["full_name", "start_date", "end_date"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "create_or_update_task",
          description: `Create or update tasks.
          
MANDATORY fields:
- task_name: Task title/name

OPTIONAL fields (if user provides):
- description: Task description/notes
- status: 'todo', 'in_progress', or 'done'
- deadline: Task deadline (ISO format YYYY-MM-DDTHH:mm)
- reminder: Reminder time (ISO format YYYY-MM-DDTHH:mm)
- email_reminder: Enable email reminder (boolean)

For EDIT: Include task_id to update existing task`,
          parameters: {
            type: "object",
            properties: {
              task_id: { type: "string", description: "Task ID for editing (optional)" },
              task_name: { type: "string", description: "Task title (REQUIRED)" },
              description: { type: "string" },
              status: { type: "string", enum: ["todo", "in_progress", "done"] },
              deadline: { type: "string", description: "Deadline ISO timestamp" },
              reminder: { type: "string", description: "Reminder ISO timestamp" },
              email_reminder: { type: "boolean" }
            },
            required: ["task_name"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "create_or_update_customer",
          description: `Create or update customers/clients in CRM.
          
MANDATORY fields:
- full_name: Customer full name

OPTIONAL fields (if user provides):
- phone_number: Contact phone
- social_media: Email or social network link
- notes: Customer notes
- payment_status: 'not_paid', 'partly_paid', or 'fully_paid'
- payment_amount: Payment amount (number)
- create_event: Create linked event (boolean)
- event_start: Event start date if create_event is true
- event_end: Event end date if create_event is true

For EDIT: Include customer_id to update existing customer`,
          parameters: {
            type: "object",
            properties: {
              customer_id: { type: "string", description: "Customer ID for editing (optional)" },
              full_name: { type: "string", description: "Customer full name (REQUIRED)" },
              phone_number: { type: "string" },
              social_media: { type: "string", description: "Email or social link" },
              notes: { type: "string" },
              payment_status: { type: "string", enum: ["not_paid", "partly_paid", "fully_paid"] },
              payment_amount: { type: "number" },
              create_event: { type: "boolean", description: "Also create calendar event" },
              event_start: { type: "string", description: "Event start if create_event=true" },
              event_end: { type: "string", description: "Event end if create_event=true" }
            },
            required: ["full_name"]
          }
        }
      }
    ];

    // 3. Call Lovable AI with tools
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      console.error('❌ LOVABLE_API_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'AI service not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Get current date for context
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const dayOfWeek = now.toLocaleDateString('en-US', { weekday: 'long' });
    const tomorrow = new Date(now.getTime() + 86400000).toISOString().split('T')[0];

    // Detect user language from the LATEST user message (most recent prompt)
    const detectLanguage = (text: string): string => {
      // Check for Cyrillic characters (Russian, etc.)
      if (/[\u0400-\u04FF]/.test(text)) return 'ru';
      // Check for Georgian characters
      if (/[\u10A0-\u10FF]/.test(text)) return 'ka';
      // Check for Spanish specific characters/words
      if (/[áéíóúñ¿¡]/i.test(text) || /\b(el|la|los|las|un|una|de|del|en|que|es|por)\b/i.test(text)) return 'es';
      return 'en'; // Default to English
    };

    // Always detect from the current prompt (latest message) to allow language switching
    const userLanguage = detectLanguage(prompt);
    
    console.log('🌐 Detected user language from current message:', userLanguage);

    const systemPrompt = `You are Smartbookly AI, an intelligent business assistant with deep integration into the user's business management platform.

**🌐 LANGUAGE INSTRUCTION (TOP PRIORITY)**:
DETECTED LANGUAGE: ${userLanguage === 'ru' ? '🇷🇺 RUSSIAN' : userLanguage === 'ka' ? '🇬🇪 GEORGIAN' : userLanguage === 'es' ? '🇪🇸 SPANISH' : '🇬🇧 ENGLISH'}

STRICT RULE: Respond in ${userLanguage === 'ru' ? 'Russian (Русский)' : userLanguage === 'ka' ? 'Georgian (ქართული)' : userLanguage === 'es' ? 'Spanish (Español)' : 'English'} ONLY.
- Current message language: ${userLanguage}
- ALL text must be in this language: responses, labels, errors, everything
- User can switch languages - always match their current message
- NEVER mix languages within one response

**USER TIMEZONE**: ${effectiveTZ || 'UTC (offset-based)'}
**CURRENT DATE CONTEXT**: Today is ${dayOfWeek}, ${today}. Tomorrow is ${tomorrow}.

**🤖 AI AGENT CAPABILITIES - YOU CAN NOW CREATE AND EDIT DATA!**

**WRITE CAPABILITIES** (NEW - You are now an active agent!):

1. **📅 CREATE/EDIT CALENDAR EVENTS**
   - Tool: create_or_update_event
   - MINIMUM required: Full name + start date + end date
   - Optional: phone, email/social, notes, payment details, event type
   - Example: "Add event for John Smith tomorrow at 2pm to 4pm" → CREATE IMMEDIATELY
   - Example: "Update John's event to 3pm" → First use get_upcoming_events or get_todays_schedule to find the event ID, then UPDATE with event_id

2. **✅ CREATE/EDIT TASKS**
   - Tool: create_or_update_task
   - MINIMUM required: Task name
   - Optional: description, status, deadline, reminder, email reminder
   - Example: "Create task to call vendor" → CREATE IMMEDIATELY
   - Example: "Mark task as done" → First use get_all_tasks to find the task ID, then UPDATE with task_id and status='done'

3. **👥 CREATE/EDIT CUSTOMERS (CRM)**
   - Tool: create_or_update_customer
   - MINIMUM required: Full name
   - Optional: phone, email/social, notes, payment details
   - Can optionally create linked event
   - Example: "Add customer Mike Jones, phone 555-1234" → CREATE IMMEDIATELY
   - Example: "Update customer payment status to paid" → First use search tools to find customer ID, then UPDATE with customer_id

4. **📎 FILE UPLOADS** (NEW!)
   - You CAN process file attachments sent with messages
   - When user attaches files (images, PDFs, documents), they are automatically uploaded to storage
   - Files are linked to events automatically when creating/updating events
   - Confirm to user: "✅ File '[filename]' has been attached to the event"

**CRITICAL AGENT WORKFLOW RULES**:

**FOR EVENT CREATION:**
- User says "Add event for Sarah at 3pm tomorrow" → YOU HAVE ALL INFO → create_or_update_event immediately
- If missing critical info (name or dates) → ask: "I need the full name and date/time to create the event"
- If user provides payment info → include it in the tool call
- NEVER ask for optional fields unless user wants to add them
- ⚠️ **TIME CONFLICT CHECKING**: Before creating, system automatically checks if time slot is busy
  - If conflict found: Inform user "That time slot is already booked with [existing event]. Would you like a different time?"
  - If no conflict: Create the event

**FOR TASK CREATION:**
- User says "Create task to buy supplies" → YOU HAVE ALL INFO → create_or_update_task immediately
- If they want deadline/reminder → they'll specify it, otherwise create without
- NEVER over-ask for optional fields

**FOR CUSTOMER CREATION:**
- User says "Add customer Lisa Brown" → YOU HAVE ALL INFO → create_or_update_customer immediately
- If they want to create event too → ask for event dates
- Payment details are OPTIONAL - only include if provided

**FOR EDITING/UPDATING:**
- **CRITICAL**: ALWAYS search for the item FIRST before updating
- Steps: 1) Call get_all_tasks / get_upcoming_events / search tools, 2) Find the item ID, 3) Call create_or_update_* with the ID
- Example: "Update John's event" → Call get_upcoming_events → Find event with John → Call create_or_update_event with event_id
- NEVER try to update without the ID - you MUST find it first

**IMPORTANT PRINCIPLES:**
1. **ACT IMMEDIATELY** when you have minimum required info (name for customers/tasks, name+dates for events)
2. **DON'T OVER-ASK** - only ask for info that's truly critical or explicitly requested
3. **CONFIRM SUCCESS** - After successful creation, confirm what was created with details and any attached files
4. **HANDLE ERRORS GRACEFULLY** - If creation fails (time conflict, missing data), explain clearly and suggest fixes
5. **MAINTAIN CONTEXT** - Remember what was just created to handle follow-up questions
6. **SEARCH BEFORE UPDATE** - Always fetch existing data before attempting updates

**REMINDERS - SERVER-SIDE TIME MATH**:
For relative times ("in 10 minutes"): use offset_minutes
For absolute times ("today at 3pm"): use absolute_local (YYYY-MM-DDTHH:mm)
Server calculates UTC and confirms immediately (no second response needed).

Use display_time from tool (never UTC). No "if" statements, just confirm success.

**EXCEL REPORTS**:
For excel: call generate_excel_report, provide markdown download link.

**TIME CALCULATION EXAMPLES**:
- User says "remind me in 5 minutes" at 16:43 UTC → remind_at = 16:48 UTC
- User says "remind me in 1 hour" at 14:30 UTC → remind_at = 15:30 UTC
- NEVER schedule in the past! Always add time to current, never subtract.

**DATA ACCESS** - You have real-time read access to:
📅 **Calendar**: All events, bookings, schedules, availability
✅ **Tasks**: Task boards, status, assignments, progress, deadlines  
👥 **CRM**: Complete customer database with contact info, notes, payment history
📋 **Booking Requests**: Pending approvals, booking statistics
📊 **Business Analytics**: Revenue, trends, monthly statistics, historical payment data

**CRITICAL RULES - YOU MUST FOLLOW THESE**:
1. **BE PROACTIVE - DO THE WORK YOURSELF**: 
   - When user asks to "analyze", "show me", "tell me about" data → IMMEDIATELY call the appropriate tool and provide the analysis
   - NEVER tell users to go to another page or do it manually
   - Example: User says "analyze 1 year payment data" → Call analyze_payment_history with months=12, then provide detailed analysis
   - You are an ASSISTANT - your job is to fetch data, analyze it, and present insights, not to direct users elsewhere

2. **ALWAYS PROVIDE DETAILED DATA-DRIVEN RESPONSES**: 
   - When user asks about their data (tasks, bookings, customers, income, statistics) → ALWAYS call the relevant data fetching tools
   - NEVER give generic responses without actual data - users expect REAL numbers and insights from their business
   - If user asks "how many customers", "what's my revenue", "show tasks" → Call the tools and give specific numbers
   - Example: Instead of saying "You can check your statistics page", say "Let me analyze your data..." then call analyze_payment_history or get_all_tasks
   - ALWAYS provide actionable insights: "You have X tasks due this week", "Your revenue is Y this month (up Z% from last month)"

3. **TOOL USAGE - WHEN TO CALL WHAT**:
   - User asks about **tasks** → Call get_all_tasks and present the results with counts, statuses, assignments
   - User asks about **task data**, **my tasks**, **show tasks** → IMMEDIATELY call get_all_tasks, NEVER say there's no data without checking first
   - User asks about **payments**, **revenue**, **income**, **financial history** → Call analyze_payment_history and provide detailed breakdown
   - User asks for **excel report**, **export to excel**, **download spreadsheet** → Call generate_excel_report with appropriate report_type
   - User asks **what's on my schedule**, **today's calendar** → Call get_todays_schedule
   - User asks about **upcoming**, **this week** → Call get_upcoming_events
   - User asks about **bookings** → Call get_booking_requests
   - User asks about **customers**, **CRM data** → Call appropriate tools to get customer information
   - NEVER respond about data without calling the actual data fetching tool first
   - NEVER direct users to do manual exports - you have the generate_excel_report tool to create files directly

4. **RESPONSE QUALITY**:
   - Provide SPECIFIC numbers from actual data: "You have 15 tasks (3 todo, 8 in-progress, 4 done)"
   - Include trends and comparisons: "Revenue is $5,234 this month (up 12% from last month)"  
   - Give actionable recommendations: "You have 2 overdue tasks - shall I show them?"
   - Format data clearly with emojis and bullet points for readability
   - Keep responses detailed but organized - users want comprehensive information

5. **Connect the dots**: Find patterns across calendar, tasks, and CRM data

6. **Natural language dates**: Understand "tomorrow", "next Monday", "in 2 weeks" - calculate the exact date from today (${today})

7. **Memory**: Reference previous messages - if user asks followup questions, maintain context

8. **Be conversational**: Don't be robotic, use emojis, be helpful and friendly

**DETAILED PAGE GUIDES** - When user asks about a specific page:

📅 **CALENDAR PAGE GUIDE**:
═══════════════════════════════
**Overview**: Your central hub for managing all events, appointments, and bookings

**Main Features**:
• 📆 **View Modes**: Switch between Day, Week, Month views using tabs at top
• ➕ **Add Events**: Click the "+" button or any time slot to create new event
• 🎨 **Event Types**: Color-coded events (appointments, bookings, personal events)
• 🔔 **Reminders**: Set email reminders for each event
• 💰 **Payment Tracking**: Track payment status and amounts per event

**How to Use**:
1. **Creating Events**: Click any time slot → Fill in customer details → Set time → Add payment info → Save
2. **Editing Events**: Click existing event → Edit details → Save (option to edit single or all recurring)
3. **Recurring Events**: When creating event, enable "Repeat" → Choose pattern (daily/weekly/monthly)
4. **Drag & Drop**: Simply drag events to reschedule them to different times
5. **Customer Groups**: Add multiple attendees to single event for group bookings
6. **Payment Status**: Mark as Paid/Not Paid/Partially Paid with amount tracking

**Pro Tips**:
⭐ Use color coding to quickly identify event types
⭐ Set reminders 1 hour or 1 day before important appointments
⭐ Check Day view for detailed hourly schedule
⭐ Use Month view to see availability at a glance

---

👥 **CRM PAGE GUIDE**:
═══════════════════════════════
**Overview**: Complete customer relationship management system

**Main Features**:
• 📇 **Customer Database**: All customer contacts in one place
• 🔍 **Smart Search**: Find customers by name, phone, or notes
• 📎 **File Attachments**: Upload documents, photos per customer
• 💵 **Payment History**: Track all payments and outstanding amounts
• 📝 **Notes**: Add unlimited notes and details per customer

**How to Use**:
1. **Adding Customers**: Click "Add Customer" → Fill name, phone, social media → Add notes → Save
2. **Editing Info**: Click any customer card → Update details → Attach files if needed
3. **Payment Tracking**: Record payment status, amounts, and payment dates
4. **Searching**: Use search bar at top - searches across names, phone numbers, and notes
5. **Organizing**: Add detailed notes about preferences, history, special requests

**Customer Card Shows**:
• Name & Contact Info (phone, social media)
• Payment Status with visual indicators (Paid ✅ / Not Paid ❌ / Partial ⚠️)
• Event Dates if linked to calendar event
• Quick Actions: Edit, Delete, View History

**Pro Tips**:
⭐ Add social media links for easy contact
⭐ Use notes to remember customer preferences
⭐ Attach signed contracts or ID documents
⭐ Tag payment amounts to track total revenue per customer

---

✅ **TASKS PAGE GUIDE**:
═══════════════════════════════
**Overview**: Kanban-style task management board for team collaboration

**Board Columns**:
📋 **Todo** → 🔄 **In Progress** → ✅ **Done**

**Main Features**:
• 🎯 **Drag & Drop**: Move tasks between columns by dragging cards
• 👥 **Team Assignment**: Assign tasks to team members (yourself or sub-users)
• 📅 **Due Dates**: Set deadlines with optional time
• 🏷️ **Priority Levels**: Mark as High, Medium, or Low priority
• 📎 **Attachments**: Add files, images, documents to any task
• 💬 **Comments**: Team discussion thread on each task
• 🎨 **Rich Descriptions**: Formatted text, checklists in task descriptions

**How to Use**:
1. **Creating Tasks**: Click "Add Task" in any column → Fill title & description → Set priority → Assign team member → Set due date → Save
2. **Moving Tasks**: Simply drag task card to different column as work progresses
3. **Task Details**: Click any task card to see full view with description, comments, files
4. **Collaboration**: Team members can add comments, upload files, update status
5. **Filtering**: Use filter button to view by priority, assignee, or due date

**Task Card Shows**:
• Title & Priority indicator (color-coded)
• Assigned team member avatar
• Due date (highlighted if overdue)
• Comment count & attachment icons
• Description preview

**Pro Tips**:
⭐ Break large projects into smaller tasks
⭐ Set realistic due dates to track progress
⭐ Use High priority for urgent items
⭐ Check "Done" column at end of week to review accomplishments
⭐ Archive old tasks to keep board clean

---

🏢 **BUSINESS PAGE GUIDE**:
═══════════════════════════════
**Overview**: Your public-facing booking page that customers can access

**Main Features**:
• 🌐 **Custom URL**: Your unique shareable link (yourbusiness.smartbookly.com)
• 🖼️ **Cover Photo**: Add professional banner image
• 📝 **Business Info**: Company name, description, contact details
• 📅 **Public Calendar**: Customers see your availability
• 📋 **Booking Requests**: Customers submit booking requests for your approval

**How to Setup**:
1. **Profile Setup**: Go to Business Settings → Add business name → Write description → Upload cover photo
2. **Contact Info**: Add phone, email, website, physical address
3. **Activate**: Toggle "Active" to make page public
4. **Share Link**: Copy your unique URL and share with customers

**Customer Experience**:
• Customers visit your public link
• They see your business info, services, availability
• They can submit booking request with their details
• You receive notification and approve/reject in dashboard

**Booking Request Form Includes**:
• Customer name, email, phone
• Preferred date/time range
• Service/event type requested
• Special notes or requirements

**Managing Requests**:
1. Receive notification of new booking request
2. Review details in Booking Requests section
3. Approve → Automatically creates calendar event + CRM customer entry
4. Reject → Customer receives notification

**Pro Tips**:
⭐ Add professional cover photo for credibility
⭐ Write clear service descriptions
⭐ Keep calendar updated so customers see accurate availability
⭐ Respond to requests within 24 hours
⭐ Share your link on social media, email signature, website

---

📊 **STATISTICS PAGE GUIDE**:
═══════════════════════════════
**Overview**: Visual analytics dashboard for business insights

**Key Metrics Displayed**:
• 💰 **Total Revenue**: Sum of all paid amounts
• 📅 **Total Bookings**: Number of events/appointments
• 👥 **Total Customers**: Unique customer count
• ✅ **Payment Rate**: Percentage of paid vs unpaid bookings

**Charts & Visualizations**:
📈 **Bookings Over Time**: Line chart showing booking trends (daily/weekly/monthly)
💵 **Revenue Chart**: Bar chart of income by time period
🎯 **Payment Status**: Pie chart of Paid/Unpaid/Partial
📅 **Booking by Day**: Which days are busiest

**Date Range Filters**:
• Last 7 Days
• Last 30 Days  
• Last 3 Months
• Last 6 Months
• Custom Date Range

**Export Features**:
📥 **Export to Excel**: Download complete data as .xlsx spreadsheet with:
- All events/bookings with dates
- Customer information
- Payment details and amounts
- Status and notes

**How to Use**:
1. **Select Time Period**: Choose date range from dropdown
2. **View Trends**: Analyze charts to spot busy/slow periods
3. **Export Data**: Click "Export to Excel" for detailed analysis
4. **Compare Periods**: Switch between date ranges to compare performance

**Insights You Can Get**:
✓ Which months/weeks are busiest
✓ Average booking value
✓ Payment collection rate
✓ Customer acquisition trends
✓ Revenue growth over time

**Pro Tips**:
⭐ Check statistics weekly to track growth
⭐ Use 3-month view to spot seasonal patterns
⭐ Export to Excel for tax records
⭐ Compare month-to-month to set goals
⭐ Low payment rate? Follow up on unpaid bookings

---

💬 **CHAT PAGE GUIDE**:
═══════════════════════════════
**Overview**: Real-time team communication + AI assistant

**Channel Types**:
• 🤖 **AI Assistant** (me!): Ask questions, get insights, analyze data
• 👥 **Team Chat**: Main channel for all team members
• 💬 **Direct Messages**: Private 1-on-1 conversations
• 🔧 **Custom Channels**: Create topic-specific group chats

**Main Features**:
• ⚡ **Real-time Messages**: Instant messaging with team
• 📎 **File Sharing**: Send documents, images, files
• 🔔 **Notifications**: Get notified of new messages
• 👁️ **Read Receipts**: See who's read messages
• ✏️ **Edit/Delete**: Modify or remove your messages
• 🔍 **Search**: Find past messages and conversations

**How to Use Chat**:
1. **Sending Messages**: Type in input box at bottom → Press Enter or Send button
2. **Attaching Files**: Click paperclip icon → Select file → Send
3. **Creating DM**: Click user avatar → "Send Message" → Opens private chat
4. **Custom Channels**: Click "+" icon → Name channel → Select participants → Create
5. **Editing Message**: Hover over your message → Click edit icon → Modify → Save
6. **Deleting Message**: Hover over message → Click delete icon → Confirm

**AI Assistant (That's Me!) Can**:
✓ **CREATE & EDIT** events, tasks, and customers for you
✓ Answer questions about your calendar, tasks, CRM
✓ Provide real-time data and statistics
✓ Find customers, check schedules
✓ Summarize your week, month, performance
✓ Suggest optimal time slots
✓ Alert about pending tasks or bookings
✓ Give business insights and recommendations
✓ Understand natural dates and relative references
✓ Remember conversation history and context
✓ **Create custom reminders** - Set reminders and you'll receive BOTH dashboard notifications AND email alerts at the scheduled time (NO downloads involved)

**Quick Actions** (buttons at bottom):
• 📖 Page Guides: Get help with any feature
• 📅 Today's Schedule: See today's events
• 📊 This Week: Weekly summary
• 🔍 Find Customer: Search CRM
• 📋 Pending Bookings: Check what needs approval
• ✅ Task Progress: Task completion status
• 💰 Payment Summary: Revenue overview
• 🕐 Free Time Slots: Check availability

**Pro Tips**:
⭐ Use AI assistant for quick data lookups instead of navigating pages
⭐ Create separate channels for different projects/topics
⭐ @mention team members to get their attention
⭐ Pin important messages for easy access
⭐ Use DMs for private discussions

═══════════════════════════════

**RESPONSE STYLE**:
- Be conversational and helpful, not robotic
- Use emojis for better visual communication 📊 ✅ 💡
- Provide specific numbers and data from tools
- Suggest next actions based on insights
- Keep responses concise but complete
- Format lists and data clearly with bullets/numbers

**EXCEL GENERATION RULES** 🔴:
**CRITICAL**: When user asks for Excel/spreadsheet generation:
1. Call generate_excel_report tool IMMEDIATELY - don't pre-check data
2. DO NOT call get_all_tasks/get_all_events first to verify data exists
3. The generate_excel_report tool checks for data and returns appropriate response
4. If tool returns success=false with "No data found", THEN tell user no data exists
5. If tool returns success=true, provide download link immediately

✅ CORRECT: User asks "excel tasks last year" → Call generate_excel_report(report_type="tasks", months=12) → Show download link or "no data" message
❌ WRONG: User asks "excel tasks last year" → Call get_all_tasks first → Say "no task data" without trying generate_excel_report

**YOUR FULL CAPABILITIES**:
✅ You CAN create and edit events, tasks, and customers
✅ You CAN provide insights, answer questions, and analyze data
✅ You CAN generate Excel reports and set reminders
✅ You CAN understand natural language and maintain conversation context
❌ You CANNOT delete data (only create/update for safety)

Remember: You're a powerful AI agent that can both READ and WRITE data. Act proactively to help users manage their business!`;

    // Determine the requester name with (AI) suffix
    const requesterName = senderName ? `${senderName} (AI)` : "Smartbookly AI";
    const requesterType = senderType || "admin";
    
    console.log(`👤 Requester: ${requesterName} (type: ${requesterType})`);

    // Process attachments if any
    let attachmentContext = '';
    const imageAttachments: any[] = [];
    
    if (attachments && attachments.length > 0) {
      console.log(`📎 Processing ${attachments.length} attachments...`);
      console.log(`📎 Attachment details:`, attachments.map(a => ({ 
        filename: a.filename, 
        file_path: a.file_path, 
        content_type: a.content_type,
        size: a.size 
      })));
      
      for (const att of attachments) {
        console.log(`  → Processing: ${att.filename} from path: ${att.file_path}`);
        const analysis = await analyzeAttachment(att);
        
        if (typeof analysis === 'object' && analysis.type === 'image') {
          // Image - add to multimodal content
          imageAttachments.push(analysis);
        } else {
          // Text-based analysis
          attachmentContext += `\n\n${analysis}`;
        }
      }
      
      if (attachmentContext) {
        console.log(`✅ Added ${attachments.length} file analyses to context`);
      }
      if (imageAttachments.length > 0) {
        console.log(`🖼️ Added ${imageAttachments.length} images for vision analysis`);
      }
    }

    // Build conversation with history and attachments
    const userMessage = attachmentContext 
      ? `${prompt}\n\n--- Attached Files ---${attachmentContext}`
      : prompt;
    
    const messages = [
      { role: 'system', content: systemPrompt },
      ...conversationHistory.map((msg: any) => ({
        role: msg.role,
        content: msg.content
      })),
      // For images, use multimodal content format
      imageAttachments.length > 0 
        ? { 
            role: 'user', 
            content: [
              { type: 'text', text: userMessage },
              ...imageAttachments.map(img => ({
                type: 'image_url',
                image_url: { url: img.data }
              }))
            ]
          }
        : { role: 'user', content: userMessage }
    ];

    console.log('📤 Calling Lovable AI with history...');
    
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages,
        tools,
        tool_choice: "auto"
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ AI gateway error:', response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded. Please try again in a moment.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      return new Response(
        JSON.stringify({ error: 'AI service error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const aiResult = await response.json();
    const message = aiResult.choices[0].message;

    console.log('📨 AI response received, tool calls:', message.tool_calls?.length || 0);

    // 4. Execute any tool calls (read-only)
    let finalMessages = [...messages, message];
    
    if (message.tool_calls && message.tool_calls.length > 0) {
      console.log('🔧 Executing tool calls...');
      
      for (const toolCall of message.tool_calls) {
        const funcName = toolCall.function.name;
        const args = JSON.parse(toolCall.function.arguments);
        let toolResult = null;

        console.log(`  → ${funcName}(${JSON.stringify(args)})`);

        try {
          switch (funcName) {
            case 'get_current_datetime': {
              // Use the actual local time from user's browser (always UTC ISO string)
              const userLocalTime = currentLocalTime || new Date().toISOString();
              const localDate = new Date(userLocalTime);
              
              // Format the time in user's timezone for display
              const userLocalTimeStr = localDate.toLocaleString('en-US', {
                timeZone: userTimezone,
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                hour12: false
              });
              
              toolResult = {
                currentTime: userLocalTime,
                timestamp: localDate.getTime(),
                userTimezone: userTimezone,
                displayTime: userLocalTimeStr
              };
              console.log(`    ✓ Current time - UTC: ${userLocalTime}, User TZ (${userTimezone}): ${userLocalTimeStr})`);
              break;
            }

            case 'get_todays_schedule': {
              const today = new Date().toISOString().split('T')[0];
              const { data: events } = await supabaseClient
                .from('events')
                .select('id, title, start_date, end_date, payment_status, payment_amount, user_surname, user_number, event_notes')
                .eq('user_id', ownerId)
                .gte('start_date', `${today}T00:00:00`)
                .lte('start_date', `${today}T23:59:59`)
                .is('deleted_at', null)
                .order('start_date', { ascending: true });
              toolResult = { date: today, events: events || [] };
              console.log(`    ✓ Found ${toolResult.events.length} events today`);
              break;
            }

            case 'get_upcoming_events': {
              const days = args.days || 7;
              const startDate = new Date();
              const endDate = new Date();
              endDate.setDate(endDate.getDate() + days);
              
              const { data: events } = await supabaseClient
                .from('events')
                .select('id, title, start_date, end_date, payment_status, payment_amount, user_surname, user_number')
                .eq('user_id', ownerId)
                .gte('start_date', startDate.toISOString())
                .lte('start_date', endDate.toISOString())
                .is('deleted_at', null)
                .order('start_date', { ascending: true })
                .limit(20);
              
              toolResult = { 
                from: startDate.toISOString().split('T')[0],
                to: endDate.toISOString().split('T')[0],
                events: events || [] 
              };
              console.log(`    ✓ Found ${toolResult.events.length} upcoming events`);
              break;
            }

            case 'get_schedule': {
              const { data: events } = await supabaseClient
                .from('events')
                .select('id, title, start_date, end_date, payment_status, payment_amount, user_surname, user_number, event_notes')
                .eq('user_id', ownerId)
                .gte('start_date', args.from)
                .lte('end_date', args.to)
                .is('deleted_at', null)
                .order('start_date', { ascending: true });
              toolResult = events || [];
              console.log(`    ✓ Found ${toolResult.length} events`);
              break;
            }

            case 'get_pending_bookings': {
              const { data: bookings } = await supabaseClient
                .from('booking_requests')
                .select('id, title, requester_name, requester_phone, requester_email, start_date, end_date, payment_amount')
                .eq('status', 'pending')
                .is('deleted_at', null)
                .order('created_at', { ascending: false });
              toolResult = { count: bookings?.length || 0, bookings: bookings || [] };
              console.log(`    ✓ Found ${toolResult.count} pending bookings`);
              break;
            }

            case 'get_all_tasks': {
              const filters = {
                status: args.status,
                created_after: args.created_after,
                created_before: args.created_before
              };

              const res = await fetchTasksFlexible(supabaseClient, ownerId, filters);

              // breakdown with normalized statuses
              const breakdown: Record<string, number> = {};
              for (const t of res.tasks) {
                const s = unifyStatus(t.status);
                breakdown[s] = (breakdown[s] || 0) + 1;
              }

              toolResult = {
                tasks: res.tasks,
                count: res.tasks.length,
                status_breakdown: breakdown,
                filters_applied: {
                  status: normStatus(filters.status) || 'all',
                  created_after: filters.created_after || 'none',
                  created_before: filters.created_before || 'none'
                }
              };
              console.log(`    ✅ Tasks: ${res.tasks.length} (via ${res.meta?.used?.ownerCol || 'unknown'})`);
              break;
            }

            case 'get_task_statistics': {
              const res = await fetchTasksFlexible(supabaseClient, ownerId, {});
              const total = res.tasks.length;

              const counts = { todo: 0, in_progress: 0, done: 0, other: 0 };
              for (const t of res.tasks) {
                const s = unifyStatus(t.status);
                if (s in counts) (counts as any)[s]++; else counts.other++;
              }
              const completion_rate = total ? Math.round((counts.done / total) * 100) : 0;

              toolResult = {
                total,
                todo: counts.todo,
                in_progress: counts.in_progress,
                done: counts.done,
                other: counts.other,
                completion_rate
              };
              console.log(`    ✓ Task stats from ${res.tasks.length} rows (done=${counts.done})`);
              break;
            }

            case 'get_all_events': {
              console.log(`    📅 Fetching all events for user ${ownerId}`);
              console.log(`       Filters:`, {
                start_date: args.start_date || 'none',
                end_date: args.end_date || 'none'
              });
              
              let query = supabaseClient
                .from('events')
                .select('id, title, start_date, end_date, payment_status, payment_amount, event_notes, user_surname, user_number, created_at, type')
                .eq('user_id', ownerId)
                .is('deleted_at', null);
              
              // Apply date filters
              if (args.start_date) {
                query = query.gte('start_date', args.start_date);
                console.log(`       📅 Date filter: start_date >= ${args.start_date}`);
              }
              if (args.end_date) {
                query = query.lte('end_date', args.end_date);
                console.log(`       📅 Date filter: end_date <= ${args.end_date}`);
              }
              
              query = query.order('start_date', { ascending: false });
              
              const { data: events, error: eventsError } = await query;
              
              if (eventsError) {
                console.error('    ❌ Error fetching events:', eventsError);
                toolResult = {
                  events: [],
                  count: 0,
                  error: eventsError.message,
                  filters_applied: { start_date: args.start_date, end_date: args.end_date }
                };
              } else {
                // Calculate payment breakdown
                const paymentBreakdown = (events || []).reduce((acc, event) => {
                  const status = event.payment_status || 'unknown';
                  acc[status] = (acc[status] || 0) + 1;
                  return acc;
                }, {} as Record<string, number>);
                
                // Calculate total revenue
                const totalRevenue = (events || []).reduce((sum, event) => {
                  return sum + (Number(event.payment_amount) || 0);
                }, 0);
                
                toolResult = {
                  events: events || [],
                  count: events?.length || 0,
                  payment_breakdown: paymentBreakdown,
                  total_revenue: totalRevenue,
                  filters_applied: {
                    start_date: args.start_date || 'none',
                    end_date: args.end_date || 'none'
                  }
                };
                console.log(`    ✅ Found ${events?.length || 0} events`);
                console.log(`       Payment breakdown:`, paymentBreakdown);
                console.log(`       Total revenue:`, totalRevenue);
              }
              break;
            }

            case 'get_all_customers': {
              console.log(`    👥 Fetching all customers for user ${ownerId}`);
              console.log(`       Filters:`, {
                created_after: args.created_after || 'none',
                created_before: args.created_before || 'none'
              });
              
              let query = supabaseClient
                .from('customers')
                .select('id, title, user_surname, user_number, social_network_link, payment_status, payment_amount, event_notes, created_at, start_date, end_date')
                .eq('user_id', ownerId)
                .is('deleted_at', null);
              
              // Apply date filters
              if (args.created_after) {
                query = query.gte('created_at', args.created_after);
                console.log(`       📅 Date filter: created_at >= ${args.created_after}`);
              }
              if (args.created_before) {
                query = query.lte('created_at', args.created_before);
                console.log(`       📅 Date filter: created_at <= ${args.created_before}`);
              }
              
              query = query.order('created_at', { ascending: false });
              
              const { data: customers, error: customersError } = await query;
              
              if (customersError) {
                console.error('    ❌ Error fetching customers:', customersError);
                toolResult = {
                  customers: [],
                  count: 0,
                  error: customersError.message,
                  filters_applied: { created_after: args.created_after, created_before: args.created_before }
                };
              } else {
                // Calculate payment breakdown
                const paymentBreakdown = (customers || []).reduce((acc, customer) => {
                  const status = customer.payment_status || 'unknown';
                  acc[status] = (acc[status] || 0) + 1;
                  return acc;
                }, {} as Record<string, number>);
                
                // Calculate total revenue
                const totalRevenue = (customers || []).reduce((sum, customer) => {
                  return sum + (Number(customer.payment_amount) || 0);
                }, 0);
                
                toolResult = {
                  customers: customers || [],
                  count: customers?.length || 0,
                  payment_breakdown: paymentBreakdown,
                  total_revenue: totalRevenue,
                  filters_applied: {
                    created_after: args.created_after || 'none',
                    created_before: args.created_before || 'none'
                  }
                };
                console.log(`    ✅ Found ${customers?.length || 0} customers`);
                console.log(`       Payment breakdown:`, paymentBreakdown);
                console.log(`       Total revenue:`, totalRevenue);
              }
              break;
            }

            case 'find_customer': {
              const { data: customers } = await supabaseClient
                .from('customers')
                .select('id, title, user_surname, user_number, social_network_link, payment_status, payment_amount, event_notes')
                .eq('user_id', ownerId)
                .or(`title.ilike.%${args.query}%,user_surname.ilike.%${args.query}%,user_number.ilike.%${args.query}%`)
                .is('deleted_at', null)
                .limit(10);
              toolResult = customers || [];
              console.log(`    ✓ Found ${toolResult.length} customers`);
              break;
            }

            case 'get_recent_customers': {
              const limit = args.limit || 10;
              const { data: customers } = await supabaseClient
                .from('customers')
                .select('id, title, user_surname, user_number, payment_status, payment_amount, created_at')
                .eq('user_id', ownerId)
                .is('deleted_at', null)
                .order('created_at', { ascending: false })
                .limit(limit);
              toolResult = customers || [];
              console.log(`    ✓ Found ${toolResult.length} recent customers`);
              break;
            }

            case 'get_payment_summary': {
              const { data: events } = await supabaseClient
                .from('events')
                .select('payment_status, payment_amount')
                .eq('user_id', ownerId)
                .is('deleted_at', null);
              
              const summary = {
                total_events: events?.length || 0,
                paid: events?.filter(e => e.payment_status === 'paid').length || 0,
                not_paid: events?.filter(e => e.payment_status === 'not_paid').length || 0,
                partial: events?.filter(e => e.payment_status === 'partial').length || 0,
                total_amount: events?.reduce((sum, e) => sum + (Number(e.payment_amount) || 0), 0) || 0
              };
              
              toolResult = summary;
              console.log(`    ✓ Payment summary: ${summary.total_amount} total`);
              break;
            }

            case 'get_business_stats': {
              const today = new Date();
              const monthStart = new Date(today.getFullYear(), today.getMonth(), 1).toISOString();
              
              const [eventsResult, bookingsResult, customersResult] = await Promise.all([
                supabaseClient.from('events').select('payment_amount').eq('user_id', ownerId).gte('created_at', monthStart).is('deleted_at', null),
                supabaseClient.from('booking_requests').select('id').eq('status', 'approved').gte('created_at', monthStart),
                supabaseClient.from('customers').select('id').eq('user_id', ownerId).is('deleted_at', null)
              ]);
              
              toolResult = {
                this_month: {
                  events: eventsResult.data?.length || 0,
                  bookings: bookingsResult.data?.length || 0,
                  revenue: eventsResult.data?.reduce((sum, e) => sum + (Number(e.payment_amount) || 0), 0) || 0
                },
                total_customers: customersResult.data?.length || 0
              };
              console.log(`    ✓ Business stats generated`);
              break;
            }

            case 'analyze_payment_history': {
              const months = args.months || 12;
              const today = new Date();
              const startDate = new Date(today);
              startDate.setMonth(today.getMonth() - months);
              
              // Fetch all events with payments in the time period
              const { data: events } = await supabaseClient
                .from('events')
                .select('payment_amount, payment_status, created_at, start_date')
                .eq('user_id', ownerId)
                .gte('created_at', startDate.toISOString())
                .is('deleted_at', null)
                .order('created_at', { ascending: true });
              
              // Fetch all customers in the time period
              const { data: customers } = await supabaseClient
                .from('customers')
                .select('payment_amount, payment_status, created_at')
                .eq('user_id', ownerId)
                .gte('created_at', startDate.toISOString())
                .is('deleted_at', null)
                .order('created_at', { ascending: true });
              
              // Group by month
              const monthlyData: Record<string, any> = {};
              const allPayments = [
                ...(events || []).map(e => ({ ...e, source: 'event' })),
                ...(customers || []).map(c => ({ ...c, source: 'customer' }))
              ];
              
              allPayments.forEach(item => {
                const date = new Date(item.created_at);
                const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
                
                if (!monthlyData[monthKey]) {
                  monthlyData[monthKey] = {
                    month: monthKey,
                    total_revenue: 0,
                    paid_count: 0,
                    not_paid_count: 0,
                    partial_count: 0,
                    total_transactions: 0
                  };
                }
                
                const amount = Number(item.payment_amount) || 0;
                monthlyData[monthKey].total_revenue += amount;
                monthlyData[monthKey].total_transactions += 1;
                
                if (item.payment_status === 'paid') monthlyData[monthKey].paid_count += 1;
                else if (item.payment_status === 'not_paid') monthlyData[monthKey].not_paid_count += 1;
                else if (item.payment_status === 'partial') monthlyData[monthKey].partial_count += 1;
              });
              
              const monthlyArray = Object.values(monthlyData).sort((a: any, b: any) => 
                a.month.localeCompare(b.month)
              );
              
              const totalRevenue = allPayments.reduce((sum, item) => sum + (Number(item.payment_amount) || 0), 0);
              const paidCount = allPayments.filter(p => p.payment_status === 'paid').length;
              const notPaidCount = allPayments.filter(p => p.payment_status === 'not_paid').length;
              const avgMonthlyRevenue = monthlyArray.length > 0 ? totalRevenue / monthlyArray.length : 0;
              
              toolResult = {
                period: `${months} months`,
                start_date: startDate.toISOString().split('T')[0],
                end_date: today.toISOString().split('T')[0],
                summary: {
                  total_revenue: totalRevenue,
                  total_transactions: allPayments.length,
                  paid_transactions: paidCount,
                  not_paid_transactions: notPaidCount,
                  average_monthly_revenue: Math.round(avgMonthlyRevenue),
                  payment_completion_rate: allPayments.length > 0 ? Math.round((paidCount / allPayments.length) * 100) : 0
                },
                monthly_breakdown: monthlyArray,
                insights: {
                  best_month: monthlyArray.length > 0 ? monthlyArray.reduce((max: any, m: any) => m.total_revenue > max.total_revenue ? m : max) : null,
                  worst_month: monthlyArray.length > 0 ? monthlyArray.reduce((min: any, m: any) => m.total_revenue < min.total_revenue ? m : min) : null
                }
              };
              console.log(`    ✓ Analyzed ${months} months of payment history: ${totalRevenue} total revenue`);
              break;
            }

            case 'generate_excel_report': {
              const reportType = args.report_type;
              const months = args.months || 12;
              
              console.log(`    📊 Generating ${reportType} Excel report for ${months} months`);
              
              // Call the excel generator edge function
              const { data: excelData, error: excelError } = await supabaseAdmin.functions.invoke('generate-excel-report', {
                body: {
                  reportType,
                  months,
                  userId: ownerId
                }
              });
              
              if (excelError) {
                console.error('    ❌ Excel generation error:', excelError);
                toolResult = {
                  success: false,
                  error: 'Failed to generate Excel report'
                };
              } else if (excelData.success === false) {
                // Handle case where no data was found
                console.log(`    ℹ️ No data found for ${reportType} report`);
                toolResult = {
                  success: false,
                  error: excelData.error || 'No data found',
                  record_count: 0
                };
              } else {
                // IMPORTANT: The downloadUrl is a signed URL that expires in 1 hour
                // It should be accessed immediately by the user
                toolResult = {
                  success: true,
                  download_url: excelData.downloadUrl,
                  filename: excelData.filename,
                  report_type: reportType,
                  record_count: excelData.recordCount,
                  expires_in: '1 hour',
                  instruction: 'Click the link immediately to download - it expires in 1 hour'
                };
                console.log(`    ✅ Excel report ready: ${excelData.filename} (${excelData.recordCount} records)`);
              }
              break;
            }

            case 'get_weekly_summary': {
              const today = new Date();
              const weekStart = new Date(today);
              weekStart.setDate(today.getDate() - 7);
              
              const [eventsResult, tasksResult, bookingsResult] = await Promise.all([
                supabaseClient.from('events').select('*').eq('user_id', ownerId).gte('start_date', weekStart.toISOString()).is('deleted_at', null),
                supabaseClient.from('tasks').select('status').eq('user_id', ownerId).is('archived_at', null),
                supabaseClient.from('booking_requests').select('status').gte('created_at', weekStart.toISOString())
              ]);
              
              toolResult = {
                period: 'last_7_days',
                events: {
                  total: eventsResult.data?.length || 0,
                  paid: eventsResult.data?.filter(e => e.payment_status === 'paid').length || 0
                },
                tasks: {
                  completed: tasksResult.data?.filter(t => t.status === 'done').length || 0,
                  in_progress: tasksResult.data?.filter(t => t.status === 'in_progress').length || 0
                },
                bookings: {
                  pending: bookingsResult.data?.filter(b => b.status === 'pending').length || 0,
                  approved: bookingsResult.data?.filter(b => b.status === 'approved').length || 0
                }
              };
              console.log(`    ✓ Weekly summary generated`);
              break;
            }

            case 'get_free_time_slots': {
              const targetDate = args.date;
              const { data: events } = await supabaseClient
                .from('events')
                .select('start_date, end_date')
                .eq('user_id', ownerId)
                .gte('start_date', `${targetDate}T00:00:00`)
                .lte('start_date', `${targetDate}T23:59:59`)
                .is('deleted_at', null)
                .order('start_date', { ascending: true });
              
              toolResult = {
                date: targetDate,
                booked_slots: events || [],
                has_availability: (events?.length || 0) < 10
              };
              console.log(`    ✓ Found ${toolResult.booked_slots.length} booked slots on ${targetDate}`);
              break;
            }

            case 'summarize_channel': {
              const limit = args.limit || 50;
              const { data: messages } = await supabaseClient
                .from('chat_messages')
                .select('content, sender_name, sender_type, created_at')
                .eq('channel_id', args.channelId)
                .eq('owner_id', ownerId)
                .is('is_deleted', false)
                .order('created_at', { ascending: false })
                .limit(limit);
              toolResult = messages || [];
              console.log(`    ✓ Retrieved ${toolResult.length} messages`);
              break;
            }

            case 'create_custom_reminder': {
              const { title, message, offset_minutes, absolute_local } = args;
              
              // 1) Base time is BROWSER time received from frontend
              const baseNow = currentLocalTime ? new Date(currentLocalTime) : new Date();
              
              // 2) Compute UTC remind time deterministically on server
              let remindAtUtc: Date;
              
              if (typeof offset_minutes === 'number' && offset_minutes > 0) {
                // Relative time: add offset to current browser time
                remindAtUtc = new Date(baseNow.getTime() + offset_minutes * 60_000);
              } else if (absolute_local) {
                // Absolute time: convert local wall time to UTC
                const [d, t] = absolute_local.split('T');
                const [Y, M, D] = d.split('-').map(Number);
                const [h, m] = t.split(':').map(Number);
                
                // Start from UTC guess, then adjust so it displays as desired wall time in user's TZ
                let guess = new Date(Date.UTC(Y, M - 1, D, h, m));
                
                const fmt = (x: Date) =>
                  new Intl.DateTimeFormat('en-CA', {
                    timeZone: userTimezone,
                    hour12: false,
                    year: 'numeric',
                    month: '2-digit',
                    day: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit'
                  })
                    .formatToParts(x)
                    .reduce((a, p) => { a[p.type] = p.value; return a; }, {} as any);
                
                // Adjustment loop (handles DST edges)
                for (let i = 0; i < 3; i++) {
                  const parts = fmt(guess);
                  const want = `${Y}-${String(M).padStart(2, '0')}-${String(D).padStart(2, '0')}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
                  const have = `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
                  if (have === want) break;
                  
                  const deltaMin =
                    ((Y - +parts.year) * 525600) +
                    ((M - +parts.month) * 43200) +
                    ((D - +parts.day) * 1440) +
                    ((h - +parts.hour) * 60) +
                    (m - +parts.minute);
                  guess = new Date(guess.getTime() + deltaMin * 60_000);
                }
                remindAtUtc = guess;
              } else {
                toolResult = { success: false, error: 'Provide offset_minutes or absolute_local.' };
                break;
              }
              
              // 3) Validate future time
              const nowUtc = new Date();
              if (remindAtUtc <= new Date(nowUtc.getTime() - 1000)) {
                toolResult = { success: false, error: 'Reminder time must be in the future.' };
                break;
              }
              
              // 4) Store reminder (same as existing system)
              const { data: reminderRow, error: reminderError } = await supabaseAdmin
                .from('custom_reminders')
                .insert({
                  user_id: ownerId,
                  title,
                  message: message || '',
                  remind_at: remindAtUtc.toISOString(),
                  email_sent: false,
                  reminder_sent_at: null
                })
                .select()
                .single();
              
              if (reminderError) {
                console.error('❌ Failed to create reminder:', reminderError);
                toolResult = { success: false, error: reminderError.message };
                break;
              }
              
              // 5) Build HUMAN message on server (no LLM) - in user's language
              const display = formatInUserZone(remindAtUtc);
              
              console.log('Reminder debug:', {
                effectiveTZ,
                tzOffsetMinutes,
                baseNow: currentLocalTime,
                remindAtUtc: remindAtUtc.toISOString(),
                display,
                userLanguage
              });
              
              // Localized confirmation messages
              const confirmations = {
                en: `✅ Reminder set! I'll remind you about '${title}' at ${display}. You'll receive both an email and dashboard notification.`,
                ru: `✅ Напоминание установлено! Я напомню вам о '${title}' в ${display}. Вы получите уведомление по электронной почте и на панели управления.`,
                ka: `✅ შეხსენება დაყენებულია! გაგახსენებთ '${title}' ${display}-ზე. მიიღებთ შეტყობინებას ელფოსტით და პანელზე.`,
                es: `✅ ¡Recordatorio establecido! Te recordaré sobre '${title}' a las ${display}. Recibirás una notificación por correo electrónico y en el panel.`
              };
              
              const confirmation = confirmations[userLanguage as keyof typeof confirmations] || confirmations.en;
              
              // 6) Write bot message now (skip second LLM call)
              await supabaseAdmin.from('chat_messages').insert({
                channel_id: channelId,
                owner_id: ownerId,
                sender_type: 'admin',
                sender_name: 'Smartbookly AI',
                content: confirmation,
                message_type: 'text'
              });
              
              // Return early with immediate response
              return new Response(
                JSON.stringify({ success: true, content: confirmation }),
                {
                  headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                }
              );
            }

            case 'create_or_update_event': {
              const { event_id, full_name, start_date, end_date, phone_number, social_media, notes, payment_status, payment_amount, event_name } = args;
              
              console.log(`    📅 ${event_id ? 'Updating' : 'Creating'} event for ${full_name}`, { start_date, end_date, userTimezone });
              
              try {
                // CRITICAL: Convert local datetime to UTC using same logic as reminders
                const convertLocalToUTC = (localDateTimeStr: string): string => {
                  if (!localDateTimeStr) return new Date().toISOString();
                  
                  // Parse the local date/time string
                  const [datePart, timePart] = localDateTimeStr.split('T');
                  const [Y, M, D] = datePart.split('-').map(Number);
                  const [h, m] = timePart ? timePart.split(':').map(Number) : [0, 0];
                  
                  // Start from UTC guess
                  let guess = new Date(Date.UTC(Y, M - 1, D, h, m));
                  
                  // If we have a valid timezone, adjust so it displays correctly in user's TZ
                  if (effectiveTZ) {
                    const fmt = (x: Date) =>
                      new Intl.DateTimeFormat('en-CA', {
                        timeZone: effectiveTZ,
                        hour12: false,
                        year: 'numeric',
                        month: '2-digit',
                        day: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit'
                      })
                        .formatToParts(x)
                        .reduce((a, p) => { a[p.type] = p.value; return a; }, {} as any);
                    
                    // Adjustment loop to handle DST
                    for (let i = 0; i < 3; i++) {
                      const parts = fmt(guess);
                      const want = `${Y}-${String(M).padStart(2, '0')}-${String(D).padStart(2, '0')}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
                      const have = `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
                      if (have === want) break;
                      
                      const deltaMin =
                        ((Y - +parts.year) * 525600) +
                        ((M - +parts.month) * 43200) +
                        ((D - +parts.day) * 1440) +
                        ((h - +parts.hour) * 60) +
                        (m - +parts.minute);
                      guess = new Date(guess.getTime() + deltaMin * 60_000);
                    }
                  } else if (typeof tzOffsetMinutes === 'number') {
                    // Fallback: use offset if no IANA timezone
                    guess = new Date(guess.getTime() + tzOffsetMinutes * 60_000);
                  }
                  
                  return guess.toISOString();
                };
                
                // Convert start and end dates to UTC
                const startDateUTC = convertLocalToUTC(start_date);
                const endDateUTC = convertLocalToUTC(end_date);
                
                console.log('🕐 Timezone conversion:', {
                  localStart: start_date,
                  utcStart: startDateUTC,
                  localEnd: end_date,
                  utcEnd: endDateUTC,
                  effectiveTZ,
                  tzOffsetMinutes
                });
                
                // Check for time conflicts BEFORE creating (only for new events)
                if (!event_id) {
                  const { data: conflicts } = await supabaseAdmin
                    .from('events')
                    .select('id, title, start_date, end_date, user_surname')
                    .eq('user_id', ownerId)
                    .is('deleted_at', null)
                    .or(`and(start_date.lte.${endDateUTC},end_date.gte.${startDateUTC})`);
                  
                  if (conflicts && conflicts.length > 0) {
                    const conflict = conflicts[0];
                    const conflictName = conflict.user_surname || conflict.title;
                    console.log(`    ⚠️ Time conflict detected with event: ${conflictName}`);
                    toolResult = { 
                      success: false, 
                      error: 'time_conflict',
                      conflict: {
                        name: conflictName,
                        start: conflict.start_date,
                        end: conflict.end_date
                      },
                      message: `Time slot is already booked with "${conflictName}". Please choose a different time.`
                    };
                    break;
                  }
                }

                const eventData = {
                  title: full_name,
                  user_surname: full_name,
                  user_number: phone_number || "",
                  social_network_link: social_media || "",
                  event_notes: notes || "",
                  event_name: event_name || "",
                  start_date: startDateUTC,
                  end_date: endDateUTC,
                  payment_status: payment_status || "not_paid",
                  payment_amount: payment_amount ? payment_amount.toString() : "",
                  type: "event"
                };

                if (event_id) {
                  // Update existing event
                  const { data: result, error: updateError } = await supabaseAdmin.rpc('save_event_with_persons', {
                    p_event_data: eventData,
                    p_additional_persons: [],
                    p_user_id: ownerId,
                    p_event_id: event_id,
                    p_created_by_type: requesterType,
                    p_created_by_name: requesterName,
                    p_last_edited_by_type: requesterType,
                    p_last_edited_by_name: requesterName
                  });
                  
                  if (updateError) {
                    console.error('    ❌ Failed to update event:', updateError);
                    toolResult = { success: false, error: updateError.message };
                  } else {
                    console.log(`    ✅ Event updated: ${full_name}`);
                    
                    // Link chat attachment files to event without re-uploading
                    let uploadedFiles = [];
                    if (attachments && attachments.length > 0) {
                      console.log(`    📎 Linking ${attachments.length} file attachments to event ${event_id}`);
                      for (const attachment of attachments) {
                        try {
                          console.log(`    → Linking ${attachment.filename} from chat_attachments`);
                          
                          // Create event_files record pointing to chat_attachments file
                          const { error: dbError } = await supabaseAdmin.from('event_files').insert({
                            event_id: event_id,
                            user_id: ownerId,
                            filename: attachment.filename,
                            file_path: fileStoragePath,
                            content_type: attachment.content_type,
                            size: attachment.size
                          });
                          
                          if (dbError) {
                            console.error(`    ❌ DB insert error for ${attachment.filename}:`, dbError);
                            continue;
                          }
                          
                          uploadedFiles.push(attachment.filename);
                          console.log(`    ✅ File uploaded successfully: ${attachment.filename}`);
                        } catch (fileError) {
                          console.error(`    ❌ File upload exception for ${attachment.filename}:`, fileError);
                        }
                      }
                    }
                    
                    toolResult = { 
                      success: true, 
                      event_id: result || event_id,
                      action: 'updated',
                      message: `Event updated: ${full_name}`,
                      uploaded_files: uploadedFiles
                    };
                    
                    // Broadcast change
                    const ch = supabaseAdmin.channel(`public_board_events_${ownerId}`);
                    ch.subscribe((status) => {
                      if (status === 'SUBSCRIBED') {
                        ch.send({ type: 'broadcast', event: 'events-changed', payload: { ts: Date.now(), source: 'ai' } });
                        supabaseAdmin.removeChannel(ch);
                      }
                    });
                  }
                } else {
                  // Create new event
                  const { data: newEventId, error: createError } = await supabaseAdmin.rpc('save_event_with_persons', {
                    p_event_data: eventData,
                    p_additional_persons: [],
                    p_user_id: ownerId,
                    p_event_id: null,
                    p_created_by_type: requesterType,
                    p_created_by_name: requesterName,
                    p_last_edited_by_type: requesterType,
                    p_last_edited_by_name: requesterName
                  });
                  
                  if (createError) {
                    console.error('    ❌ Failed to create event:', createError);
                    toolResult = { success: false, error: createError.message };
                  } else {
                    console.log(`    ✅ Event created: ${full_name} (ID: ${newEventId})`);
                    
                    // Link chat attachment files to new event without re-uploading
                    let uploadedFiles = [];
                    if (attachments && attachments.length > 0) {
                      console.log(`    📎 Linking ${attachments.length} file attachments to new event ${newEventId}`);
                      for (const attachment of attachments) {
                        try {
                          console.log(`    → Linking ${attachment.filename} from chat_attachments`);
                          
                          // Create event_files record pointing to chat_attachments file
                          const { error: dbError } = await supabaseAdmin.from('event_files').insert({
                            event_id: newEventId,
                            user_id: ownerId,
                            filename: attachment.filename,
                            file_path: `chat_attachments/${attachment.file_path}`,
                            content_type: attachment.content_type,
                            size: attachment.size
                          });
                          
                          if (dbError) {
                            console.error(`    ❌ DB insert error for ${attachment.filename}:`, dbError);
                            continue;
                          }
                          
                          uploadedFiles.push(attachment.filename);
                          console.log(`    ✅ File ${attachment.filename} linked to event`);
                        } catch (fileError) {
                          console.error(`    ❌ Error linking file ${attachment.filename}:`, fileError);
                        }
                      }
                    }
                    
                    // CRITICAL FIX: Send email notification (same as manual creation)
                    try {
                      // Get business profile for email
                      const { data: businessProfile } = await supabaseAdmin
                        .from('business_profiles')
                        .select('business_name, contact_address')
                        .eq('user_id', ownerId)
                        .maybeSingle();
                      
                      // Send email if customer has valid email
                      if (social_media && social_media.includes('@')) {
                        console.log(`    📧 Sending approval email to ${social_media}`);
                        
                        const { error: emailError } = await supabaseAdmin.functions.invoke('send-booking-approval-email', {
                          body: {
                            recipientEmail: social_media,
                            fullName: full_name,
                            businessName: businessProfile?.business_name || 'Business',
                            startDate: startDateUTC,
                            endDate: endDateUTC,
                            paymentStatus: payment_status || 'not_paid',
                            paymentAmount: payment_amount || null,
                            businessAddress: businessProfile?.contact_address || '',
                            eventId: newEventId,
                            language: userLanguage,
                            eventNotes: notes || ''
                          }
                        });
                        
                        if (emailError) {
                          console.error('    ⚠️ Email sending failed:', emailError);
                        } else {
                          console.log('    ✅ Approval email sent successfully');
                        }
                      }
                    } catch (emailError) {
                      console.error('    ⚠️ Email notification error:', emailError);
                    }
                    
                    toolResult = { 
                      success: true, 
                      event_id: newEventId, 
                      action: 'created',
                      message: `Event created: ${full_name}`,
                      uploaded_files: uploadedFiles,
                      email_sent: social_media && social_media.includes('@')
                    };
                    
                    // Broadcast change
                    const ch = supabaseAdmin.channel(`public_board_events_${ownerId}`);
                    ch.subscribe((status) => {
                      if (status === 'SUBSCRIBED') {
                        ch.send({ type: 'broadcast', event: 'events-changed', payload: { ts: Date.now(), source: 'ai' } });
                        supabaseAdmin.removeChannel(ch);
                      }
                    });
                  }
                }
              } catch (error) {
                console.error('    ❌ Error in create_or_update_event:', error);
                toolResult = { success: false, error: error.message || 'Unknown error' };
              }
              break;
            }

            case 'create_or_update_task': {
              const { task_id, task_name, description, status, deadline, reminder, email_reminder } = args;
              
              console.log(`    ✅ ${task_id ? 'Updating' : 'Creating'} task: ${task_name}`);
              
              try {
                const taskData = {
                  title: task_name,
                  description: description || "",
                  status: status || "todo",
                  user_id: ownerId,
                  position: 0,
                  deadline_at: deadline || null,
                  reminder_at: reminder || null,
                  email_reminder_enabled: email_reminder || false,
                  created_by_type: requesterType,
                  created_by_name: requesterName,
                  last_edited_by_type: requesterType,
                  last_edited_by_name: requesterName,
                  last_edited_at: new Date().toISOString()
                };

                if (task_id) {
                  // Update existing task
                  const { error: updateError } = await supabaseAdmin
                    .from('tasks')
                    .update(taskData)
                    .eq('id', task_id)
                    .eq('user_id', ownerId);
                  
                  if (updateError) {
                    console.error('    ❌ Failed to update task:', updateError);
                    toolResult = { success: false, error: updateError.message };
                  } else {
                    console.log(`    ✅ Task updated: ${task_name}`);
                    toolResult = { 
                      success: true, 
                      task_id: task_id,
                      action: 'updated',
                      message: `Task updated: ${task_name}`
                    };
                  }
                } else {
                  // Create new task
                  const { data: newTask, error: createError } = await supabaseAdmin
                    .from('tasks')
                    .insert(taskData)
                    .select()
                    .single();
                  
                  if (createError) {
                    console.error('    ❌ Failed to create task:', createError);
                    toolResult = { success: false, error: createError.message };
                  } else {
                    console.log(`    ✅ Task created: ${task_name} (ID: ${newTask.id})`);
                    toolResult = { 
                      success: true, 
                      task_id: newTask.id,
                      action: 'created',
                      message: `Task created: ${task_name}`
                    };
                    
                    // Broadcast change for real-time sync
                    const ch = supabaseAdmin.channel(`public_board_tasks_${ownerId}`);
                    ch.subscribe((status) => {
                      if (status === 'SUBSCRIBED') {
                        ch.send({ type: 'broadcast', event: 'tasks-changed', payload: { ts: Date.now(), source: 'ai' } });
                        supabaseAdmin.removeChannel(ch);
                      }
                    });
                  }
                }
              } catch (error) {
                console.error('    ❌ Error in create_or_update_task:', error);
                toolResult = { success: false, error: error.message || 'Unknown error' };
              }
              break;
            }

            case 'create_or_update_customer': {
              const { customer_id, full_name, phone_number, social_media, notes, payment_status, payment_amount, create_event, event_start, event_end } = args;
              
              console.log(`    👥 ${customer_id ? 'Updating' : 'Creating'} customer: ${full_name}`);
              
              try {
                const customerData = {
                  title: full_name,
                  user_surname: full_name,
                  user_number: phone_number || "",
                  social_network_link: social_media || "",
                  event_notes: notes || "",
                  payment_status: payment_status || "not_paid",
                  payment_amount: payment_amount || null,
                  user_id: ownerId,
                  type: "customer",
                  created_by_type: requesterType,
                  created_by_name: requesterName,
                  last_edited_by_type: requesterType,
                  last_edited_by_name: requesterName
                };

                if (customer_id) {
                  // Update existing customer
                  const { error: updateError } = await supabaseAdmin
                    .from('customers')
                    .update(customerData)
                    .eq('id', customer_id)
                    .eq('user_id', ownerId);
                  
                  if (updateError) {
                    console.error('    ❌ Failed to update customer:', updateError);
                    toolResult = { success: false, error: updateError.message };
                  } else {
                    console.log(`    ✅ Customer updated: ${full_name}`);
                    toolResult = { 
                      success: true, 
                      customer_id: customer_id,
                      action: 'updated',
                      message: `Customer updated: ${full_name}`
                    };
                  }
                } else {
                  // Create new customer
                  const { data: newCustomer, error: createError } = await supabaseAdmin
                    .from('customers')
                    .insert(customerData)
                    .select()
                    .single();
                  
                  if (createError) {
                    console.error('    ❌ Failed to create customer:', createError);
                    toolResult = { success: false, error: createError.message };
                  } else {
                    console.log(`    ✅ Customer created: ${full_name} (ID: ${newCustomer.id})`);
                    let message = `Customer created: ${full_name}`;
                    
                    // If create_event is true, also create the event
                    if (create_event && event_start && event_end) {
                      const { data: eventId, error: eventError } = await supabaseAdmin.rpc('save_event_with_persons', {
                        p_event_data: {
                          title: full_name,
                          user_surname: full_name,
                          user_number: phone_number || "",
                          social_network_link: social_media || "",
                          event_notes: notes || "",
                          start_date: event_start,
                          end_date: event_end,
                          payment_status: payment_status || "not_paid",
                          payment_amount: payment_amount ? payment_amount.toString() : "",
                          type: "event"
                        },
                        p_additional_persons: [],
                        p_user_id: ownerId,
                        p_event_id: null,
                        p_created_by_type: requesterType,
                        p_created_by_name: requesterName,
                        p_last_edited_by_type: requesterType,
                        p_last_edited_by_name: requesterName
                      });
                      
                      if (!eventError) {
                        message += ` and event created for ${event_start}`;
                        console.log(`    ✅ Linked event created (ID: ${eventId})`);
                      }
                    }
                    
                    toolResult = { 
                      success: true, 
                      customer_id: newCustomer.id,
                      action: 'created',
                      message
                    };
                    
                    // Broadcast change for real-time sync
                    const ch = supabaseAdmin.channel(`public_board_customers_${ownerId}`);
                    ch.subscribe((status) => {
                      if (status === 'SUBSCRIBED') {
                        ch.send({ type: 'broadcast', event: 'customers-changed', payload: { ts: Date.now(), source: 'ai' } });
                        supabaseAdmin.removeChannel(ch);
                      }
                    });
                  }
                }
              } catch (error) {
                console.error('    ❌ Error in create_or_update_customer:', error);
                toolResult = { success: false, error: error.message || 'Unknown error' };
              }
              break;
            }
          }

          // Add tool result to conversation
          finalMessages.push({
            role: "tool",
            tool_call_id: toolCall.id,
            content: JSON.stringify(toolResult)
          });
        } catch (error) {
          console.error(`    ✗ Tool ${funcName} failed:`, error);
          finalMessages.push({
            role: "tool",
            tool_call_id: toolCall.id,
            content: JSON.stringify({ error: `Failed to execute ${funcName}` })
          });
        }
      }

      // Get final response with clear instructions
      console.log('📤 Getting final AI response with tool results...');
      
      const responsePrompt = {
        role: "user",
        content: `Respond to the user about the action result. 

IMPORTANT RESPONSE RULES:
- If time_conflict error: Say "⚠️ That time slot is already booked with [conflict name]. Would you like a different time?"
- If event/task/customer was created: Confirm with "✅ [Type] created: [name] on [date/time]"
- If event/task/customer was updated: Confirm with "✅ [Type] updated: [name]"
- If files were uploaded: Add "📎 Files attached: [list file names]"
- If create_custom_reminder: Say "✅ Reminder set! I'll remind you about [title] at [display_time]. You'll receive both an email and dashboard notification."
- For excel reports: Include download link
- Be concise and use the user's language (${userLanguage})`
      };
      
      const finalResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [...finalMessages, responsePrompt]
        }),
      });

      if (finalResponse.ok) {
        const finalResult = await finalResponse.json();
        const finalMessage = finalResult.choices[0].message;
        console.log('✅ Final response received');
        
        // Check if we have actual content
        if (!finalMessage.content || finalMessage.content.trim() === '') {
          console.error('❌ Final message has no content:', JSON.stringify(finalMessage));
          return new Response(
            JSON.stringify({ error: 'AI did not generate a response' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        // Insert AI response into database
        const { error: insertError } = await supabaseAdmin
          .from('chat_messages')
          .insert({
            channel_id: channelId,
            owner_id: ownerId,
            sender_type: 'admin',
            sender_name: 'Smartbookly AI',
            content: finalMessage.content,
            message_type: 'text'
          });
        
        if (insertError) {
          console.error('❌ Failed to insert AI response:', insertError);
          return new Response(
            JSON.stringify({ error: 'Failed to save AI response' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        return new Response(
          JSON.stringify({ 
            success: true,
            content: finalMessage.content,
            toolCalls: message.tool_calls || []
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // No tool calls or direct response
    console.log('✅ Direct response (no tools)');
    
    // Insert AI response into database
    const { error: insertError } = await supabaseAdmin
      .from('chat_messages')
      .insert({
        channel_id: channelId,
        owner_id: ownerId,
        sender_type: 'admin',
        sender_name: 'Smartbookly AI',
        content: message.content,
        message_type: 'text'
      });
    
    if (insertError) {
      console.error('❌ Failed to insert AI response:', insertError);
      return new Response(
        JSON.stringify({ error: 'Failed to save AI response' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    return new Response(
      JSON.stringify({ 
        success: true,
        content: message.content,
        toolCalls: []
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ ai-chat error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
