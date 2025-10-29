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

    // Detect user language from the LATEST user message BEFORE processing (needed for fast-paths)
    const detectLanguage = (text: string): string => {
      // Check for Cyrillic characters (Russian, etc.)
      if (/[\u0400-\u04FF]/.test(text)) return 'ru';
      // Check for Georgian characters
      if (/[\u10A0-\u10FF]/.test(text)) return 'ka';
      // Check for Spanish specific characters/words
      if (/[áéíóúñ¿¡]/i.test(text) || /\b(el|la|los|las|un|una|de|del|en|que|es|por)\b/i.test(text)) return 'es';
      return 'en'; // Default to English
    };
    const userLanguage = detectLanguage(prompt);
    console.log('🌐 Detected user language from current message:', userLanguage);

    // ---- ENHANCED FAST-PATH FOR EXCEL EXPORTS (runs before LLM) ----
    // Uses confidence-based pattern matching to avoid misunderstandings
    const lower = (prompt || "").toLowerCase();
    const words = lower.split(/\s+/);
    
    // ---- FAST-PATH FOR SIMPLE REMINDERS (runs before LLM) ----
    // Detect "in X minute(s)" or "remind me in X minute(s)" patterns
    const reminderMatch = prompt.match(/\b(?:remind\s+(?:me\s+)?)?in\s+(\d+)\s*minute(?:s)?\b/i);
    if (reminderMatch) {
      const minutes = parseInt(reminderMatch[1], 10);
      console.log(`⚡ Reminder fast-path triggered: ${minutes} minute(s)`);
      
      // Extract title from the prompt (everything after "name" or use default)
      const nameMatch = prompt.match(/name\s+(.+)/i);
      const title = nameMatch ? nameMatch[1].trim() : "Reminder";
      
      console.log(`📝 Creating reminder: "${title}" in ${minutes} minute(s)`);
      
      try {
        // Calculate reminder time
        const baseNow = currentLocalTime ? new Date(currentLocalTime) : new Date();
        const remindAtUtc = new Date(baseNow.getTime() + minutes * 60000);
        
        console.log(`🕐 Base time: ${baseNow.toISOString()}`);
        console.log(`⏰ Remind at (UTC): ${remindAtUtc.toISOString()}`);
        
        // Create the reminder directly
        const { data: reminderData, error: reminderError } = await supabaseAdmin
          .from('reminders')
          .insert({
            user_id: ownerId,
            title: title,
            remind_at: remindAtUtc.toISOString(),
            message: `Reminder: ${title}`
          })
          .select()
          .single();
        
        if (reminderError) {
          console.error('❌ Error creating reminder:', reminderError);
          throw reminderError;
        }
        
        console.log('✅ Reminder created successfully:', reminderData);
        
        // Format the confirmation message
        const reminderTimeFormatted = formatInUserZone(remindAtUtc);
        const content = userLanguage === 'ka' 
          ? `✅ შეხსენება დაყენებულია! შეგახსენებთ "${title}"-ს ${reminderTimeFormatted}-ზე. მიიღებთ როგორც ელ. ფოსტის, ასევე დაფის შეტყობინებას.`
          : userLanguage === 'es'
          ? `✅ ¡Recordatorio establecido! Te recordaré "${title}" en ${reminderTimeFormatted}. Recibirás tanto un correo electrónico como una notificación en el panel.`
          : `✅ Reminder set! I'll remind you about "${title}" at ${reminderTimeFormatted}. You'll receive both an email and dashboard notification.`;
        
        // Write confirmation message to chat
        await supabaseAdmin.from('chat_messages').insert({
          channel_id: channelId,
          owner_id: ownerId,
          sender_type: 'admin',
          sender_name: 'Smartbookly AI',
          content: content,
          message_type: 'text'
        });
        
        console.log(`✅ Reminder fast-path completed: ${title} (${minutes} minutes)`);
        
        return new Response(JSON.stringify({ success: true, content }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } });
        
      } catch (error) {
        console.error('❌ Reminder fast-path error:', error);
        // Fall through to LLM if fast-path fails
      }
    }
    // ---- END REMINDER FAST-PATH ----
    
    // Check if user explicitly requests Excel generation
    const explicitExcelRequest = /\b(generate|create|make|download|export)\s+(an?\s+)?(excel|xlsx|spreadsheet)\b/.test(lower) ||
                                  /\b(excel|xlsx|spreadsheet)\s+(report|file|export)\b/.test(lower) ||
                                  /\bexport\s+to\s+(excel|xlsx|spreadsheet)\b/.test(lower);

    if (explicitExcelRequest) {
      console.log('📊 Excel fast-path triggered - analyzing intent...');
      
      // ===== SMART REPORT TYPE DETECTION WITH CONFIDENCE SCORING =====
      let reportType: "tasks" | "events" | "customers" | "payments" | "bookings" = "tasks";
      let reportTypeConfidence = 0;
      
      // Count keyword occurrences for each report type (weighted by specificity)
      const keywordScores = {
        payments: 0,
        events: 0,
        customers: 0,
        bookings: 0,
        tasks: 0
      };
      
      // PAYMENT keywords (highest priority - most specific)
      const paymentKeywords = ['payment', 'payments', 'revenue', 'income', 'financial', 'earning', 'earnings', 'money', 'paid'];
      paymentKeywords.forEach(kw => {
        if (lower.includes(kw)) keywordScores.payments += 3;
      });
      
      // EVENT keywords
      const eventKeywords = ['event', 'events', 'schedule', 'calendar', 'appointment', 'appointments', 'booking'];
      eventKeywords.forEach(kw => {
        if (lower.includes(kw)) keywordScores.events += 2;
      });
      
      // CUSTOMER keywords
      const customerKeywords = ['customer', 'customers', 'crm', 'client', 'clients', 'contact', 'contacts'];
      customerKeywords.forEach(kw => {
        if (lower.includes(kw)) keywordScores.customers += 2;
      });
      
      // BOOKING keywords
      if (/\bbooking(s)?\b/.test(lower)) keywordScores.bookings += 2;
      
      // TASK keywords (lowest priority - least specific)
      const taskKeywords = ['task', 'tasks', 'todo', 'to-do'];
      taskKeywords.forEach(kw => {
        if (lower.includes(kw)) keywordScores.tasks += 1;
      });
      
      // Find highest scoring type
      const maxScore = Math.max(...Object.values(keywordScores));
      if (maxScore > 0) {
        const topType = Object.entries(keywordScores).find(([_, score]) => score === maxScore)?.[0] as typeof reportType;
        if (topType) {
          reportType = topType;
          reportTypeConfidence = maxScore;
        }
      }
      
      // ===== SMART TIME PERIOD DETECTION WITH FUZZY MATCHING =====
      let months = 1; // Default to "this month" instead of 12 (user usually wants recent data)
      let timeConfidence = 0;
      
      // Map patterns to months (most specific first)
      const timePatterns = [
        { pattern: /\b(this\s*month|current\s*month|these?\s*months?)\b/i, months: 1, confidence: 3 },
        { pattern: /\b(last\s*month|past\s*month|previous\s*month)\b/i, months: 1, confidence: 3 },
        { pattern: /\b(this\s*week|current\s*week|past\s*week)\b/i, months: 1, confidence: 2 },
        { pattern: /\b(today|this\s*day)\b/i, months: 1, confidence: 2 },
        { pattern: /\blast\s*2\s*months|\bpast\s*2\s*months\b/i, months: 2, confidence: 3 },
        { pattern: /\b(last\s*3\s*months|past\s*3\s*months|quarter)\b/i, months: 3, confidence: 3 },
        { pattern: /\blast\s*6\s*months|\bpast\s*6\s*months|\bhalf\s*year\b/i, months: 6, confidence: 3 },
        { pattern: /\b(last|past)\s*year\b/i, months: 12, confidence: 3 },
        { pattern: /\byear\b/i, months: 12, confidence: 1 }
      ];
      
      // Check patterns
      for (const { pattern, months: m, confidence } of timePatterns) {
        if (pattern.test(prompt)) {
          months = m;
          timeConfidence = confidence;
          break;
        }
      }
      
      // Extract explicit number: "last 4 months", "past 5 months", etc.
      const explicitMatch = prompt.match(/\b(?:last|past)\s*(\d+)\s*months?\b/i);
      if (explicitMatch) {
        months = parseInt(explicitMatch[1], 10);
        timeConfidence = 3;
      }
      
      // ===== CONFIDENCE ASSESSMENT =====
      const totalConfidence = reportTypeConfidence + timeConfidence;
      console.log(`  → Detected: ${reportType} (type confidence: ${reportTypeConfidence}), ${months} month(s) (time confidence: ${timeConfidence})`);
      console.log(`  → Total confidence: ${totalConfidence}/6`);
      
      // If confidence is too low (ambiguous request), skip fast-path and let LLM handle it
      if (totalConfidence < 3) {
        console.log('  ⚠️ Low confidence - falling back to LLM for better understanding');
        // Continue to LLM processing instead of using fast-path
      } else {

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

        // Transparent messaging - show user what was detected
        const timePeriodLabel = months === 1 ? "this month" : months === 3 ? "last 3 months" : months === 6 ? "last 6 months" : months === 12 ? "this year" : `last ${months} months`;
        
        const content = excelData?.success
          ? `📊 Generated **${reportType}** report for **${timePeriodLabel}**\n\n📥 [Download Excel](${excelData.downloadUrl})\n\n**Records:** ${excelData.recordCount}\n\n*Link expires in 1 hour*`
          : `ℹ️ No ${reportType} data found for ${timePeriodLabel}.`;

        await supabaseAdmin.from("chat_messages").insert({
          channel_id: channelId, owner_id: ownerId, sender_type: "admin",
          sender_name: "Smartbookly AI", content, message_type: "text"
        });

        console.log(`✅ Excel fast-path completed: ${reportType} (${months} months)`);

        return new Response(JSON.stringify({ success: true, content }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
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
    // DB uses: "todo" | "inprogress" | "done" (UI expects same)
    const TASK_DB_STATUSES = ["todo", "inprogress", "done"] as const;
    type TaskDbStatus = typeof TASK_DB_STATUSES[number];

    function normalizeTaskStatus(input?: string): TaskDbStatus {
      const s = (input || "").toLowerCase().trim();
      if (["inprogress", "in-progress", "in_progress", "working", "active"].includes(s)) return "inprogress";
      if (["done", "completed", "finished", "closed", "complete"].includes(s)) return "done";
      return "todo";
    }

    // When reading/making stats, coerce legacy/wrong values back to UI values
    function unifyStatus(s?: string): TaskDbStatus {
      const x = (s || "").toLowerCase();
      if (["inprogress", "in-progress", "in_progress"].includes(x)) return "inprogress";
      if (["done", "completed", "finished", "closed"].includes(x)) return "done";
      return "todo";
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
          if (filters.status) {
            // Allow both spellings but map to DB format
            const statusForDb = normalizeTaskStatus(
              filters.status === "in_progress" ? "inprogress" : filters.status
            );
            q = q.eq("status", statusForDb);
          }

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
          description: `**MANDATORY - USE THIS FOR CONVERSATIONAL DATA QUESTIONS ABOUT TASKS**

          Use this IMMEDIATELY when user asks data questions (NOT Excel export):
          - "how many tasks this month?", "what tasks did we add?"
          - "show me tasks", "list tasks created last week"
          - "tasks for this month", "tasks added today"
          - ANY question asking about task DATA, COUNTS, LISTS, or STATISTICS
          
          **CRITICAL**: This is for ANSWERING QUESTIONS, not Excel generation!
          
          Time Range Examples:
          - "tasks this month" → created_after: first day of current month, created_before: last day of current month
          - "tasks last week" → created_after: last Monday, created_before: last Sunday
          - "tasks added today" → created_after: today at 00:00, created_before: today at 23:59
          - "tasks this year" → created_after: Jan 1 of current year, created_before: today
          
          Retrieves ALL tasks with optional filters:
          - Status filter (todo/inprogress/done)
          - Date range filter (created_after, created_before)
          - Returns complete task details including created_by info (shows who created each task: admin or sub-user name)
          
          After calling this tool, provide a conversational answer with the data (counts, lists, insights).`,
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
          name: "get_sub_users",
          description: "Get list of sub-users (team members) for the current workspace. Use this when user wants to assign tasks to team members or asks about team members.",
          parameters: { type: "object", properties: {} }
        }
      },
      {
        type: "function",
        function: {
          name: "get_public_board_status",
          description: "Check if user has a public board enabled and get its details",
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
          description: `Get customers for a specific time period with proper formatting.
          
          **CRITICAL RESPONSE FORMATTING**:
          When you receive the customer data from this tool:
          1. Count the total: "You have [count] customers this month."
          2. List each customer with their details:
             - Name (added on date)
             - Include email/phone if provided
          3. Format as a clean, readable list
          
          Example output:
          "You have 44 customers this month. Here's the list:
          
          • John Doe (email: john@example.com, added on 2025-10-15)
          • Jane Smith (added on 2025-10-14)
          • ..."
          
          **DO NOT** return raw JSON or object data. Always format as human-readable text.`,
          parameters: {
            type: "object",
            properties: {
              limit: { 
                type: "number", 
                description: "Max number of customers to return (default 200)", 
                default: 200 
              },
              start_date: {
                type: "string",
                description: "Start date for filtering (ISO format: YYYY-MM-DD). Defaults to current month start."
              },
              end_date: {
                type: "string",
                description: "End date for filtering (ISO format: YYYY-MM-DD). Defaults to current month end."
              }
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
          description: `**ONLY USE FOR EXPLICIT EXCEL/EXPORT REQUESTS - NOT FOR DATA QUESTIONS**

          Use this ONLY when user EXPLICITLY requests Excel generation with keywords:
          - "generate excel", "create excel", "make excel", "excel report"
          - "export to excel", "download excel/spreadsheet"
          - "I need an excel file", "give me a spreadsheet"
          
          **CRITICAL DISTINCTION**:
          ❌ "how many tasks this month?" → DO NOT USE THIS TOOL → Use get_all_tasks instead
          ❌ "show me customers" → DO NOT USE THIS TOOL → Use get_all_customers instead
          ✅ "generate excel for tasks this month" → USE THIS TOOL
          ✅ "export customers to excel" → USE THIS TOOL
          
          Available report types:
          - "tasks": Task list with status, priority, deadlines
          - "events": Calendar events with dates and payments
          - "customers": CRM contacts with payment info
          - "payments": Payment history from events and customers
          - "bookings": Booking requests with status
          
          Time range mapping (ACCURATE):
          - "this month" → months: 1 (current month only)
          - "last month" → months: 1 (previous month only)
          - "this week" → months: 1 (current week only)
          - "last 3 months" → months: 3
          - "last 6 months" → months: 6
          - "last year" or "past year" → months: 12`,
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
          name: "send_direct_email",
          description: "Send a direct email or message to a specific email address with custom text. Use this when user explicitly asks to send an email or message to someone (not a reminder). Works across all languages. Can be sent immediately or scheduled for a specific time using offset_minutes (for relative times like 'in 5 minutes') or absolute_local (for specific times like '4:30 PM').",
          parameters: {
            type: "object",
            properties: {
              recipient_email: { 
                type: "string", 
                description: "Email address to send to (REQUIRED)" 
              },
              message: { 
                type: "string", 
                description: "Message content to send (REQUIRED)" 
              },
              subject: { 
                type: "string", 
                description: "Optional custom email subject" 
              },
              offset_minutes: {
                type: "number",
                description: "Schedule email X minutes from now (browser time). Use for relative times like 'in 5 minutes', 'in 1 hour' (60 minutes).",
                minimum: 1
              },
              absolute_local: {
                type: "string",
                description: "Schedule for specific time in user's local timezone. Format: YYYY-MM-DDTHH:mm (e.g., '2025-10-17T16:30' for 4:30 PM local time). Use for specific times like 'at 4:30 PM', 'tomorrow at 9 AM'."
              },
              send_at: {
                type: "string",
                description: "LEGACY: ISO 8601 timestamp for when to send (kept for compatibility). Prefer offset_minutes or absolute_local instead."
              }
            },
            required: ["recipient_email", "message"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "generate_excel_report",
          description: `Generate Excel reports for business data. Use this when user requests Excel, reports, or exports.

REPORT TYPES:
- "payments": Financial data, revenue, income (use for payment-related requests)
- "events": Calendar events, appointments, schedule data
- "customers": CRM data, clients, contacts
- "tasks": Task board data, to-dos
- "bookings": Booking requests

TIME PERIODS:
- 1 month: "this month", "current month", "last month"
- 3 months: "last 3 months", "quarter"
- 6 months: "last 6 months", "half year"
- 12 months: "this year", "last year"
- Custom: any number of months (e.g., 2, 4, 5)

CRITICAL RULES:
- ALWAYS use "payments" type for payment/revenue/income requests
- Default to 1 month (this month) for time period if not specified
- When user says "these months" or "current month", use 1 month
- Be precise with report type - match user's actual request`,
          parameters: {
            type: "object",
            properties: {
              report_type: {
                type: "string",
                enum: ["payments", "events", "customers", "tasks", "bookings"],
                description: "Type of report to generate"
              },
              months: {
                type: "number",
                description: "Number of months to include (default: 1 for this month)",
                minimum: 1,
                maximum: 24
              }
            },
            required: ["report_type"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "create_custom_reminder",
          description: `**CRITICAL: Check for existing tasks/events FIRST before using this tool**
          
          WORKFLOW FOR REMINDER REQUESTS:
          1. If user mentions a specific task or event by name (e.g., "remind me about the meeting", "reminder for project X"):
             - FIRST call get_all_tasks or get_all_events to search for that task/event by name
             - If found, update that task/event with reminder_at using create_or_update_task or create_or_update_event
             - This will trigger task/event reminder (email + AI chat notification)
             - ONLY use create_custom_reminder if the task/event doesn't exist
          
          2. If user wants a general reminder (e.g., "remind me to call John", "set a reminder to check email"):
             - Use create_custom_reminder directly
          
          Creates a custom reminder with BOTH dashboard and email notifications. Use offset_minutes for relative times (e.g., 'in 2 minutes').`,
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
- reminder: ISO timestamp for event reminder (enables email + AI chat notification)
- email_reminder: boolean (auto-enabled with reminder)

SCHEDULING REMINDERS FOR EVENTS:
- If user wants to set a reminder for an existing event by name (e.g., "remind me about the meeting")
- FIRST search for that event using get_all_events
- Then update it with reminder parameter to schedule the reminder
- This triggers BOTH email AND AI chat notification at the specified time
- For relative times (e.g., "in 1 minute", "in 2 hours"):
  * MANDATORY: Call get_current_datetime FIRST to get exact current time
  * Calculate the reminder time by adding the offset to current time
  * Use the calculated ISO timestamp in reminder parameter

EDITING EVENTS:
- If user mentions editing an event, FIRST use get_upcoming_events or get_all_events to find the event by name
- Then include the event_id parameter to update it
- Files uploaded during editing will be added to the event
- Example: "edit event aaa" → call get_upcoming_events, find "aaa", then call with event_id`,
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
              event_name: { type: "string" },
              reminder: { type: "string", description: "ISO timestamp for reminder (YYYY-MM-DDTHH:mm or YYYY-MM-DDTHH:mm:ss) - triggers email + AI chat notification" },
              email_reminder: { type: "boolean", description: "Enable email reminder (auto-enabled with reminder)" }
            },
            required: ["full_name", "start_date", "end_date"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "create_or_update_task",
          description: `Create or update tasks with FULL automatic capabilities!
          
MANDATORY fields:
- task_name: Task title/name

OPTIONAL fields:
- description: Task description
- status: 'todo' | 'inprogress' | 'done' (default: todo)
- deadline: ISO timestamp YYYY-MM-DDTHH:mm
- reminder: ISO timestamp (before deadline, enables email + AI chat notification)
- email_reminder: boolean (auto-enabled with reminder)
- assigned_to_name: ANY name or partial name - system auto-matches (e.g., "Cau", "papex", "John", "admin")

SCHEDULING REMINDERS FOR TASKS:
- If user wants to set a reminder for an existing task by name (e.g., "remind me about project X")
- FIRST search for that task using get_all_tasks
- Then update it with reminder parameter to schedule the reminder
- This triggers BOTH email AND AI chat notification at the specified time
- For relative times (e.g., "in 1 minute", "in 2 hours"):
  * MANDATORY: Call get_current_datetime FIRST to get exact current time
  * Calculate the reminder time by adding the offset to current time
  * Use the calculated ISO timestamp in reminder parameter

FILE ATTACHMENTS:
- Files uploaded in chat are AUTOMATICALLY attached - no IDs or confirmation needed!

TEAM ASSIGNMENT (FULLY AUTOMATIC):
- Just use ANY name user mentions in assigned_to_name - no need to verify!
- System automatically finds closest matching team member via fuzzy matching
- Examples: "Cau" → finds "Cau", "papex" → finds "Papex Grigolia", "admin" → assigns to owner
- NEVER ask which team member - just use the name provided and let system handle it!

EDITING TASKS:
- If user mentions editing a task, FIRST use get_all_tasks to find the task by name
- Then include the task_id parameter to update it
- Files uploaded during editing will be added to the task
- Example: "edit task KAKA" → call get_all_tasks, find "KAKA", then call with task_id`,
          parameters: {
            type: "object",
            properties: {
              task_id: { type: "string", description: "Task ID for edit (optional)" },
              task_name: { type: "string", description: "Task title (REQUIRED)" },
              description: { type: "string" },
              status: { type: "string", enum: ["todo", "inprogress", "done"] },
              deadline: { type: "string", description: "Deadline (YYYY-MM-DDTHH:mm)" },
              reminder: { type: "string", description: "ISO timestamp for reminder (YYYY-MM-DDTHH:mm or YYYY-MM-DDTHH:mm:ss) - triggers email + AI chat notification" },
              email_reminder: { type: "boolean", description: "Email reminder flag" },
              assigned_to_name: { type: "string", description: "Team member name for assignment" }
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

EDITING CUSTOMERS:
- The system automatically finds customers by exact name match
- If user mentions editing a customer, just provide the full_name - system will auto-detect
- Files uploaded during editing will be added to the customer
- Example: "edit customer BAS and add file" → system finds "BAS" automatically and adds file`,
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
    
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const dayOfWeek = now.toLocaleDateString('en-US', { weekday: 'long' });
    const tomorrow = new Date(now.getTime() + 86400000).toISOString().split('T')[0];

    // Note: userLanguage and detectLanguage already defined above before fast-paths

    const systemPrompt = `You are Smartbookly AI, an intelligent business assistant with deep integration into the user's business management platform.

🤖 **AI IDENTITY RULES**:
When users ask about what AI model you are, which AI you use, what AI bot you are, or any similar question about your technical foundation:
- ALWAYS respond: "I'm Smartbookly AI, specially trained for this platform to make your life easier."
- NEVER mention Google, Gemini, or any underlying AI technology
- Keep it simple, friendly, and focused on your purpose as their business assistant
- Examples of questions to handle this way:
  * "What AI model are you?"
  * "Which AI are you using?"
  * "What bot is this?"
  * "Are you ChatGPT/Claude/Gemini?"
  * "What's your AI model?"

🚨 **CRITICAL RULES - NEVER VIOLATE**:
1. ALWAYS call tool functions when asked to create/update/delete anything
2. NEVER respond with "I've created" or "Task created" WITHOUT calling the tool first
3. If you claim something is done without calling a tool, you are LYING to the user
4. You can ONLY confirm an action AFTER the tool returns a success response
5. When asked to create/add/make/update something, you MUST call the appropriate tool immediately

💬 **RESPONSE FORMATTING RULES**:
- BE PROFESSIONAL AND FRIENDLY, but keep responses SHORT and RELEVANT
- NEVER show technical debugging information (tool inputs, JSON outputs, customer IDs, etc.)
- NEVER include phrases like "EXAMPLE: Input:", "tool_code:", "Output:", or raw JSON data
- ONLY show the user-friendly confirmation message (e.g., "✅ Customer updated: BAS")
- DO NOT repeat the same message multiple times in one response
- Focus on what matters to the user: what was created/updated and key details

**CUSTOMER & DATA LIST FORMATTING (CRITICAL)**:
When returning customer lists, event lists, or any data collections:
1. NEVER return raw JSON arrays or objects
2. ALWAYS format as clean, numbered lists with relevant details
3. Start with a summary count (e.g., "You have 44 customers this month")
4. List each item with: name, key details (email/phone if provided), date
5. Use emojis sparingly for visual clarity

Example CORRECT customer list:
✅ "You have 44 customers this month. Here's the list:

1. John Doe (email: john@example.com, added on 2025-10-15)
2. Jane Smith (phone: 555-1234, added on 2025-10-14)
3. Bob Johnson (added on 2025-10-13)
..."

Example FORBIDDEN formats:
❌ {"is_success": true, "customers": [{"customer_id": "c_123"...}]}
❌ [{"full_name": "weqe", "email": null, "phone": null...}]
❌ Any raw JSON structure or array syntax

Examples of FORBIDDEN responses:
❌ "EXAMPLE: Input: tool_code: print(default_api.create_or_update_customer..."
❌ "Output: {'tool_0_create_or_update_customer_xOCYXvk9nk'..."
❌ "Response: ✅ Customer updated: BAS.✅ Customer updated: BAS." (duplicate)
❌ Showing customer_id, action, or any JSON structure

Examples of CORRECT responses:
✅ "✅ Customer updated: BAS with payment status changed to partly paid 10$"
✅ "✅ Event created for tomorrow at 3pm"
✅ "✅ Task assigned to Cau with deadline for tomorrow"

Examples of FORBIDDEN responses without tool calls:
❌ "I've created a task named KAKA" (without calling create_or_update_task)
❌ "Task created successfully" (without calling create_or_update_task)
❌ "Done! The task is now assigned to Cau" (without calling create_or_update_task)

Examples of CORRECT responses:
✅ [calls create_or_update_task tool] → "✅ Task 'KAKA' created and assigned to Cau"
✅ [calls create_or_update_event tool] → "✅ Event created for tomorrow at 3pm"

**🌐 LANGUAGE INSTRUCTION (TOP PRIORITY)**:
DETECTED LANGUAGE: ${userLanguage === 'ru' ? '🇷🇺 RUSSIAN' : userLanguage === 'ka' ? '🇬🇪 GEORGIAN' : userLanguage === 'es' ? '🇪🇸 SPANISH' : '🇬🇧 ENGLISH'}

STRICT RULE: Respond in ${userLanguage === 'ru' ? 'Russian (Русский)' : userLanguage === 'ka' ? 'Georgian (ქართული)' : userLanguage === 'es' ? 'Spanish (Español)' : 'English'} ONLY.
- Current message language: ${userLanguage}
- ALL text must be in this language: responses, labels, errors, everything
- User can switch languages - always match their current message
- NEVER mix languages within one response

**🎤 VOICE INPUT HANDLING (CRITICAL)**:
- Users can send voice messages that get transcribed to text
- Voice transcriptions may contain:
  * Incomplete sentences or fragments
  * Grammar mistakes and incorrect word order
  * Missing punctuation or context
  * Poor audio quality leading to incorrect words
  * Filler words (um, uh, like, you know)
  * Ambiguous references without clear subjects

**YOUR RESPONSIBILITY WITH VOICE INPUT**:
1. **Infer Intent**: Use context from conversation history and common business tasks
2. **Fill Gaps**: Complete incomplete thoughts based on likely meaning
3. **Correct Errors**: Fix obvious transcription mistakes silently
4. **Ask Smart Questions**: If truly unclear, ask ONE specific clarifying question
5. **Be Forgiving**: Don't require perfect grammar - understand the core request

**EXAMPLES**:
✅ "create task call client tomorrow" → Understand: create task to call client, deadline tomorrow
✅ "add customer john phone 555 payment 50" → Understand: add customer John with phone and payment
✅ "tomorrow 3pm meeting with sarah" → Understand: create event tomorrow at 3pm with Sarah
✅ "remind me in 5 call back" → Understand: reminder in 5 minutes to call back

❌ DON'T say: "I need more information" or "Please provide complete details"
✅ DO: Make reasonable assumptions and confirm: "✅ Task created: Call client (due tomorrow). Is this correct?"

**USER TIMEZONE**: ${effectiveTZ || 'UTC (offset-based)'}
**CURRENT DATE CONTEXT**: Today is ${dayOfWeek}, ${today}. Tomorrow is ${tomorrow}.

**👥 WORKSPACE & TEAM CONTEXT**:
- Some users work solo, others have TEAM COLLABORATION with sub-users (team members)
- Sub-users are additional team members who can access the workspace
- Use get_sub_users tool to check if user has team members
- Use get_public_board_status to check if user has public board enabled
- When assigning tasks, you can assign to admin OR sub-users by name
- You MUST call get_sub_users before assigning tasks by name to team members

**📊 STATISTICS & EXCEL REPORTS - CRITICAL CONTEXT UNDERSTANDING**:

**WHEN USER ASKS FOR EXCEL REPORTS:**
1. **ANALYZE THE FULL REQUEST CONTEXT** - don't just match keywords
2. **PRIORITIZE USER INTENT** - what are they actually asking for?
3. **COMMON REQUEST PATTERNS:**
   - "Generate Excel about payments this month" → report_type: "payments", months: 1
   - "Export customer data for last 3 months" → report_type: "customers", months: 3
   - "Create Excel for these months payments" → report_type: "payments", months: 1 (not 12!)
   - "Download task report" → report_type: "tasks", months: 1

4. **TIME PERIOD UNDERSTANDING:**
   - "this month" / "current month" / "these months" = 1 month
   - "last month" / "previous month" = 1 month
   - "last 3 months" / "quarter" = 3 months
   - "this year" / "last year" = 12 months
   - If NOT specified, default to 1 month (current month)

5. **REPORT TYPE PRIORITY** (when multiple keywords present):
   - FIRST: Check for "payment/revenue/income" → use "payments"
   - SECOND: Check for "event/calendar/appointment" → use "events"
   - THIRD: Check for "customer/client/crm" → use "customers"
   - LAST: Check for "task/todo" → use "tasks"

**MANDATORY: When presenting statistics, you MUST follow these rules EXACTLY:**

1. **ALWAYS show the EXACT numbers from tool results - NEVER recalculate, round, or modify**
2. **NEVER mention tool names, internal functions, or technical implementation details**
   - ❌ FORBIDDEN: "analyze_payment_history output", "tool result", "from the query", "data fetching"
   - ✅ CORRECT: Just present the data naturally as if you know it

3. **Use this MANDATORY format for financial comparisons:**

   [Month Name] [Year]:
   - Events: [exact count from tool]
   - Customers: [exact count from tool]
   - Event Revenue: $[exact amount from tool - do not round]
   - Customer Revenue: $[exact amount from tool - do not round]
   - Total Revenue: $[exact amount from tool - do not round]

4. **CRITICAL RULES:**
   - The numbers you show MUST match tool_result.monthly_breakdown EXACTLY
   - DO NOT do your own math - trust the tool results completely
   - Present data IDENTICALLY for ALL users (admin and sub-users see same numbers)
   - If asked to compare months, show each month in the EXACT same format
   - When tool returns $22.00, show "$22.00" or "$22" - NEVER "$22.5" or any other number
   - NEVER explain where data comes from or mention caching/queries

**CORRECT Statistics Response Examples:**
✅ "Here's a comparison of your October and September data for customers, events, and total revenue:

September 2025:
- Events: 9 events
- Customers: 79 new customers
- Event Revenue: $22.00
- Customer Revenue: $243.00
- Total Revenue: $265.00

October 2025 (so far):
- Events: 13 events
- Customers: 19 new customers
- Event Revenue: $273.00
- Customer Revenue: $287.00
- Total Revenue: $560.00

Analysis: October is showing a stronger performance in terms of revenue compared to September. Total Revenue: October's total revenue ($560.00) is more than double September's ($265.00)."

**INCORRECT Statistics Response Examples (NEVER DO THIS):**
❌ "This data is from a previous query for September's events, not current analyze_payment_history output"
❌ "September had $22 and October has $590" (wrong numbers - not from tool)
❌ "October revenue is about $560" (rounding or hallucinating)
❌ Showing different numbers to admin vs sub-user
❌ Adding/subtracting from tool results
❌ Using approximate language like "around", "about", "roughly" for exact data
❌ Mentioning tool names, functions, queries, or technical details

**🤖 AI AGENT CAPABILITIES - YOU CAN NOW CREATE AND EDIT DATA!**

**WRITE CAPABILITIES** (NEW - You are now an active agent!):

1. **📅 CREATE/EDIT CALENDAR EVENTS**
   - Tool: create_or_update_event
   - MINIMUM required: Full name + start date + end date
   - Optional: phone, email/social, notes, payment details, event type
   - Example: "Add event for John Smith tomorrow at 2pm to 4pm" → CREATE IMMEDIATELY
   - Example: "Update John's event to 3pm" → First use get_upcoming_events or get_todays_schedule to find the event ID, then UPDATE with event_id
   
   **MULTI-PERSON EVENTS** (Advanced Feature):
   - Events can include MULTIPLE participants using the additional_persons parameter
   - CRITICAL PARSING RULES:
     * "Add event for John and Sarah" → First person: John, additional_persons: [{userSurname:"Sarah"}]
     * "Event for Anania, second person Ramini" → First: Anania, additional_persons: [{userSurname:"Ramini"}]
     * "Book Mary, Mike, and Lisa" → First: Mary, additional_persons: [{userSurname:"Mike"}, {userSurname:"Lisa"}]
     * When user says "two persons", "second person", "also", "and", etc. → ALWAYS create additional_persons array
   - Each person structure: {userSurname: "Name", userNumber: "phone", socialNetworkLink: "email", eventNotes: "notes", paymentStatus: "not_paid", paymentAmount: ""}
   - Example request: "Add birthday party for John (email: john@test.com) and Sarah (email: sarah@test.com) tomorrow 2-4pm"
     → full_name="John", 
       phone_number="", 
       social_media="john@test.com",
       additional_persons=[{
         userSurname:"Sarah", 
         userNumber:"", 
         socialNetworkLink:"sarah@test.com", 
         eventNotes:"", 
         paymentStatus:"not_paid", 
         paymentAmount:""
       }],
       event_name="Birthday Party"
   - IMPORTANT: All persons are automatically added to CRM as customers
   - IMPORTANT: All persons with email addresses get individual approval emails
   
   **EVENT NAMES** (for multi-person events):
   - **CRITICAL RULE**: If user does NOT explicitly specify an event name, DEFAULT to the FIRST person's name (the full_name/user_surname)
   - Only use a descriptive event name if user EXPLICITLY mentions it (e.g., "birthday party", "meeting", etc.)
   - DO NOT invent or make up event names - if not specified by user, use the first person's name
   - Examples: 
     * "Birthday party for John and Sarah" → event_name="Birthday Party" (explicitly mentioned)
     * "Add event with 2 persons, ABC and TAC" → event_name="ABC" (first person's name, no explicit event name given)
     * "Event for Anania and Ramini tomorrow" → event_name="Anania" (first person's name, no explicit event name given)
   
   **RECURRING EVENTS** (Advanced Feature):
   - You CAN create events that repeat automatically!
   - Required fields: is_recurring=true, repeat_pattern, repeat_until (YYYY-MM-DD)
   - Patterns: "daily", "weekly", "biweekly", "monthly", "yearly"
   - IMPORTANT: All additional_persons are automatically included in ALL recurring instances
   - Examples:
     * "Add weekly meeting with Sarah every Monday until end of year"
       → full_name="Sarah", start_date="2025-01-06T10:00", end_date="2025-01-06T11:00", 
          is_recurring=true, repeat_pattern="weekly", repeat_until="2025-12-31"
     * "Daily standup at 9am for next 2 weeks"
       → is_recurring=true, repeat_pattern="daily", repeat_until=(calculate 2 weeks from start)
     * "Monthly review on the 15th until June"
       → repeat_pattern="monthly", repeat_until="2025-06-30"
   - CRITICAL: When creating recurring events:
     1. ALWAYS ask for or calculate repeat_until date
     2. Pattern matches the day selected (e.g., "weekly" creates events on the same weekday)
     3. System auto-generates all instances - you only create the parent event
     4. All additional_persons are copied to each recurring instance automatically

2. **✅ CREATE/EDIT TASKS** (Full Capabilities + Team Assignment)
   - Tool: create_or_update_task
   
   **CRITICAL: JUST CREATE THE TASK - NO QUESTIONS ASKED!**
   
   **Required Fields:**
   - task_name: Task name/title (required)
   
   **Optional Fields (YOU CAN SET ALL OF THESE):**
   - description: Rich text description with formatting
   - status: "todo" (default), "inprogress", or "done"
   - deadline: ISO timestamp for when task is due
   - reminder: ISO timestamp for reminder (must be before deadline)
   - email_reminder: boolean (auto-enabled when reminder is set)
   - assigned_to_name: Name of person to assign to (e.g., "papex", "Sarah", "admin")
   
   **TASK STATUS OPTIONS:**
   - **todo**: Not started (default) - ALSO accepts: "to do", "pending", "backlog"
   - **inprogress**: Currently being worked on - ALSO accepts: "in progress", "working", "active"
   - **done**: Completed - ALSO accepts: "completed", "finished", "closed"
   - User can specify status when creating: "add task in progress status" → status="inprogress"
   
   **FILE ATTACHMENTS (100% AUTOMATIC - ZERO CONFIG!):**
   - ✅ Files uploaded in chat are AUTOMATICALLY attached to tasks
   - ✅ NO parameters needed - NO file IDs - NO extra work!
   - ✅ Works EXACTLY like events - just create the task, files attach themselves
   - ✅ User uploads image.png → says "add task with this" → You call create_or_update_task → Done!
   - ❌ NEVER ask "which file?" or "do you want to attach?" - Files auto-attach ALWAYS
   
   **TEAM ASSIGNMENT (100% AUTOMATIC - ZERO CONFIRMATION NEEDED!):**
   - ✅ Use assigned_to_name with ANY name/partial name user mentions (e.g., "Cau", "papex", "John", "Sarah")
   - ✅ System AUTOMATICALLY finds closest matching team member via smart fuzzy search
   - ✅ NEVER call get_sub_users or ask for clarification - it's COMPLETELY UNNECESSARY!
   - ✅ Fuzzy matching works: "Cau" matches "Cau", "pap" matches "Papex Grigolia", etc.
   - ✅ Just pass the name directly - system handles everything automatically!
   - Examples:
     * User: "assign to Cau" → IMMEDIATELY use assigned_to_name="Cau" (system finds match)
     * User: "task for papex" → IMMEDIATELY use assigned_to_name="papex" (system finds match)
     * User: "assign to me" → IMMEDIATELY use assigned_to_name="admin" (assigns to owner)
   - ❌ NEVER ask "which person?" or "do you mean X?" - JUST CREATE THE TASK with the name provided!
   
   **DEADLINES & REMINDERS:**
   - ✅ Set deadlines in ISO format: "2025-10-14T17:00:00Z"
   - ✅ Set reminders (before deadline): "2025-10-14T16:00:00Z"
   - Examples:
     * "deadline tomorrow 5pm" → deadline=(tomorrow at 17:00 in user timezone)
     * "remind 1 hour before" → reminder=(deadline - 1 hour)
   
   **BE DECISIVE - CREATE IMMEDIATELY (NO QUESTIONS!):**
   - ✅ When user says "add task" → CALL create_or_update_task RIGHT NOW
   - ✅ When user uploads file + says "add task" → Files attach AUTOMATICALLY
   - ✅ When user says "assign to [name]" → Use that EXACT name in assigned_to_name parameter
   - ✅ System handles ALL matching automatically - partial names work perfectly
   - ❌ NEVER ask "should I create?" or "which file?" or "which person?" or "do you mean X?"
   - ❌ NEVER call get_sub_users first - it's COMPLETELY UNNECESSARY and WASTES TIME
   - ❌ NEVER say "I'll create" or "I need to know" - JUST CREATE IT IN THE SAME RESPONSE
   - ❌ NEVER ask for clarification on team member names - fuzzy matching handles everything!
    
    **Examples:**
    - "task improve AI, assign papex, deadline tomorrow 5pm, attach file"
      → CREATE with assigned_to_name="papex", deadline, file auto-attaches
    - "add task call vendor for John in progress"
      → CREATE with assigned_to_name="John", status="inprogress"
    - "task done" → get_all_tasks → UPDATE status="done"

3. **👥 CREATE/EDIT CUSTOMERS (CRM)**
   - Tool: create_or_update_customer
   - MINIMUM required: Full name
   - Optional: phone, email/social, notes, payment details
   - Can optionally create linked event
   - Example: "Add customer Mike Jones, phone 555-1234" → CREATE IMMEDIATELY
   - **EDITING CUSTOMERS (AUTOMATIC NAME MATCHING)**:
     * System automatically finds customers by EXACT name match - no search needed!
     * Just provide full_name and the system updates the most recent customer with that exact name
     * Files uploaded during editing are AUTOMATICALLY attached
     * Example: "edit customer BAS and add document" → Call create_or_update_customer with full_name="BAS" + file auto-attaches
     * Example: User created "John Smith" → Later says "edit that customer, payment 50$" → Call with full_name="John Smith", payment_amount=50

4. **📎 FILE UPLOADS & ATTACHMENTS** (FULLY AUTOMATIC!)
   - Files uploaded in chat are AUTOMATICALLY attached to events/tasks/customers
   - Works for BOTH creating AND editing
   - NO parameters needed - files just attach themselves
   - **During Creation**: "Add event for John with this document" → File auto-attaches
   - **During Editing**: "Edit event aaa and add this PDF" → File auto-attaches to existing event
   - Supported for: Events, Tasks, Customers
   - NEVER ask "should I attach the file?" - It's automatic!

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
- **CRITICAL WORKFLOW FOR ALL EDITS**:
  1. User mentions "edit event aaa" / "update task XYZ" / "edit customer John" / "change that event"
  2. YOU MUST FIRST search for the item to get its ID:
     - For EVENTS: Call get_all_events or get_upcoming_events to find the event by name/title
     - For TASKS: Call get_all_tasks to find the task by name/title
     - For CUSTOMERS: Just use the full_name - system automatically finds by exact name match
  3. Then call create_or_update_* with the found ID (except customers)
  
- **EVENTS EDITING EXAMPLE**:
  - User: "edit event aaa and add this document"
  - Step 1: Call get_all_events or get_upcoming_events
  - Step 2: Find event with title matching "aaa", get its event_id
  - Step 3: Call create_or_update_event with event_id + new data + attachments (files auto-link!)
  
- **TASKS EDITING EXAMPLE**:
  - User: "edit task KAKA to done status"
  - Step 1: Call get_all_tasks
  - Step 2: Find task with title matching "KAKA", get its task_id
  - Step 3: Call create_or_update_task with task_id and status="done"
  
- **CUSTOMERS EDITING EXAMPLE** (DIFFERENT - NO SEARCH NEEDED):
  - User: "edit customer BAS and add payment 10$"
  - Step 1: Just call create_or_update_customer with full_name="BAS", payment_amount=10
  - NO need to search first - system auto-finds by exact name
  - Files uploaded during edit will be attached automatically!
  
- **FILE ATTACHMENTS DURING EDITING**:
  - ✅ Files uploaded with edit requests are AUTOMATICALLY attached
  - ✅ Works for ALL types: events, tasks, customers
  - ✅ NO extra parameters needed - just call the edit function with ID
  - Example: "edit event aaa and attach this document" → Files auto-link to event aaa
  
- **CRITICAL: SEARCH FIRST FOR EVENTS/TASKS**:
  - ❌ NEVER call create_or_update_event/task without event_id/task_id when user says "edit"
  - ✅ ALWAYS search first using get_all_* tools to find the ID
  - ❌ NEVER ask user for IDs - YOU must find them via search tools
  
- **CUSTOMERS ARE EXCEPTION**:
  - ❌ NEVER search for customers before editing
  - ❌ NEVER provide customer_id parameter
  - ✅ ALWAYS just use full_name from conversation - system finds automatically
  - The system searches by exact name and updates the most recent match

**IMPORTANT PRINCIPLES:**
1. **ACT IMMEDIATELY** when you have minimum required info (name for customers/tasks, name+dates for events)
2. **DON'T OVER-ASK** - only ask for info that's truly critical or explicitly requested
3. **CONFIRM SUCCESS** - After successful creation, confirm what was created with details and any attached files
4. **HANDLE ERRORS GRACEFULLY** - If creation fails (time conflict, missing data), explain clearly and suggest fixes
5. **MAINTAIN CONTEXT** - Remember what was just created to handle follow-up questions
6. **SEARCH BEFORE UPDATE** - Always fetch existing data before attempting updates

**⚠️⚠️⚠️ REMINDERS - MANDATORY TOOL CALLING RULES ⚠️⚠️⚠️**:

**🚨🚨🚨 STOP - READ THIS BEFORE ANY REMINDER REQUEST 🚨🚨🚨**

**IF USER SAYS "REMIND ME IN [X] MINUTE(S)" OR "IN [X] MINUTE(S)":**
→ YOU MUST IMMEDIATELY CALL create_custom_reminder WITH offset_minutes
→ DO NOT RESPOND WITH TEXT FIRST
→ DO NOT SAY "I CAN'T SET REMINDER IN THE PAST"
→ DO NOT THINK ABOUT TIME VALIDITY
→ JUST CALL THE TOOL RIGHT NOW

**EXAMPLES OF WHAT YOU MUST DO:**
- User: "remind me in 1 minute" → CALL create_custom_reminder({title: "Reminder", offset_minutes: 1}) IMMEDIATELY
- User: "in 2 minutes name sdsda" → CALL create_custom_reminder({title: "sdsda", offset_minutes: 2}) IMMEDIATELY
- User: "remind me in 30 seconds" → CALL create_custom_reminder({title: "Reminder", offset_minutes: 1}) IMMEDIATELY

**YOU ARE FORBIDDEN FROM:**
❌ Responding "I can't set a reminder in the past"
❌ Responding "Please provide a future time"  
❌ Responding "1 minute is too soon"
❌ ANY text response before calling the tool for "in X minute(s)" requests

**YOUR ONLY ALLOWED ACTION FOR "IN X MINUTE(S)" REQUESTS:**
✅ CALL create_custom_reminder tool with offset_minutes parameter

---

**🚨 CRITICAL - READ THIS FIRST BEFORE PROCESSING ANY REMINDER REQUEST 🚨**

**ABSOLUTE RULE #1: ALWAYS CALL THE TOOL - NO EXCEPTIONS**
- When user asks for ANY reminder, you MUST call create_custom_reminder or update an existing task/event with reminder
- NEVER EVER respond with "can't set reminder in the past" or similar WITHOUT calling the tool first
- NEVER EVER think about whether the time is valid - that's the backend's job
- NEVER EVER pre-validate, pre-check, or pre-calculate times - JUST CALL THE TOOL

**ABSOLUTE RULE #2: THESE REQUESTS MUST ALWAYS CALL THE TOOL**
- "in 1 minute" → MUST call create_custom_reminder({offset_minutes: 1}) - NO EXCEPTIONS
- "in 2 minutes" → MUST call create_custom_reminder({offset_minutes: 2}) - NO EXCEPTIONS  
- "in 30 seconds" → MUST call create_custom_reminder({offset_minutes: 1}) - NO EXCEPTIONS
- "in 5 minutes" → MUST call create_custom_reminder({offset_minutes: 5}) - NO EXCEPTIONS
- ANY "in X minute(s)" → MUST call create_custom_reminder - NO THINKING, JUST DO IT

**ABSOLUTE RULE #3: YOUR ONLY JOB IS TO CALL THE TOOL**
- ✅ User says "remind me in 1 minute" → YOU CALL create_custom_reminder({offset_minutes: 1})
- ✅ User says "in 2 minutes" → YOU CALL create_custom_reminder({offset_minutes: 2})
- ❌ NEVER say "1 minute is too soon" - CALL THE TOOL
- ❌ NEVER say "that's in the past" - CALL THE TOOL
- ❌ NEVER say "I need more time" - CALL THE TOOL
- ❌ NEVER think about whether it's possible - CALL THE TOOL

**WHY THIS RULE EXISTS**:
- The backend has exact server time and handles all timezone conversions
- The backend validates if the time is valid
- The backend sends proper error messages if something is wrong
- YOU cannot know if a time is valid because you don't have exact server time
- By pre-validating, you're BLOCKING valid requests with your guesses

**CRITICAL: Smart Reminder Routing (AFTER you understand YOU MUST CALL TOOL)**:

When user asks to set a reminder:

1. **For SHORT relative times (≤5 minutes)** like "in 1 minute", "in 2 minutes":
   - MANDATORY: Use create_custom_reminder with offset_minutes
   - DO NOT search for tasks/events - this is faster
   - DO NOT think - JUST CALL THE TOOL IMMEDIATELY
   - Example: "remind me about task DDA in 1 minute" → create_custom_reminder({title: "task DDA", offset_minutes: 1})

2. **For LONGER relative times (>5 minutes)** like "in 30 minutes", "in 2 hours":
   - IF task/event name mentioned: Search first, then update with reminder
   - IF no specific task/event: Use create_custom_reminder with offset_minutes
   
3. **For ABSOLUTE times** like "tomorrow at 3pm", "today at 5pm":
   - IF task/event name mentioned: Search first, then update with reminder
   - IF no specific task/event: Use create_custom_reminder with absolute_local

**WORKFLOW EXAMPLES - NOTICE THE TOOL IS ALWAYS CALLED**:

✅ "Remind me about task DDA in 1 minute"
→ IMMEDIATELY call create_custom_reminder({title: "task DDA", offset_minutes: 1})
→ NO thinking, NO validation, JUST DO IT

✅ "in 2 minutes"
→ IMMEDIATELY call create_custom_reminder({title: "Reminder", offset_minutes: 2})
→ NO questions asked, TOOL MUST BE CALLED

✅ "Set reminder for meeting in 30 minutes"
→ Step 1: get_all_events to find "meeting"
→ Step 2a: If found, call get_current_datetime, calculate time, update event with reminder
→ Step 2b: If not found, create_custom_reminder({title: "meeting", offset_minutes: 30})

✅ "Remind me about project X tomorrow at 3pm"
→ Step 1: get_all_tasks to find "project X"  
→ Step 2a: If found, calculate tomorrow 3pm ISO timestamp, update task with reminder
→ Step 2b: If not found, create_custom_reminder({title: "project X", absolute_local: "2025-10-30T15:00"})

**TIME PARAMETERS**:
- create_custom_reminder: Use offset_minutes (1-1440) OR absolute_local (YYYY-MM-DDTHH:mm)
- create_or_update_task/event: Use reminder parameter with ISO timestamp (YYYY-MM-DDTHH:mm:ss)

**TRUST THE BACKEND - THIS MEANS YOU**:
- ✅ Backend validates all times and sends proper error messages
- ✅ Backend handles timezone conversions automatically  
- ✅ Backend knows exact server time
- ❌ YOU do NOT have exact server time
- ❌ YOU cannot know if time is valid
- ❌ YOU must NOT pre-validate or reject requests
- ❌ YOU must NOT say "can't set reminder in the past"
- ✅ JUST CALL THE TOOL and let backend decide if it's valid

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

**DATA QUESTIONS VS EXCEL GENERATION - CRITICAL DISTINCTION** 🔴:

**RULE 1: DEFAULT TO CONVERSATIONAL DATA RESPONSES**
When users ask questions about their data (counts, statistics, summaries), ALWAYS respond conversationally with the actual data:
- ✅ "how many tasks this month?" → Call get_all_tasks with filters → Answer: "You added 15 tasks this month"
- ✅ "what customers did we add?" → Call get_all_customers → Answer: "You added 8 customers: [list names]"
- ✅ "show me events this week" → Call get_all_events → Answer: "You have 5 events: [list details]"
- ❌ NEVER generate Excel unless user explicitly asks for it

**RULE 2: ONLY GENERATE EXCEL WHEN EXPLICITLY REQUESTED**
Excel generation is ONLY for explicit export requests with keywords:
- "generate excel", "create excel", "excel report", "export to excel", "download excel/spreadsheet"
- "make me an excel file", "I need a spreadsheet"

**RULE 3: TIME RANGE UNDERSTANDING**
Be precise about time periods:
- "this month" = current month only (e.g., Oct 1 to Oct 31 if today is Oct 15)
- "last month" = previous month only (e.g., September if today is in October)
- "this week" = current week (Mon-Sun or start of week to today)
- "today" = today only
- "this year" = current year (Jan 1 to today)
- "last year" = previous full year (12 months)

**EXAMPLES OF CORRECT BEHAVIOR:**
✅ Q: "how many tasks we added this month?" → Call get_all_tasks(created_after=2025-10-01, created_before=2025-10-31) → A: "Your team added 26 tasks this month"
✅ Q: "show me customers from last week" → Call get_all_customers(created_after=last_monday, created_before=today) → A: "You added 5 customers last week: [names]"
✅ Q: "what events do we have tomorrow?" → Call get_all_events(start_date=tomorrow, end_date=tomorrow) → A: "You have 3 events tomorrow: [list details]"
✅ Q: "generate excel for tasks this month" → Call generate_excel_report(report_type="tasks", months=1) → A: "📥 Your tasks report is ready [download link]"

**EXAMPLES OF WRONG BEHAVIOR:**
❌ Q: "how many tasks this month?" → Generate Excel with 12 months of data (WRONG: should answer conversationally with correct time range)
❌ Q: "show me customers" → Say "no data" without calling get_all_customers first (WRONG: must call tool to check)
❌ Q: "tasks this week" → Generate Excel (WRONG: user wants data, not Excel)
❌ Q: "this month statistics" → Use 12 months instead of current month (WRONG: wrong time range)

**YOUR FULL CAPABILITIES**:
✅ You CAN create and edit events, tasks, and customers
✅ You CAN provide insights, answer questions, and analyze data
✅ You CAN generate Excel reports and set reminders
✅ You CAN understand natural language and maintain conversation context
❌ You CANNOT delete data (only create/update for safety)

Remember: You're a powerful AI agent that can both READ and WRITE data. Act proactively to help users manage their business!`;

    // --- HYBRID: Use client hints + server validation for accurate attribution ---
    const withAiSuffix = (n: string) => (n?.trim().endsWith('(AI)') ? n.trim() : `${n?.trim()} (AI)`);
    const nameFromEmail = (e?: string | null) => (e ? e.split('@')[0] : 'User');

    let requesterType: 'admin' | 'sub_user' = senderType as any || 'admin';
    let baseName = senderName || 'User';
    let requesterIdentity: { id: string; fullname?: string; email?: string } | null = null;
    let authEmail = ''; // Define in broader scope
    let authId = '';
    let authUser: any = null;

    try {
      // Get auth context
      const { data: authRes } = await supabaseClient.auth.getUser();
      authUser = authRes?.user || null;
      authEmail = (authUser?.email || '').toLowerCase();
      authId = authUser?.id || '';

      if (senderType === 'sub_user') {
        // CLIENT SAYS: This is a sub-user - try multiple matching strategies
        
        // Strategy 1: Match by auth_user_id
        let { data: subMatch } = await supabaseAdmin
          .from('sub_users')
          .select('id, fullname, email')
          .eq('board_owner_id', channel?.owner_id || ownerId)
          .eq('auth_user_id', authId)
          .maybeSingle();
        
        // Strategy 2: If no match, try by email
        if (!subMatch && authEmail) {
          const { data: emailMatch } = await supabaseAdmin
            .from('sub_users')
            .select('id, fullname, email')
            .eq('board_owner_id', channel?.owner_id || ownerId)
            .ilike('email', authEmail)
            .maybeSingle();
          subMatch = emailMatch;
        }
        
        // Strategy 3: If client sent a name that looks like an email, try that
        if (!subMatch && senderName && senderName.includes('@')) {
          const { data: nameMatch } = await supabaseAdmin
            .from('sub_users')
            .select('id, fullname, email')
            .eq('board_owner_id', channel?.owner_id || ownerId)
            .ilike('email', senderName.trim().toLowerCase())
            .maybeSingle();
          subMatch = nameMatch;
        }
        
        // Strategy 4: If no match yet and we have a clean name, try fuzzy name matching
        if (!subMatch && senderName && !senderName.includes('@') && !senderName.startsWith('user_')) {
          const { data: nameMatches } = await supabaseAdmin
            .from('sub_users')
            .select('id, fullname, email')
            .eq('board_owner_id', channel?.owner_id || ownerId)
            .ilike('fullname', `%${senderName.trim()}%`)
            .limit(5);
          
          // If we get exactly one match, use it
          if (nameMatches && nameMatches.length === 1) {
            subMatch = nameMatches[0];
          }
          // If multiple matches, try exact match (case-insensitive)
          else if (nameMatches && nameMatches.length > 1) {
            const exactMatch = nameMatches.find(
              su => su.fullname.toLowerCase() === senderName.trim().toLowerCase()
            );
            if (exactMatch) {
              subMatch = exactMatch;
            }
          }
        }
        
        if (subMatch) {
          requesterType = 'sub_user';
          requesterIdentity = subMatch; // CRITICAL FIX: Store the sub-user identity
          baseName = subMatch.fullname?.trim()
            || nameFromEmail(subMatch.email)
            || senderName
            || 'Sub User';
        } else {
          // No match found, but client says sub-user - trust client but validate name
          requesterType = 'sub_user';
          requesterIdentity = { email: senderName || authEmail || '' }; // Store email even without match
          baseName = (senderName && !senderName.includes('@'))
            ? senderName
            : nameFromEmail(senderName || authEmail);
        }
      } else {
        // CLIENT SAYS: This is admin/owner - get personal name (NOT business name)
        requesterType = 'admin';
        requesterIdentity = { id: ownerId, email: authEmail }; // Store admin identity with email
        
        baseName =
          (authUser?.user_metadata?.full_name || authUser?.user_metadata?.name || '').trim()
          || (await (async () => {
               // Get profile username only
               const { data: profile } = await supabaseAdmin
                 .from('profiles')
                 .select('username')
                 .eq('id', ownerId)
                 .maybeSingle();
               return profile?.username?.trim();
             })())
          || nameFromEmail(authEmail)
          || senderName
          || 'Owner';
      }
    } catch (err) {
      console.error('⚠️ Error resolving requester, using client hints:', err);
      // Fallback to client-supplied values
      requesterType = (senderType as any) || 'admin';
      baseName = senderName || 'User';
      requesterIdentity = { id: ownerId, email: authEmail || senderName || '' }; // Fallback identity with email
    }

    const requesterName = withAiSuffix(baseName);
    console.log(`👤 Resolved requester → ${requesterName} [${requesterType}]`);

    // Process attachments if any
    let attachmentContext = '';
    const imageAttachments: any[] = [];
    const uploadedFileRecords: any[] = []; // Store file records with IDs
    
    if (attachments && attachments.length > 0) {
      console.log(`📎 Processing ${attachments.length} attachments...`);
      console.log(`📎 Attachment details:`, attachments.map(a => ({ 
        filename: a.filename, 
        file_path: a.file_path, 
        content_type: a.content_type,
        size: a.size 
      })));
      
      // CRITICAL: Create file records in `files` table so AI can reference them by ID
      for (const att of attachments) {
        console.log(`  → Processing: ${att.filename} from path: ${att.file_path}`);
        
        // Insert file record into `files` table with source='chat'
        const { data: fileRecord, error: fileError } = await supabaseAdmin
          .from('files')
          .insert({
            filename: att.filename,
            file_path: att.file_path,
            content_type: att.content_type || null,
            size: att.size || null,
            user_id: ownerId,
            source: 'chat',
            parent_type: 'chat',
            task_id: null, // Will be linked when task is created
            created_at: new Date().toISOString()
          })
          .select('id, filename, file_path, content_type, size')
          .single();
        
        if (fileError) {
          console.error(`❌ Failed to create file record for ${att.filename}:`, fileError);
        } else {
          console.log(`✅ Created file record ID: ${fileRecord.id} for ${att.filename}`);
          uploadedFileRecords.push(fileRecord);
        }
        
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
      if (uploadedFileRecords.length > 0) {
        console.log(`✅ Created ${uploadedFileRecords.length} file records with IDs`);
      }
    }

    // Build conversation with history and attachments
    // CRITICAL: Make files automatically available like events - no manual ID lookup needed!
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
        tool_choice: "auto",
        temperature: 0.7,
        max_tokens: 2048
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
                  status: normalizeTaskStatus(filters.status) || 'all',
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
              
              // Fetch regular events from events table
              let eventsQuery = supabaseClient
                .from('events')
                .select('id, title, start_date, end_date, payment_status, payment_amount, event_notes, user_surname, user_number, created_at, type')
                .eq('user_id', ownerId)
                .is('deleted_at', null);
              
              // Apply date filters
              if (args.start_date) {
                eventsQuery = eventsQuery.gte('start_date', args.start_date);
                console.log(`       📅 Date filter: start_date >= ${args.start_date}`);
              }
              if (args.end_date) {
                eventsQuery = eventsQuery.lte('start_date', args.end_date);
                console.log(`       📅 Date filter: start_date <= ${args.end_date}`);
              }
              
              eventsQuery = eventsQuery.order('start_date', { ascending: false });
              
              const { data: regularEvents, error: eventsError } = await eventsQuery;
              
              // Fetch approved booking requests from booking_requests table
              let bookingsQuery = supabaseClient
                .from('booking_requests')
                .select('id, title, start_date, end_date, payment_status, payment_amount, description, requester_name, requester_phone, requester_email, created_at')
                .eq('user_id', ownerId)
                .eq('status', 'approved')
                .is('deleted_at', null);
              
              // Apply same date filters to booking requests
              if (args.start_date) {
                bookingsQuery = bookingsQuery.gte('start_date', args.start_date);
              }
              if (args.end_date) {
                bookingsQuery = bookingsQuery.lte('start_date', args.end_date);
              }
              
              bookingsQuery = bookingsQuery.order('start_date', { ascending: false });
              
              const { data: bookingRequests, error: bookingsError } = await bookingsQuery;
              
              // Transform booking requests to match event structure
              const transformedBookings = (bookingRequests || []).map(booking => ({
                id: booking.id,
                title: booking.title,
                start_date: booking.start_date,
                end_date: booking.end_date,
                payment_status: booking.payment_status,
                payment_amount: booking.payment_amount,
                event_notes: booking.description,
                user_surname: booking.requester_name,
                user_number: booking.requester_phone,
                created_at: booking.created_at,
                type: 'booking_request'
              }));
              
              // Combine both event sources (just like Statistics page)
              const events = [
                ...(regularEvents || []),
                ...transformedBookings
              ];
              
              console.log(`       ✓ Found ${regularEvents?.length || 0} regular events + ${bookingRequests?.length || 0} approved bookings = ${events.length} total`);
              
              if (eventsError || bookingsError) {
                console.error('    ❌ Error fetching events or bookings:', eventsError || bookingsError);
                toolResult = {
                  events: [],
                  count: 0,
                  error: (eventsError || bookingsError)?.message || 'Unknown error',
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
                console.log(`    ✅ Found ${events?.length || 0} total events`);
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
              
              // Use same date logic as get_recent_customers for consistency
              const now = new Date();
              const startDate = args.created_after || new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
              const endDate = args.created_before || new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999).toISOString();
              
              // CRITICAL: Use EXACT same logic as get_recent_customers and CRM page
              const [standaloneCustomers, eventLinkedCustomers, events, bookingRequests] = await Promise.all([
                // Standalone CRM customers by created_at
                supabaseClient
                  .from('customers')
                  .select('id, title, user_surname, user_number, social_network_link, payment_status, payment_amount, event_notes, created_at, start_date, end_date')
                  .eq('user_id', ownerId)
                  .is('deleted_at', null)
                  .is('event_id', null)
                  .gte('created_at', startDate)
                  .lte('created_at', endDate)
                  .order('created_at', { ascending: false }),
                // Event-linked customers (additional persons) by created_at
                supabaseClient
                  .from('customers')
                  .select('id, title, user_surname, user_number, social_network_link, payment_status, payment_amount, event_notes, created_at, start_date, end_date')
                  .eq('user_id', ownerId)
                  .eq('type', 'customer')
                  .not('event_id', 'is', null)
                  .is('deleted_at', null)
                  .gte('created_at', startDate)
                  .lte('created_at', endDate)
                  .order('created_at', { ascending: false }),
                // Main event persons by start_date
                supabaseClient
                  .from('events')
                  .select('id, user_surname, user_number, social_network_link, payment_status, payment_amount, start_date, created_at')
                  .eq('user_id', ownerId)
                  .is('deleted_at', null)
                  .is('parent_event_id', null)
                  .gte('start_date', startDate)
                  .lte('start_date', endDate)
                  .order('created_at', { ascending: false }),
                // Approved booking requests by start_date
                supabaseClient
                  .from('booking_requests')
                  .select('id, title, requester_name, requester_phone, requester_email, payment_status, payment_amount, created_at, start_date')
                  .eq('user_id', ownerId)
                  .eq('status', 'approved')
                  .is('deleted_at', null)
                  .gte('start_date', startDate)
                  .lte('start_date', endDate)
                  .order('created_at', { ascending: false })
              ]);
              
              if (standaloneCustomers.error || eventLinkedCustomers.error || events.error || bookingRequests.error) {
                console.error('    ❌ Error fetching customers:', standaloneCustomers.error || eventLinkedCustomers.error || events.error || bookingRequests.error);
                toolResult = {
                  customers: [],
                  count: 0,
                  error: (standaloneCustomers.error || eventLinkedCustomers.error || events.error || bookingRequests.error)?.message,
                  filters_applied: { created_after: args.created_after, created_before: args.created_before }
                };
              } else {
                // Combine with signature-based deduplication (matching CRM)
                const combined = [];
                const seenSignatures = new Set();
                const customerIdSet = new Set((standaloneCustomers.data || []).map(c => c.id));
                
                // Add standalone customers
                for (const customer of (standaloneCustomers.data || [])) {
                  if (!customer) continue;
                  const signature = `${customer.title}:::${customer.start_date}:::${customer.user_number}`;
                  if (!seenSignatures.has(signature)) {
                    combined.push({
                      id: customer.id,
                      full_name: customer.title || customer.user_surname,
                      email: customer.social_network_link,
                      phone: customer.user_number,
                      payment_status: customer.payment_status,
                      payment_amount: customer.payment_amount,
                      created_at: customer.created_at,
                      start_date: customer.start_date,
                      source: 'standalone_customer'
                    });
                    seenSignatures.add(signature);
                  }
                }
                
                // Add event-linked customers
                for (const customer of (eventLinkedCustomers.data || [])) {
                  if (!customer) continue;
                  const signature = `${customer.title}:::${customer.start_date}:::${customer.user_number}`;
                  if (!seenSignatures.has(signature)) {
                    combined.push({
                      id: customer.id,
                      full_name: customer.title || customer.user_surname,
                      email: customer.social_network_link,
                      phone: customer.user_number,
                      payment_status: customer.payment_status,
                      payment_amount: customer.payment_amount,
                      created_at: customer.created_at,
                      start_date: customer.start_date,
                      source: 'event_linked_customer'
                    });
                    seenSignatures.add(signature);
                  }
                }
                
                // Add events (main persons)
                for (const event of (events.data || [])) {
                  if (!event) continue;
                  const signature = `${event.user_surname}:::${event.start_date}`;
                  if (!seenSignatures.has(signature)) {
                    combined.push({
                      id: event.id,
                      full_name: event.user_surname,
                      email: event.social_network_link,
                      phone: event.user_number,
                      payment_status: event.payment_status,
                      payment_amount: event.payment_amount,
                      created_at: event.created_at,
                      start_date: event.start_date,
                      source: 'event_main_person'
                    });
                    seenSignatures.add(signature);
                  }
                }
                
                // Add booking requests
                for (const booking of (bookingRequests.data || [])) {
                  if (!booking) continue;
                  const signature = `booking-${booking.id}`;
                  if (!seenSignatures.has(signature)) {
                    combined.push({
                      id: booking.id,
                      full_name: booking.title || booking.requester_name,
                      email: booking.requester_email,
                      phone: booking.requester_phone,
                      payment_status: booking.payment_status,
                      payment_amount: booking.payment_amount,
                      created_at: booking.created_at,
                      start_date: booking.start_date,
                      source: 'booking_request'
                    });
                    seenSignatures.add(signature);
                  }
                }
                
                // ID-based Map deduplication (matching CRM)
                const uniqueData = new Map();
                combined.forEach(item => {
                  let key;
                  if (item.source === 'booking_request') {
                    key = `booking-${item.id}`;
                  } else if (item.source === 'event_main_person') {
                    key = `event-${item.id}`;
                  } else {
                    key = `customer-${item.id}`;
                  }
                  
                  if (!uniqueData.has(key) || new Date(item.created_at) > new Date(uniqueData.get(key).created_at)) {
                    uniqueData.set(key, item);
                  }
                });
                
                const uniqueCustomers = Array.from(uniqueData.values());
                
                // Calculate payment breakdown
                const paymentBreakdown = uniqueCustomers.reduce((acc, customer) => {
                  const status = customer.payment_status || 'unknown';
                  acc[status] = (acc[status] || 0) + 1;
                  return acc;
                }, {} as Record<string, number>);
                
                // Calculate total revenue
                const totalRevenue = uniqueCustomers.reduce((sum, customer) => {
                  return sum + (Number(customer.payment_amount) || 0);
                }, 0);
                
                toolResult = {
                  is_success: true,
                  customers: uniqueCustomers,
                  count: uniqueCustomers.length,
                  payment_breakdown: paymentBreakdown,
                  total_revenue: totalRevenue,
                  period: `${startDate.split('T')[0]} to ${endDate.split('T')[0]}`
                };
                console.log(`    ✅ Found ${combined.length} total, ${uniqueCustomers.length} unique after deduplication`);
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
              const limit = args.limit || 200;
              // FIX: When user asks for "this month", use FULL month, not just up to today
              const now = new Date();
              const monthStart = args.start_date || new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
              const monthEnd = args.end_date || new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999).toISOString();
              
              console.log(`    📅 Fetching customers for period: ${monthStart} to ${monthEnd}`);
              
              // CRITICAL: Match CRM page logic EXACTLY
              // Fetch from the SAME sources as useOptimizedCRMData
              const [standaloneCustomers, eventLinkedCustomers, events, bookingRequests] = await Promise.all([
                // Standalone CRM customers - filter by created_at (when customer was added)
                supabaseClient
                  .from('customers')
                  .select('id, title, user_surname, user_number, social_network_link, payment_status, payment_amount, created_at, start_date, end_date')
                  .eq('user_id', ownerId)
                  .is('deleted_at', null)
                  .is('event_id', null)
                  .gte('created_at', monthStart)
                  .lte('created_at', monthEnd)
                  .order('created_at', { ascending: false }),
                
                // Event-linked customers (additional persons) - filter by created_at
                supabaseClient
                  .from('customers')
                  .select('id, title, user_surname, user_number, social_network_link, payment_status, payment_amount, created_at, start_date, end_date, event_id')
                  .eq('user_id', ownerId)
                  .eq('type', 'customer')
                  .is('deleted_at', null)
                  .gte('created_at', monthStart)
                  .lte('created_at', monthEnd)
                  .order('created_at', { ascending: false }),
                
                // Events - filter by start_date (when event happens)
                supabaseClient
                  .from('events')
                  .select('id, title, user_surname, user_number, social_network_link, payment_status, payment_amount, created_at, start_date, end_date, booking_request_id')
                  .eq('user_id', ownerId)
                  .is('deleted_at', null)
                  .is('parent_event_id', null)
                  .gte('start_date', monthStart)
                  .lte('start_date', monthEnd)
                  .order('created_at', { ascending: false }),
                
                // Approved booking requests - filter by start_date
                supabaseClient
                  .from('booking_requests')
                  .select('id, title, requester_name, requester_phone, requester_email, payment_status, payment_amount, created_at, start_date, end_date')
                  .eq('user_id', ownerId)
                  .eq('status', 'approved')
                  .is('deleted_at', null)
                  .gte('start_date', monthStart)
                  .lte('start_date', monthEnd)
                  .order('created_at', { ascending: false })
              ]);
              
              if (standaloneCustomers.error || eventLinkedCustomers.error || events.error || bookingRequests.error) {
                console.error('    ❌ Error fetching data:', standaloneCustomers.error || eventLinkedCustomers.error || events.error || bookingRequests.error);
                toolResult = {
                  customers: [],
                  count: 0,
                  error: 'Failed to fetch customer data'
                };
                break;
              }
              
              // CRITICAL FIX: Use EXACT same deduplication as CRM page (useOptimizedCRMData)
              const combined = [];
              const seenSignatures = new Set();
              const customerIdSet = new Set((standaloneCustomers.data || []).map(c => c.id));
              
              // Add standalone customers first (with signature deduplication)
              for (const customer of (standaloneCustomers.data || [])) {
                if (!customer) continue;
                const signature = `${customer.title}:::${customer.start_date}:::${customer.user_number}`;
                if (!seenSignatures.has(signature)) {
                  combined.push({
                    id: customer.id,
                    full_name: customer.title || customer.user_surname,
                    email: customer.social_network_link,
                    phone: customer.user_number,
                    payment_status: customer.payment_status,
                    payment_amount: customer.payment_amount,
                    created_at: customer.created_at,
                    start_date: customer.start_date,
                    source: 'standalone_customer'
                  });
                  seenSignatures.add(signature);
                }
              }
              
              // Add event-linked customers (with signature deduplication)
              for (const customer of (eventLinkedCustomers.data || [])) {
                if (!customer) continue;
                const signature = `${customer.title}:::${customer.start_date}:::${customer.user_number}`;
                if (!seenSignatures.has(signature)) {
                  combined.push({
                    id: customer.id,
                    full_name: customer.title || customer.user_surname,
                    email: customer.social_network_link,
                    phone: customer.user_number,
                    payment_status: customer.payment_status,
                    payment_amount: customer.payment_amount,
                    created_at: customer.created_at,
                    start_date: customer.start_date,
                    source: 'event_linked_customer'
                  });
                  seenSignatures.add(signature);
                }
              }
              
              // Add events (main persons) - skip if booking was converted to customer
              for (const event of (events.data || [])) {
                if (!event) continue;
                if (event.booking_request_id && customerIdSet.has(event.booking_request_id)) continue;
                
                const signature = `${event.title}:::${event.start_date}`;
                if (!seenSignatures.has(signature)) {
                  combined.push({
                    id: event.id,
                    full_name: event.title || event.user_surname,
                    email: event.social_network_link,
                    phone: event.user_number,
                    payment_status: event.payment_status,
                    payment_amount: event.payment_amount,
                    created_at: event.created_at,
                    start_date: event.start_date,
                    source: 'event_main_person'
                  });
                  seenSignatures.add(signature);
                }
              }
              
              // Add transformed booking requests
              for (const booking of (bookingRequests.data || [])) {
                if (!booking) continue;
                const signature = `booking-${booking.id}`;
                if (!seenSignatures.has(signature)) {
                  combined.push({
                    id: booking.id,
                    full_name: booking.title || booking.requester_name,
                    email: booking.requester_email,
                    phone: booking.requester_phone,
                    payment_status: booking.payment_status,
                    payment_amount: booking.payment_amount,
                    created_at: booking.created_at,
                    start_date: booking.start_date,
                    source: 'booking_request'
                  });
                  seenSignatures.add(signature);
                }
              }
              
              // CRITICAL FIX: Use ID-based Map deduplication like CRM (not index!)
              const uniqueData = new Map();
              combined.forEach(item => {
                let key;
                if (item.source === 'booking_request') {
                  key = `booking-${item.id}`;
                } else if (item.source === 'event_main_person') {
                  key = `event-${item.id}`;
                } else {
                  key = `customer-${item.id}`;
                }
                
                // Keep the most recent version if duplicate found
                if (!uniqueData.has(key) || new Date(item.created_at) > new Date(uniqueData.get(key).created_at)) {
                  uniqueData.set(key, item);
                }
              });
              
              // Convert back to array and sort
              const result = Array.from(uniqueData.values())
                .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                .slice(0, limit);
              
              // Format for AI response (human-readable)
              toolResult = {
                is_success: true,
                customers: result,
                count: result.length,
                period: `${monthStart.split('T')[0]} to ${monthEnd.split('T')[0]}`
              };
              
              console.log(`    ✅ Found ${combined.length} total, ${result.length} unique customers after deduplication (CRM logic)`);
              console.log(`       Sources: ${standaloneCustomers.data?.length || 0} standalone, ${eventLinkedCustomers.data?.length || 0} event-linked, ${events.data?.length || 0} events, ${bookingRequests.data?.length || 0} bookings`);
              break;
            }

            case 'get_payment_summary': {
              // Fetch regular events
              const { data: events } = await supabaseClient
                .from('events')
                .select('payment_status, payment_amount')
                .eq('user_id', ownerId)
                .is('deleted_at', null);
              
              // Fetch approved booking requests
              const { data: bookings } = await supabaseClient
                .from('booking_requests')
                .select('payment_status, payment_amount')
                .eq('user_id', ownerId)
                .eq('status', 'approved')
                .is('deleted_at', null);
              
              // Combine both sources
              const allEvents = [...(events || []), ...(bookings || [])];
              
              const summary = {
                total_events: allEvents.length,
                paid: allEvents.filter(e => e.payment_status === 'paid').length,
                not_paid: allEvents.filter(e => e.payment_status === 'not_paid').length,
                partial: allEvents.filter(e => e.payment_status === 'partial' || e.payment_status === 'partly_paid').length,
                total_amount: allEvents.reduce((sum, e) => sum + (Number(e.payment_amount) || 0), 0)
              };
              
              toolResult = summary;
              console.log(`    ✓ Payment summary: ${summary.total_events} events, $${summary.total_amount} total`);
              break;
            }

            case 'get_business_stats': {
              const today = new Date();
              const monthStart = new Date(today.getFullYear(), today.getMonth(), 1).toISOString();
              const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59).toISOString();
              
              // CRITICAL: Match CRM page logic EXACTLY
              // - Events: filtered by start_date (when event happens)
              // - Customers: filtered by created_at (when customer was added)
              // - Exclude booking requests that were converted to events
              const [eventsResult, bookingsResult, regularEventsForCustomers, crmCustomersResult, standaloneCrmResult] = await Promise.all([
                // Events for event count: filter by start_date
                supabaseClient.from('events').select('id, payment_amount, payment_status, booking_request_id').eq('user_id', ownerId).gte('start_date', monthStart).lte('start_date', monthEnd).is('deleted_at', null).is('parent_event_id', null),
                // Booking requests for event count: filter by start_date
                supabaseClient.from('booking_requests').select('id, payment_amount, payment_status').eq('user_id', ownerId).eq('status', 'approved').gte('start_date', monthStart).lte('start_date', monthEnd).is('deleted_at', null),
                // Events for customer count: filter by start_date (main event persons)
                supabaseClient.from('events').select('id, social_network_link, user_number, user_surname').eq('user_id', ownerId).gte('start_date', monthStart).lte('start_date', monthEnd).is('deleted_at', null).is('parent_event_id', null),
                // Event-linked customers: filter by created_at (additional persons on events)
                supabaseClient.from('customers').select('id, social_network_link, user_number, user_surname, title').eq('user_id', ownerId).eq('type', 'customer').gte('created_at', monthStart).lte('created_at', monthEnd).is('deleted_at', null),
                // Standalone customers: filter by created_at (customers without events)
                supabaseClient.from('customers').select('id, social_network_link, user_number, user_surname, title').eq('user_id', ownerId).is('event_id', null).gte('created_at', monthStart).lte('created_at', monthEnd).is('deleted_at', null)
              ]);
              
              // CRITICAL: Exclude booking requests that were already converted to events (avoid double-counting)
              const bookingRequestIdsInEvents = new Set(
                (eventsResult.data || [])
                  .filter(event => event.booking_request_id)
                  .map(event => event.booking_request_id)
              );
              
              const unconvertedBookings = (bookingsResult.data || []).filter(
                booking => !bookingRequestIdsInEvents.has(booking.id)
              );
              
              // Event count: regular events + unconverted bookings
              const allEventsThisMonth = [...(eventsResult.data || []), ...unconvertedBookings];
              
              // Customer count: Use Set to deduplicate by email+phone+name signature
              const uniqueCustomers = new Set();
              const withBookingSet = new Set();
              const withoutBookingSet = new Set();
              
              // Add main event persons (WITH booking)
              (regularEventsForCustomers.data || []).forEach(event => {
                const customerKey = `${event.social_network_link || 'no-email'}_${event.user_number || 'no-phone'}_${event.user_surname || 'no-name'}`;
                uniqueCustomers.add(customerKey);
                withBookingSet.add(customerKey);
              });
              
              // Add event-linked customers (WITH booking)
              (crmCustomersResult.data || []).forEach(customer => {
                const customerKey = `${customer.social_network_link || 'no-email'}_${customer.user_number || 'no-phone'}_${customer.user_surname || customer.title || 'no-name'}`;
                uniqueCustomers.add(customerKey);
                withBookingSet.add(customerKey);
              });
              
              // Add standalone customers (WITHOUT booking)
              (standaloneCrmResult.data || []).forEach(customer => {
                const customerKey = `${customer.social_network_link || 'no-email'}_${customer.user_number || 'no-phone'}_${customer.user_surname || customer.title || 'no-name'}`;
                uniqueCustomers.add(customerKey);
                withoutBookingSet.add(customerKey);
              });
              
              // Remove duplicates: if in both sets, keep in withBooking only
              for (const key of withBookingSet) {
                if (withoutBookingSet.has(key)) withoutBookingSet.delete(key);
              }
              
              const totalCustomers = uniqueCustomers.size;
              
              toolResult = {
                this_month: {
                  events: allEventsThisMonth.length,
                  revenue: allEventsThisMonth.reduce((sum, e) => sum + (Number(e.payment_amount) || 0), 0)
                },
                total_customers: totalCustomers
              };
              console.log(`    ✅ AI Business stats (matched CRM logic): ${allEventsThisMonth.length} events (${eventsResult.data?.length || 0} regular + ${unconvertedBookings.length} unconverted bookings), ${totalCustomers} unique customers (${withBookingSet.size} with booking, ${withoutBookingSet.size} without)`);
              break;
            }

            case 'analyze_payment_history': {
              const months = args.months || 12;
              const today = new Date();
              const startDate = new Date(today);
              startDate.setMonth(today.getMonth() - months);
              
              console.log(`    📊 Analyzing payment history for ${months} months from ${startDate.toISOString()} to ${today.toISOString()}`);
              
              // CRITICAL: Match EXACT logic from Statistics page (useOptimizedStatistics.ts)
              
              // Helper to normalize payment status
              const normalizePaymentStatus = (raw: string | null | undefined): string => {
                if (!raw) return 'not_paid';
                const s = String(raw).toLowerCase().trim();
                if (s.includes('fully') || s === 'paid' || s.includes('full')) return 'fully_paid';
                if (s.includes('partial') || s.includes('partly') || s.includes('half')) return 'partly_paid';
                if (s.includes('not') || s.includes('unpaid') || s === 'none') return 'not_paid';
                if (s.includes('paid')) return 'partly_paid';
                return s;
              };
              
              // 1. Fetch regular events by START_DATE
              const { data: allEvents } = await supabaseClient
                .from('events')
                .select('id, payment_amount, payment_status, start_date, is_recurring, parent_event_id')
                .eq('user_id', ownerId)
                .gte('start_date', startDate.toISOString())
                .is('deleted_at', null)
                .order('start_date', { ascending: true });
              
              // 2. Fetch approved booking requests by START_DATE
              const { data: bookingRequests } = await supabaseClient
                .from('booking_requests')
                .select('id, payment_amount, payment_status, start_date')
                .eq('user_id', ownerId)
                .eq('status', 'approved')
                .gte('start_date', startDate.toISOString())
                .is('deleted_at', null)
                .order('start_date', { ascending: true });
              
              // Transform booking requests to match event structure
              const transformedBookings = (bookingRequests || []).map(booking => ({
                id: booking.id,
                payment_amount: booking.payment_amount,
                payment_status: booking.payment_status,
                start_date: booking.start_date,
                is_recurring: false,
                parent_event_id: null
              }));
              
              // Combine events and bookings
              const combinedEvents = [...(allEvents || []), ...transformedBookings];
              
              console.log(`    📅 Found ${allEvents?.length || 0} regular events + ${bookingRequests?.length || 0} approved bookings = ${combinedEvents.length} total`);
              
              // 3. Separate recurring events by series (same as Statistics page)
              const recurringSeriesMap = new Map<string, any[]>();
              const nonRecurringEvents: any[] = [];
              
              (combinedEvents || []).forEach(event => {
                if (event.is_recurring && event.parent_event_id) {
                  // Child of recurring series
                  if (!recurringSeriesMap.has(event.parent_event_id)) {
                    recurringSeriesMap.set(event.parent_event_id, []);
                  }
                  recurringSeriesMap.get(event.parent_event_id)?.push(event);
                } else if (event.is_recurring && !event.parent_event_id) {
                  // Parent of recurring series
                  if (!recurringSeriesMap.has(event.id)) {
                    recurringSeriesMap.set(event.id, []);
                  }
                  recurringSeriesMap.get(event.id)?.push(event);
                } else {
                  // Non-recurring event
                  nonRecurringEvents.push(event);
                }
              });
              
              console.log(`    🔄 ${recurringSeriesMap.size} recurring series, ${nonRecurringEvents.length} non-recurring events (including bookings)`);
              
              // 4. Get additional persons (customers) for ALL parent events (including parents of child instances)
              const parentEventIdsSet = new Set<string>();
              (combinedEvents || []).forEach(e => {
                if (!e.parent_event_id) {
                  // This is a parent event
                  parentEventIdsSet.add(e.id);
                } else {
                  // This is a child instance - include its parent
                  parentEventIdsSet.add(e.parent_event_id);
                }
              });
              
              const parentEventIds = Array.from(parentEventIdsSet);
              
              let additionalPersons: any[] = [];
              if (parentEventIds.length > 0) {
                const { data: customers } = await supabaseClient
                  .from('customers')
                  .select('event_id, payment_amount, payment_status, start_date')
                  .eq('user_id', ownerId)
                  .in('event_id', parentEventIds)
                  .eq('type', 'customer')
                  .is('deleted_at', null);
                
                additionalPersons = customers || [];
                console.log(`    👥 Found ${additionalPersons.length} additional persons for ${parentEventIds.length} parent events`);
              }
              
              // 5. Fetch standalone customers - MATCH STATISTICS PAGE EXACTLY
              const { data: standaloneCustomers } = await supabaseClient
                .from('customers')
                .select('payment_amount, payment_status, created_at')
                .eq('user_id', ownerId)
                .is('event_id', null)  // Only check event_id is null - match Stats page
                .gte('created_at', startDate.toISOString())
                .lte('created_at', today.toISOString())  // Add upper date boundary
                .is('deleted_at', null);
              
              console.log(`    💰 Found ${standaloneCustomers?.length || 0} standalone customers (matching Statistics page logic)`);
              
              // 6. Calculate revenue by month
              const monthlyData: Record<string, any> = {};
              
              // Process non-recurring events
              nonRecurringEvents.forEach(event => {
                const status = normalizePaymentStatus(event.payment_status);
                const amount = Number(event.payment_amount) || 0;
                
                if ((status === 'partly_paid' || status === 'fully_paid') && amount > 0) {
                  const date = new Date(event.start_date);
                  const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
                  
                  if (!monthlyData[monthKey]) {
                    monthlyData[monthKey] = { month: monthKey, event_revenue: 0, customer_revenue: 0, total_revenue: 0, fully_paid_count: 0, partly_paid_count: 0, total_transactions: 0 };
                  }
                  
                  monthlyData[monthKey].event_revenue += amount;
                  monthlyData[monthKey].total_revenue += amount;
                  monthlyData[monthKey].total_transactions += 1;
                  if (status === 'fully_paid') monthlyData[monthKey].fully_paid_count += 1;
                  else monthlyData[monthKey].partly_paid_count += 1;
                }
              });
              
              // Process recurring series - count payment ONCE per series
              for (const [seriesId, seriesEvents] of recurringSeriesMap) {
                const firstInstance = seriesEvents[0];
                const status = normalizePaymentStatus(firstInstance.payment_status);
                const amount = Number(firstInstance.payment_amount) || 0;
                
                if ((status === 'partly_paid' || status === 'fully_paid') && amount > 0) {
                  const date = new Date(firstInstance.start_date);
                  const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
                  
                  if (!monthlyData[monthKey]) {
                    monthlyData[monthKey] = { month: monthKey, event_revenue: 0, customer_revenue: 0, total_revenue: 0, fully_paid_count: 0, partly_paid_count: 0, total_transactions: 0 };
                  }
                  
                  monthlyData[monthKey].event_revenue += amount;
                  monthlyData[monthKey].total_revenue += amount;
                  monthlyData[monthKey].total_transactions += 1;
                  if (status === 'fully_paid') monthlyData[monthKey].fully_paid_count += 1;
                  else monthlyData[monthKey].partly_paid_count += 1;
                }
                
                // Process additional persons for recurring series - count ONCE per person per series
                const seriesAdditionalPersons = additionalPersons.filter(p => p.event_id === seriesId);
                seriesAdditionalPersons.forEach(person => {
                  const pStatus = normalizePaymentStatus(person.payment_status);
                  const pAmount = Number(person.payment_amount) || 0;
                  
                  if ((pStatus === 'partly_paid' || pStatus === 'fully_paid') && pAmount > 0) {
                    const pDate = person.start_date ? new Date(person.start_date) : new Date(firstInstance.start_date);
                    const monthKey = `${pDate.getFullYear()}-${String(pDate.getMonth() + 1).padStart(2, '0')}`;
                    
                    if (!monthlyData[monthKey]) {
                      monthlyData[monthKey] = { month: monthKey, event_revenue: 0, customer_revenue: 0, total_revenue: 0, fully_paid_count: 0, partly_paid_count: 0, total_transactions: 0 };
                    }
                    
                    monthlyData[monthKey].event_revenue += pAmount;
                    monthlyData[monthKey].total_revenue += pAmount;
                    monthlyData[monthKey].total_transactions += 1;
                    if (pStatus === 'fully_paid') monthlyData[monthKey].fully_paid_count += 1;
                    else monthlyData[monthKey].partly_paid_count += 1;
                  }
                });
              }
              
              // Process additional persons for non-recurring events
              const nonRecurringEventIds = new Set(nonRecurringEvents.map(e => e.id));
              const nonRecurringAdditionalPersons = additionalPersons.filter(p => 
                nonRecurringEventIds.has(p.event_id)
              );
              
              nonRecurringAdditionalPersons.forEach(person => {
                const pStatus = normalizePaymentStatus(person.payment_status);
                const pAmount = Number(person.payment_amount) || 0;
                
                if ((pStatus === 'partly_paid' || pStatus === 'fully_paid') && pAmount > 0) {
                  const pDate = new Date(person.start_date);
                  const monthKey = `${pDate.getFullYear()}-${String(pDate.getMonth() + 1).padStart(2, '0')}`;
                  
                  if (!monthlyData[monthKey]) {
                    monthlyData[monthKey] = { month: monthKey, event_revenue: 0, customer_revenue: 0, total_revenue: 0, fully_paid_count: 0, partly_paid_count: 0, total_transactions: 0 };
                  }
                  
                  monthlyData[monthKey].event_revenue += pAmount;
                  monthlyData[monthKey].total_revenue += pAmount;
                  monthlyData[monthKey].total_transactions += 1;
                  if (pStatus === 'fully_paid') monthlyData[monthKey].fully_paid_count += 1;
                  else monthlyData[monthKey].partly_paid_count += 1;
                }
              });
              
              // Process standalone customers - use ALL customers (no extra filtering, match Stats page)
              (standaloneCustomers || []).forEach(customer => {
                const status = normalizePaymentStatus(customer.payment_status);
                const amount = Number(customer.payment_amount) || 0;
                
                if ((status === 'partly_paid' || status === 'fully_paid') && amount > 0) {
                  const date = new Date(customer.created_at);
                  const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
                  
                  if (!monthlyData[monthKey]) {
                    monthlyData[monthKey] = { month: monthKey, event_revenue: 0, customer_revenue: 0, total_revenue: 0, fully_paid_count: 0, partly_paid_count: 0, total_transactions: 0 };
                  }
                  
                  monthlyData[monthKey].customer_revenue += amount;
                  monthlyData[monthKey].total_revenue += amount;
                  monthlyData[monthKey].total_transactions += 1;
                  if (status === 'fully_paid') monthlyData[monthKey].fully_paid_count += 1;
                  else monthlyData[monthKey].partly_paid_count += 1;
                }
              });
              
              const monthlyArray = Object.values(monthlyData).sort((a: any, b: any) => a.month.localeCompare(b.month));
              
              const totalRevenue = monthlyArray.reduce((sum, m: any) => sum + m.total_revenue, 0);
              const eventRevenue = monthlyArray.reduce((sum, m: any) => sum + m.event_revenue, 0);
              const customerRevenue = monthlyArray.reduce((sum, m: any) => sum + m.customer_revenue, 0);
              const totalTransactions = monthlyArray.reduce((sum, m: any) => sum + m.total_transactions, 0);
              const fullyPaidCount = monthlyArray.reduce((sum, m: any) => sum + m.fully_paid_count, 0);
              const partlyPaidCount = monthlyArray.reduce((sum, m: any) => sum + m.partly_paid_count, 0);
              
              console.log(`    ✅ FINAL STATISTICS (AI MUST present these EXACT numbers):`);
              console.log(`    💰 Total Revenue: $${totalRevenue} (Events: $${eventRevenue}, Customers: $${customerRevenue})`);
              console.log(`    📊 Monthly Breakdown (show these EXACT numbers to user):`);
              monthlyArray.forEach((m: any) => {
                console.log(`       📅 ${m.month}: Total=$${m.total_revenue} (Events=$${m.event_revenue}, Customers=$${m.customer_revenue}), Transactions=${m.total_transactions}`);
              });
              
              toolResult = {
                period: `${months} months`,
                start_date: startDate.toISOString().split('T')[0],
                end_date: today.toISOString().split('T')[0],
                summary: {
                  total_revenue: totalRevenue,
                  event_revenue: eventRevenue,
                  customer_revenue: customerRevenue,
                  total_transactions: totalTransactions,
                  fully_paid_transactions: fullyPaidCount,
                  partly_paid_transactions: partlyPaidCount,
                  average_monthly_revenue: monthlyArray.length > 0 ? Math.round(totalRevenue / monthlyArray.length) : 0,
                  payment_completion_rate: totalTransactions > 0 ? Math.round((fullyPaidCount / totalTransactions) * 100) : 0
                },
                monthly_breakdown: monthlyArray,
                insights: {
                  best_month: monthlyArray.length > 0 ? monthlyArray.reduce((max: any, m: any) => m.total_revenue > max.total_revenue ? m : max) : null,
                  worst_month: monthlyArray.length > 0 ? monthlyArray.reduce((min: any, m: any) => m.total_revenue < min.total_revenue ? m : min) : null
                },
                _ai_instruction: "🚨 CRITICAL: Present these EXACT numbers to the user. Do NOT recalculate, round, or modify ANY values. All users (admin and sub-users) must see IDENTICAL numbers. Match the monthly_breakdown array exactly."
              };
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

            case 'send_direct_email': {
              const { recipient_email, message, subject, offset_minutes, absolute_local, send_at } = args;
              
              console.log('📧 Processing email request:', { recipient_email, has_message: !!message, offset_minutes, absolute_local, send_at });
              
              if (!recipient_email || !message) {
                toolResult = { 
                  success: false, 
                  error: 'Both recipient_email and message are required' 
                };
                break;
              }
              
              // Validate email format
              const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
              if (!emailRegex.test(recipient_email)) {
                toolResult = { 
                  success: false, 
                  error: 'Invalid email address format' 
                };
                break;
              }
              
              // Check if scheduling is requested (support both new and legacy formats)
              if ((typeof offset_minutes === 'number' && offset_minutes > 0) || absolute_local || send_at) {
                console.log('📅 Scheduling email using same logic as reminders');
                
                // 1) Base time is BROWSER time received from frontend
                const baseNow = currentLocalTime ? new Date(currentLocalTime) : new Date();
                
                // 2) Compute UTC send time deterministically on server (SAME AS REMINDERS)
                let sendAtUtc: Date;
                
                if (send_at) {
                  // Legacy format support - convert ISO string directly
                  sendAtUtc = new Date(send_at);
                  console.log(`  📅 Using legacy send_at format: ${send_at}`);
                } else if (typeof offset_minutes === 'number' && offset_minutes > 0) {
                  // Relative time: add offset to current browser time
                  sendAtUtc = new Date(baseNow.getTime() + offset_minutes * 60_000);
                  console.log(`  ⏱️ Relative time: ${offset_minutes} minutes from now`);
                } else if (absolute_local) {
                  // Absolute time: convert local wall time to UTC (SAME LOGIC AS REMINDERS)
                  const [d, t] = absolute_local.split('T');
                  const [Y, M, D] = d.split('-').map(Number);
                  const [h, m] = t.split(':').map(Number);
                  
                  console.log(`  🕐 Absolute local time: ${absolute_local} (Year:${Y}, Month:${M}, Day:${D}, Hour:${h}, Minute:${m})`);
                  
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
                  
                  // Adjustment loop (handles DST edges) - SAME AS REMINDERS
                  for (let i = 0; i < 3; i++) {
                    const parts = fmt(guess);
                    const want = `${Y}-${String(M).padStart(2, '0')}-${String(D).padStart(2, '0')}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
                    const have = `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
                    
                    console.log(`    Iteration ${i}: want=${want}, have=${have}`);
                    
                    if (have === want) break;
                    
                    const deltaMin =
                      ((Y - +parts.year) * 525600) +
                      ((M - +parts.month) * 43200) +
                      ((D - +parts.day) * 1440) +
                      ((h - +parts.hour) * 60) +
                      (m - +parts.minute);
                    guess = new Date(guess.getTime() + deltaMin * 60_000);
                  }
                  sendAtUtc = guess;
                  console.log(`  ✅ Converted to UTC: ${sendAtUtc.toISOString()}`);
                } else {
                  toolResult = { success: false, error: 'Provide offset_minutes, absolute_local, or send_at for scheduling.' };
                  break;
                }
                
                // 3) Validate future time - use baseNow for consistency
                // Add 2-second buffer to account for network/processing delays
                if (sendAtUtc <= new Date(baseNow.getTime() + 2000)) {
                  toolResult = { success: false, error: 'Email send time must be in the future.' };
                  break;
                }
                
                // 4) Format display time in user's timezone (SAME AS REMINDERS)
                const displayTime = formatInUserZone(sendAtUtc);
                
                console.log('Email scheduling debug:', {
                  effectiveTZ: userTimezone,
                  tzOffsetMinutes,
                  baseNow: currentLocalTime,
                  sendAtUtc: sendAtUtc.toISOString(),
                  displayTime,
                  userLanguage
                });
                
                // 5) Get business profile for scheduled email
                const { data: businessProfile } = await supabaseAdmin
                  .from('business_profiles')
                  .select('business_name')
                  .eq('user_id', ownerId)
                  .maybeSingle();
                
                const senderEmail = requesterIdentity?.email || '';
                const businessName = businessProfile?.business_name || null;
                
                console.log('📧 Scheduled email sender info:', { baseName, senderEmail, businessName });
                
                // 6) Store scheduled email in database with sender details
                const { error: scheduleError } = await supabaseAdmin
                  .from('scheduled_emails')
                  .insert({
                    user_id: ownerId,
                    recipient_email: recipient_email,
                    subject: subject || (userLanguage === 'ka' ? 'შეტყობინება SmartBookly-დან' : userLanguage === 'es' ? 'Mensaje de SmartBookly' : userLanguage === 'ru' ? 'Сообщение от SmartBookly' : 'Message from SmartBookly'),
                    message: message,
                    language: userLanguage,
                    sender_name: baseName,
                    sender_email: senderEmail,
                    business_name: businessName,
                    send_at: sendAtUtc.toISOString(),
                    created_by_type: requesterType,
                    created_by_name: baseName
                  });
                
                if (scheduleError) {
                  console.error('❌ Failed to schedule email:', scheduleError);
                  toolResult = { 
                    success: false, 
                    error: userLanguage === 'ka' 
                      ? 'ელფოსტის დაგეგმვა ვერ მოხერხდა'
                      : userLanguage === 'es'
                      ? 'No se pudo programar el correo electrónico'
                      : userLanguage === 'ru'
                      ? 'Не удалось запланировать отправку письма'
                      : 'Failed to schedule email'
                  };
                } else {
                  console.log('✅ Email scheduled successfully for:', displayTime);
                  
                  // Create friendly, detailed confirmation message (SAME STYLE AS REMINDERS)
                  const emailConfirmations = {
                    en: `✅ Email scheduled! I'll send your message to ${recipient_email} at ${displayTime}. The recipient will receive your email with the subject "${subject || 'Message from SmartBookly'}" at the scheduled time.`,
                    ru: `✅ Письмо запланировано! Я отправлю ваше сообщение ${recipient_email} в ${displayTime}. Получатель получит ваше письмо с темой "${subject || 'Сообщение от SmartBookly'}" в запланированное время.`,
                    ka: `✅ ელფოსტა დაგეგმილია! გავაგზავნი თქვენს შეტყობინებას ${recipient_email}-ზე ${displayTime}-ზე. ადრესატი მიიღებს თქვენს წერილს თემით "${subject || 'შეტყობინება SmartBookly-დან'}" დაგეგმილ დროს.`,
                    es: `✅ ¡Correo electrónico programado! Enviaré tu mensaje a ${recipient_email} a las ${displayTime}. El destinatario recibirá tu correo con el asunto "${subject || 'Mensaje de SmartBookly'}" en el momento programado.`
                  };
                  
                  const confirmation = emailConfirmations[userLanguage as keyof typeof emailConfirmations] || emailConfirmations.en;
                  
                  // Write confirmation message directly to chat (SAME AS REMINDERS)
                  await supabaseAdmin.from('chat_messages').insert({
                    channel_id: channelId,
                    owner_id: ownerId,
                    sender_type: 'admin',
                    sender_name: 'Smartbookly AI',
                    content: confirmation,
                    message_type: 'text'
                  });
                  
                  console.log(`✅ Email schedule confirmation sent to chat in ${userLanguage}`);
                  
                  // Return early with immediate response (SAME AS REMINDERS)
                  return new Response(
                    JSON.stringify({ success: true, content: confirmation }),
                    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                  );
                }
              } else {
                // Send immediately via edge function
                console.log('📧 Sending email immediately');
                
                // Get business profile if exists
                const { data: businessProfile } = await supabaseAdmin
                  .from('business_profiles')
                  .select('business_name')
                  .eq('user_id', ownerId)
                  .maybeSingle();
                
                const senderEmail = requesterIdentity?.email || '';
                const businessName = businessProfile?.business_name || null;
                
                console.log('📧 Sender info:', { baseName, senderEmail, businessName });
                
                const { data: emailData, error: emailError } = await supabaseAdmin.functions.invoke(
                  'send-direct-email',
                  {
                    body: {
                      recipient_email,
                      message,
                      subject: subject || undefined,
                      language: userLanguage,
                      sender_name: baseName,
                      sender_email: senderEmail,
                      business_name: businessName
                    }
                  }
                );
                
                // Check for invocation error or response error
                if (emailError || (emailData && !emailData.success)) {
                  const errorMsg = emailError?.message || emailData?.error || emailData?.message || 'Failed to send email';
                  console.error('❌ Failed to send direct email:', errorMsg);
                  
                  // Check if it's a domain verification error
                  if (errorMsg.includes('verify a domain') || errorMsg.includes('Domain verification')) {
                    toolResult = { 
                      success: false, 
                      error: 'domain_verification_required',
                      message: 'To send emails to external recipients, you need to verify a domain at resend.com/domains. Currently, emails can only be sent to your verified email address.'
                    };
                  } else {
                    toolResult = { 
                      success: false, 
                      error: errorMsg
                    };
                  }
                } else {
                  console.log('✅ Direct email sent successfully');
                  
                  // Create friendly confirmation message (SAME STYLE AS SCHEDULED EMAILS)
                  const emailConfirmations = {
                    en: `✅ Email sent! Your message has been delivered to ${recipient_email}.`,
                    ru: `✅ Письмо отправлено! Ваше сообщение доставлено ${recipient_email}.`,
                    ka: `✅ ელფოსტა გაიგზავნა! თქვენი შეტყობინება მიწოდებულია ${recipient_email}-ზე.`,
                    es: `✅ ¡Correo enviado! Tu mensaje ha sido entregado a ${recipient_email}.`
                  };
                  
                  const confirmation = emailConfirmations[userLanguage as keyof typeof emailConfirmations] || emailConfirmations.en;
                  
                  // Write confirmation message directly to chat (SAME AS SCHEDULED EMAILS)
                  await supabaseAdmin.from('chat_messages').insert({
                    channel_id: channelId,
                    owner_id: ownerId,
                    sender_type: 'admin',
                    sender_name: 'Smartbookly AI',
                    content: confirmation,
                    message_type: 'text'
                  });
                  
                  console.log(`✅ Email confirmation sent to chat in ${userLanguage}`);
                  
                  // Return early with immediate response (SAME AS SCHEDULED EMAILS)
                  return new Response(
                    JSON.stringify({ success: true, content: confirmation }),
                    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                  );
                }
              }
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
              
              // 3) Validate future time - use baseNow for consistency with calculation
              // Add 2-second buffer to account for network/processing delays
              if (remindAtUtc <= new Date(baseNow.getTime() + 2000)) {
                toolResult = { success: false, error: 'Reminder time must be in the future.' };
                break;
              }
              
              // 4) SMART RECIPIENT DETECTION: Parse original prompt to identify recipient
              console.log('🔍 Analyzing reminder recipient from prompt:', prompt);
              let recipientEmail: string | null = null;
              let recipientCustomerId: string | null = null;
              let recipientEventId: string | null = null;
              let recipientName: string | null = null;
              
              try {
                // STEP 1: First check for email addresses in the prompt
                const emailPattern = /([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/;
                const emailMatch = prompt.match(emailPattern);
                if (emailMatch) {
                  recipientEmail = emailMatch[1].trim();
                  console.log(`  📧 Extracted email address: "${recipientEmail}"`);
                }
                
                // STEP 1.5: Check for self-referential pronouns (user referring to themselves)
                // This prevents misinterpretation of "me", "myself" as third-party recipients
                const selfReferentialPatterns = [
                  // English - common self-referential phrases
                  /\b(?:remind|send|notify|alert|tell)\s+(?:me|myself)\b/i,
                  /\bfor\s+me\b/i,
                  /\bto\s+me\b/i,
                  /\bmy\s+reminder\b/i,
                  /\bi\s+(?:want|need|would\s+like)\b/i,
                  
                  // Georgian
                  /\bშემახსენე\b/iu,  // "remind me"
                  /\bჩემთვის\b/iu,  // "for me"
                  /\bჩემი\s+შეხსენება\b/iu,  // "my reminder"
                  /\bმე\s+მჭირდება\b/iu,  // "I need"
                  
                  // Spanish
                  /\b(?:recuérdame|recordarme|avísame)\b/iu,
                  /\bpara\s+mí\b/iu,
                  /\bmi\s+recordatorio\b/iu,
                  /\byo\s+(?:quiero|necesito)\b/iu,
                  
                  // Russian
                  /\bнапомни\s+мне\b/iu,
                  /\bдля\s+меня\b/iu,
                  /\bмоё\s+напоминание\b/iu,
                  /\bмне\s+нужно\b/iu,
                ];

                let isSelfReminder = false;
                for (const pattern of selfReferentialPatterns) {
                  if (pattern.test(prompt)) {
                    isSelfReminder = true;
                    console.log('  ✓ Detected self-referential language - reminder for current user');
                    break;
                  }
                }
                
                // STEP 2: Extract potential recipient names - ONLY when clear grammatical indicators
                // Skip this if user is clearly referring to themselves
                // Be conservative: only extract when there's STRONG evidence of specifying a recipient
                if (!isSelfReminder) {
                  const clearRecipientPatterns = [
                    // English: CLEAR recipient indicators - "to NAME", "for NAME", "NAME's"
                    /(?:reminder|remind|send|notify)\s+(?:to|for)\s+([A-Za-z]+(?:\s+[A-Za-z]+)?)\b/i,
                    /send\s+(?:reminder|notification)\s+to\s+([A-Za-z]+(?:\s+[A-Za-z]+)?)\b/i,
                    /([A-Za-z]+(?:\s+[A-Za-z]+)?)'s\s+(?:event|reminder)\b/i,
                    
                    // Georgian: Clear recipient with dative case marker "ს" or "სთვის"
                    /შეახსენე\s+([A-Za-zა-ჰ]+(?:\s+[A-Za-zა-ჰ]+)?)\s*ს(?:\s|$)/iu,
                    /შეახსენება\s+([A-Za-zა-ჰ]+(?:\s+[A-Za-zა-ჰ]+)?)\s*სთვის/iu,
                    /გააგზავნე\s+შეახსენება\s+([A-Za-zა-ჰ]+(?:\s+[A-Za-zა-ჰ]+)?)\s*ს/iu,
                    
                    // Spanish: Clear recipient with "a NAME"
                    /recordar\s+a\s+([A-Za-záéíóúñÁÉÍÓÚÑ]+(?:\s+[A-Za-záéíóúñÁÉÍÓÚÑ]+)?)\b/iu,
                    /recordatorio\s+para\s+([A-Za-záéíóúñÁÉÍÓÚÑ]+(?:\s+[A-Za-záéíóúñÁÉÍÓÚÑ]+)?)\b/iu,
                    
                    // Russian: Clear recipient with dative case "NAME у"
                    /напомни(?:ть)?\s+([A-Za-zА-Яа-я]+(?:\s+[A-Za-zА-Яа-я]+)?)\s+о\b/iu,
                    /напоминание\s+для\s+([A-Za-zА-Яа-я]+(?:\s+[A-Za-zА-Яа-я]+)?)\b/iu,
                  ];
                  
                  for (const pattern of clearRecipientPatterns) {
                    const match = prompt.match(pattern);
                    if (match && match[1]) {
                      const extractedName = match[1].trim();
                      // CRITICAL: Filter out self-referential words even if they match pattern
                      const selfWords = ['me', 'myself', 'my', 'i', 'მე', 'ჩემი', 'yo', 'mí', 'mi', 'я', 'меня', 'мне'];
                      if (!selfWords.includes(extractedName.toLowerCase())) {
                        recipientName = extractedName;
                        console.log(`  ✓ Found clear recipient indicator: "${recipientName}"`);
                        break;
                      } else {
                        console.log(`  ℹ️ Ignored self-referential word in pattern: "${extractedName}"`);
                      }
                    }
                  }
                } else {
                  console.log('  ℹ️ Skipping recipient extraction - user is creating reminder for themselves');
                }
                
                // STEP 3: If we found a name, look it up in database
                if (recipientName && !recipientEmail) {
                  const nameLower = recipientName.toLowerCase();
                  
                  // Search in customers first (CRM entries)
                  const { data: customers } = await supabaseAdmin
                    .from('customers')
                    .select('id, user_surname, title, social_network_link, event_id, user_number')
                    .eq('user_id', ownerId)
                    .is('deleted_at', null)
                    .or(`user_surname.ilike.%${recipientName}%,title.ilike.%${recipientName}%`);
                  
                  if (customers && customers.length > 0) {
                    // Find best match
                    for (const customer of customers) {
                      const customerName = (customer.user_surname || customer.title || '').toLowerCase();
                      if (customerName.includes(nameLower) || nameLower.includes(customerName)) {
                        // Try to get email from social_network_link or user_number
                        recipientEmail = customer.social_network_link || customer.user_number;
                        recipientCustomerId = customer.id;
                        recipientEventId = customer.event_id;
                        recipientName = customer.user_surname || customer.title; // Use actual name from DB
                        console.log(`  ✅ Found customer: ${recipientName} (email: ${recipientEmail})`);
                        break;
                      }
                    }
                  }
                  
                  // If not found in customers, search in events
                  if (!recipientEmail) {
                    const { data: events } = await supabaseAdmin
                      .from('events')
                      .select('id, user_surname, title, social_network_link, user_number')
                      .eq('user_id', ownerId)
                      .is('deleted_at', null)
                      .or(`user_surname.ilike.%${recipientName}%,title.ilike.%${recipientName}%`);
                    
                    if (events && events.length > 0) {
                      // Find best match
                      for (const event of events) {
                        const eventName = (event.user_surname || event.title || '').toLowerCase();
                        if (eventName.includes(nameLower) || nameLower.includes(eventName)) {
                          // Try to get email from social_network_link or user_number
                          recipientEmail = event.social_network_link || event.user_number;
                          recipientEventId = event.id;
                          recipientName = event.user_surname || event.title; // Use actual name from DB
                          console.log(`  ✅ Found event participant: ${recipientName} (email: ${recipientEmail})`);
                          break;
                        }
                      }
                    }
                  }
                  
                  // STEP 4: If name was explicitly mentioned but not found, ask for clarification
                  if (!recipientEmail && recipientName) {
                    console.log(`  ❌ Recipient "${recipientName}" not found in database, asking for clarification`);
                    
                    const clarificationMessages: Record<string, string> = {
                      en: `I couldn't find a customer or event participant named "${recipientName}". Could you please provide:\n• The correct name, or\n• Their email address?\n\nThis will help me send the reminder to the right person.`,
                      ka: `ვერ ვიპოვე კლიენტი ან ღონისძიების მონაწილე სახელით "${recipientName}". გთხოვთ მიუთითოთ:\n• სწორი სახელი, ან\n• მათი ელფოსტის მისამართი?\n\nეს დამეხმარება შეხსენება გავუგზავნო სწორ ადამიანს.`,
                      es: `No pude encontrar un cliente o participante del evento llamado "${recipientName}". ¿Podrías proporcionar:\n• El nombre correcto, o\n• Su dirección de correo electrónico?\n\nEsto me ayudará a enviar el recordatorio a la persona correcta.`,
                      ru: `Не удалось найти клиента или участника мероприятия с именем "${recipientName}". Не могли бы вы указать:\n• Правильное имя, или\n• Их адрес электронной почты?\n\nЭто поможет мне отправить напоминание нужному человеку.`
                    };
                    
                    const clarificationMsg = clarificationMessages[userLanguage] || clarificationMessages['en'];
                    
                    // Write the clarification message to chat
                    await supabaseAdmin.from('chat_messages').insert({
                      channel_id: channelId,
                      owner_id: ownerId,
                      sender_type: 'admin',
                      sender_name: 'Smartbookly AI',
                      content: clarificationMsg,
                      message_type: 'text'
                    });
                    
                    return new Response(
                      JSON.stringify({ success: true, content: clarificationMsg }),
                      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                    );
                  }
                  
                  // Validate email format if found
                  if (recipientEmail && !recipientEmail.includes('@')) {
                    console.log(`  ⚠️ Found recipient but no valid email: ${recipientEmail}`);
                    recipientEmail = null; // Fall back to self-reminder
                    recipientName = null;
                  }
                  
                  if (recipientEmail) {
                    console.log(`  🎯 Reminder will be sent to: ${recipientEmail} (Customer ID: ${recipientCustomerId}, Event ID: ${recipientEventId})`);
                  }
                }
                
                // STEP 5: If we have a direct email from prompt, use it
                if (recipientEmail && recipientEmail.includes('@')) {
                  console.log(`  🎯 Using email for reminder: ${recipientEmail}`);
                } else if (!recipientName && !recipientEmail) {
                  console.log('  ℹ️ No specific recipient detected, reminder will go to user/sub-user');
                }
              } catch (lookupError) {
                console.error('  ⚠️ Error during recipient lookup:', lookupError);
                // Continue without recipient - reminder will go to admin
              }
              
              // 5) Store reminder with creator tracking, language, AND recipient info
              const { data: reminderRow, error: reminderError } = await supabaseAdmin
                .from('custom_reminders')
                .insert({
                  user_id: ownerId,
                  title,
                  message: message || '',
                  remind_at: remindAtUtc.toISOString(),
                  email_sent: false,
                  reminder_sent_at: null,
                  created_by_type: requesterType,
                  created_by_sub_user_id: requesterType === 'sub_user' ? requesterIdentity?.id : null,
                  created_by_name: baseName,
                  language: userLanguage,  // CRITICAL: Store language for email localization
                  recipient_email: recipientEmail,  // NEW: Recipient's email if found
                  recipient_customer_id: recipientCustomerId,  // NEW: Customer ID if applicable
                  recipient_event_id: recipientEventId  // NEW: Event ID if applicable
                })
                .select()
                .single();
              
              if (reminderError) {
                console.error('❌ Failed to create reminder:', reminderError);
                toolResult = { success: false, error: reminderError.message };
                break;
              }
              
              // 6) Build HUMAN message on server (no LLM) - in user's language
              const display = formatInUserZone(remindAtUtc);
              
              console.log('Reminder debug:', {
                effectiveTZ,
                tzOffsetMinutes,
                baseNow: currentLocalTime,
                remindAtUtc: remindAtUtc.toISOString(),
                display,
                userLanguage,
                recipientEmail,
                recipientName
              });
              
              // Localized confirmation messages (adapted based on recipient)
              let confirmation: string;
              
              if (recipientEmail && recipientName) {
                // Reminder is FOR someone else (customer/event person)
                const recipientConfirmations = {
                  en: `✅ Reminder set! I'll remind ${recipientName} about '${title}' at ${display}. They'll receive an email notification.`,
                  ru: `✅ Напоминание установлено! Я напомню ${recipientName} о '${title}' в ${display}. Они получат уведомление по электронной почте.`,
                  ka: `✅ შეხსენება დაყენებულია! გავახსენებ ${recipientName}-ს '${title}' ${display}-ზე. მიიღებს შეტყობინებას ელფოსტით.`,
                  es: `✅ ¡Recordatorio establecido! Le recordaré a ${recipientName} sobre '${title}' a las ${display}. Recibirá una notificación por correo electrónico.`
                };
                confirmation = recipientConfirmations[userLanguage as keyof typeof recipientConfirmations] || recipientConfirmations.en;
              } else {
                // Reminder is FOR admin/sub-user themselves
                const selfConfirmations = {
                  en: `✅ Reminder set! I'll remind you about '${title}' at ${display}. You'll receive both an email and dashboard notification.`,
                  ru: `✅ Напоминание установлено! Я напомню вам о '${title}' в ${display}. Вы получите уведомление по электронной почте и на панели управления.`,
                  ka: `✅ შეხსენება დაყენებულია! გაგახსენებთ '${title}' ${display}-ზე. მიიღებთ შეტყობინებას ელფოსტით და პანელზე.`,
                  es: `✅ ¡Recordatorio establecido! Te recordaré sobre '${title}' a las ${display}. Recibirás una notificación por correo electrónico y en el panel.`
                };
                confirmation = selfConfirmations[userLanguage as keyof typeof selfConfirmations] || selfConfirmations.en;
              }
              
              // 6) Write bot message now (skip second LLM call)
              // CRITICAL: Mark this message with a special flag so process-reminders won't duplicate it
              await supabaseAdmin.from('chat_messages').insert({
                channel_id: channelId,
                owner_id: ownerId,
                sender_type: 'admin',
                sender_name: 'Smartbookly AI',
                content: confirmation,
                message_type: 'text'
              });
              
              console.log(`✅ Reminder confirmation sent to chat in ${userLanguage}`);
              
              // Return early with immediate response
              return new Response(
                JSON.stringify({ success: true, content: confirmation }),
                {
                  headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                }
              );
            }

            case 'generate_excel_report': {
              const { report_type, months } = args;
              const finalMonths = months || 1; // Default to 1 month (this month) if not specified
              
              console.log(`📊 Generating Excel report: type=${report_type}, months=${finalMonths}`);
              
              // Call the generate-excel-report edge function
              const { data: excelData, error: excelError } = await supabaseAdmin.functions.invoke(
                "generate-excel-report",
                { body: { reportType: report_type, months: finalMonths, userId: ownerId } }
              );

              if (excelError) {
                console.error("❌ Excel generation error:", excelError);
                toolResult = { 
                  success: false, 
                  error: "Sorry, I couldn't generate the Excel file due to a server error."
                };
                break;
              }

              // Create transparent, user-friendly message
              const timePeriodLabels = {
                en: finalMonths === 1 ? "this month" : finalMonths === 3 ? "last 3 months" : finalMonths === 6 ? "last 6 months" : finalMonths === 12 ? "this year" : `last ${finalMonths} months`,
                ru: finalMonths === 1 ? "этот месяц" : finalMonths === 3 ? "последние 3 месяца" : finalMonths === 6 ? "последние 6 месяцев" : finalMonths === 12 ? "этот год" : `последние ${finalMonths} месяцев`,
                ka: finalMonths === 1 ? "ამ თვეში" : finalMonths === 3 ? "ბოლო 3 თვე" : finalMonths === 6 ? "ბოლო 6 თვე" : finalMonths === 12 ? "ამ წელს" : `ბოლო ${finalMonths} თვე`,
                es: finalMonths === 1 ? "este mes" : finalMonths === 3 ? "últimos 3 meses" : finalMonths === 6 ? "últimos 6 meses" : finalMonths === 12 ? "este año" : `últimos ${finalMonths} meses`
              };
              
              const timePeriodLabel = timePeriodLabels[userLanguage as keyof typeof timePeriodLabels] || timePeriodLabels.en;
              
              if (excelData?.success) {
                const reportTypeLabels = {
                  en: { payments: "payments", events: "events", customers: "customers", tasks: "tasks", bookings: "bookings" },
                  ru: { payments: "платежи", events: "события", customers: "клиенты", tasks: "задачи", bookings: "бронирования" },
                  ka: { payments: "გადახდები", events: "მოვლენები", customers: "კლიენტები", tasks: "ამოცანები", bookings: "ჯავშნები" },
                  es: { payments: "pagos", events: "eventos", customers: "clientes", tasks: "tareas", bookings: "reservas" }
                };
                
                const reportLabel = reportTypeLabels[userLanguage as keyof typeof reportTypeLabels]?.[report_type as keyof typeof reportTypeLabels.en] || report_type;
                
                const confirmations = {
                  en: `📊 Generated **${reportLabel}** report for **${timePeriodLabel}**\n\n📥 [Download Excel](${excelData.downloadUrl})\n\n**Records:** ${excelData.recordCount}\n\n*Link expires in 1 hour*`,
                  ru: `📊 Создан отчет **${reportLabel}** за **${timePeriodLabel}**\n\n📥 [Скачать Excel](${excelData.downloadUrl})\n\n**Записей:** ${excelData.recordCount}\n\n*Ссылка действительна 1 час*`,
                  ka: `📊 შეიქმნა **${reportLabel}** ანგარიში **${timePeriodLabel}**\n\n📥 [ჩამოტვირთეთ Excel](${excelData.downloadUrl})\n\n**ჩანაწერები:** ${excelData.recordCount}\n\n*ბმული მოქმედებს 1 საათი*`,
                  es: `📊 Informe de **${reportLabel}** generado para **${timePeriodLabel}**\n\n📥 [Descargar Excel](${excelData.downloadUrl})\n\n**Registros:** ${excelData.recordCount}\n\n*El enlace caduca en 1 hora*`
                };
                
                const confirmation = confirmations[userLanguage as keyof typeof confirmations] || confirmations.en;
                
                // Write confirmation message directly to chat
                await supabaseAdmin.from('chat_messages').insert({
                  channel_id: channelId,
                  owner_id: ownerId,
                  sender_type: 'admin',
                  sender_name: 'Smartbookly AI',
                  content: confirmation,
                  message_type: 'text'
                });
                
                console.log(`✅ Excel report confirmation sent to chat: ${report_type} (${finalMonths} months)`);
                
                // Return early with immediate response
                return new Response(
                  JSON.stringify({ success: true, content: confirmation }),
                  { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                );
              } else {
                const noDataMessages = {
                  en: `ℹ️ No ${report_type} data found for ${timePeriodLabel}.`,
                  ru: `ℹ️ Данных по ${report_type} за ${timePeriodLabel} не найдено.`,
                  ka: `ℹ️ ${report_type} მონაცემები არ მოიძებნა ${timePeriodLabel}.`,
                  es: `ℹ️ No se encontraron datos de ${report_type} para ${timePeriodLabel}.`
                };
                
                toolResult = { 
                  success: false, 
                  error: noDataMessages[userLanguage as keyof typeof noDataMessages] || noDataMessages.en
                };
              }
              break;
            }

            case 'create_or_update_event': {
              const { 
                event_id, 
                full_name, 
                start_date, 
                end_date, 
                phone_number, 
                social_media, 
                notes, 
                payment_status, 
                payment_amount, 
                event_name,
                additional_persons,
                is_recurring,
                repeat_pattern,
                repeat_until
              } = args;
              
              console.log(`    📅 ${event_id ? 'Updating' : 'Creating'} event for ${full_name}`, { 
                start_date, 
                end_date, 
                userTimezone,
                additional_persons_count: (additional_persons || []).length,
                is_recurring: is_recurring || false
              });
              
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

                // Format additional persons for the RPC call
                const formattedAdditionalPersons = (additional_persons || []).map((person: any) => ({
                  userSurname: person.userSurname || person.full_name || "",
                  userNumber: person.userNumber || person.phone_number || "",
                  socialNetworkLink: person.socialNetworkLink || person.social_media || "",
                  eventNotes: person.eventNotes || person.notes || "",
                  paymentStatus: person.paymentStatus || person.payment_status || "not_paid",
                  paymentAmount: person.paymentAmount || person.payment_amount || ""
                }));

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
                  type: "event",
                  is_recurring: is_recurring || false,
                  repeat_pattern: repeat_pattern || null,
                  repeat_until: repeat_until || null
                };

                if (event_id) {
                  // Update existing event
                  const { data: result, error: updateError } = await supabaseAdmin.rpc('save_event_with_persons', {
                    p_event_data: eventData,
                    p_additional_persons: formattedAdditionalPersons,
                    p_user_id: ownerId,
                    p_event_id: event_id,
                    p_created_by_type: requesterType,
                    p_created_by_name: baseName,  // ← Use clean name without "(AI)"
                    p_created_by_ai: true,        // ← Boolean flag for AI creation
                    p_last_edited_by_type: requesterType,
                    p_last_edited_by_name: baseName,  // ← Use clean name without "(AI)"
                    p_last_edited_by_ai: true         // ← Boolean flag for AI edit
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
                            file_path: attachment.file_path.startsWith('chat_attachments/') ? attachment.file_path : `chat_attachments/${attachment.file_path}`,
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
                      uploaded_files: uploadedFiles,
                      additional_persons_count: formattedAdditionalPersons.length,
                      event_name: event_name || null,
                      is_recurring: is_recurring || false,
                      repeat_pattern: repeat_pattern || null
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
                    p_additional_persons: formattedAdditionalPersons,
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
                            file_path: attachment.file_path.startsWith('chat_attachments/') ? attachment.file_path : `chat_attachments/${attachment.file_path}`,
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
                    
                    
                    // Send email notifications to ALL persons with emails
                    try {
                      // Get business profile for email
                      const { data: businessProfile } = await supabaseAdmin
                        .from('business_profiles')
                        .select('business_name, contact_address')
                        .eq('user_id', ownerId)
                        .maybeSingle();
                      
                      const emailsSent = [];
                      
                      // Send email to main person if they have valid email
                      if (social_media && social_media.includes('@')) {
                        console.log(`    📧 Sending approval email to main person: ${social_media}`);
                        
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
                          console.error(`    ⚠️ Email sending failed for ${social_media}:`, emailError);
                        } else {
                          console.log(`    ✅ Approval email sent to ${full_name}`);
                          emailsSent.push(full_name);
                        }
                      }
                      
                      // Send emails to ALL additional persons who have email addresses
                      if (formattedAdditionalPersons && formattedAdditionalPersons.length > 0) {
                        for (const person of formattedAdditionalPersons) {
                          const personEmail = person.socialNetworkLink;
                          const personName = person.userSurname;
                          
                          if (personEmail && personEmail.includes('@')) {
                            console.log(`    📧 Sending approval email to additional person: ${personEmail}`);
                            
                            const { error: emailError } = await supabaseAdmin.functions.invoke('send-booking-approval-email', {
                              body: {
                                recipientEmail: personEmail,
                                fullName: personName,
                                businessName: businessProfile?.business_name || 'Business',
                                startDate: startDateUTC,
                                endDate: endDateUTC,
                                paymentStatus: person.paymentStatus || 'not_paid',
                                paymentAmount: person.paymentAmount ? parseFloat(person.paymentAmount) : null,
                                businessAddress: businessProfile?.contact_address || '',
                                eventId: newEventId,
                                language: userLanguage,
                                eventNotes: person.eventNotes || ''
                              }
                            });
                            
                            if (emailError) {
                              console.error(`    ⚠️ Email sending failed for ${personEmail}:`, emailError);
                            } else {
                              console.log(`    ✅ Approval email sent to ${personName}`);
                              emailsSent.push(personName);
                            }
                          }
                        }
                      }
                      
                      console.log(`    📧 Total emails sent: ${emailsSent.length} - Recipients: ${emailsSent.join(', ')}`);
                    } catch (emailError) {
                      console.error('    ⚠️ Email notification error:', emailError);
                    }
                    
                    toolResult = { 
                      success: true, 
                      event_id: newEventId, 
                      action: 'created',
                      message: `Event created: ${full_name}`,
                      uploaded_files: uploadedFiles,
                      email_sent: social_media && social_media.includes('@'),
                      additional_persons_count: formattedAdditionalPersons.length,
                      event_name: event_name || null,
                      is_recurring: is_recurring || false,
                      repeat_pattern: repeat_pattern || null,
                      repeat_until: repeat_until || null
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
              const { task_id, task_name, description, status, deadline, reminder, email_reminder, assigned_to_name } = args;
              
              console.log(`    ✅ ${task_id ? 'Updating' : 'Creating'} task: ${task_name}`, { 
                status,
                assigned_to_name,
                deadline,
                reminder,
                has_attachments: uploadedFileRecords.length > 0
              });
              
              try {
                // CRITICAL: Convert local datetime to UTC (same as events)
                const convertLocalToUTC = (localDateTimeStr: string): string => {
                  if (!localDateTimeStr) return null;
                  
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
                
                // Convert deadline and reminder to UTC
                const deadlineUTC = deadline ? convertLocalToUTC(deadline) : null;
                const reminderUTC = reminder ? convertLocalToUTC(reminder) : null;
                
                console.log('🕐 Task timezone conversion:', {
                  localDeadline: deadline,
                  utcDeadline: deadlineUTC,
                  localReminder: reminder,
                  utcReminder: reminderUTC,
                  effectiveTZ,
                  tzOffsetMinutes
                });
                
                // Auto-resolve assignment by name (like events auto-handle files!)
                let assignedToType = null;
                let assignedToId = null;
                let assignedToName = null;
                let assignedToAvatar = null;
                
                if (assigned_to_name) {
                  const nameLower = assigned_to_name.toLowerCase().trim();
                  console.log(`    👤 Resolving assignment for: "${assigned_to_name}"`);
                  
                  if (nameLower === 'admin' || nameLower === 'me') {
                    assignedToType = 'admin';
                    assignedToId = ownerId;
                    assignedToName = 'Admin';
                    
                    // Fetch admin avatar
                    const { data: profile } = await supabaseAdmin
                      .from('profiles')
                      .select('avatar_url')
                      .eq('id', ownerId)
                      .single();
                    assignedToAvatar = profile?.avatar_url || null;
                    
                    console.log(`    ✓ Assigned to admin (board owner)`);
                  } else {
                    // Check sub-users by name match
                    const { data: subUsers } = await supabaseAdmin
                      .from('sub_users')
                      .select('id, fullname, email, avatar_url')
                      .eq('board_owner_id', ownerId);
                    
                    const match = subUsers?.find(su => 
                      su.fullname?.toLowerCase().includes(nameLower) ||
                      su.email?.toLowerCase().includes(nameLower)
                    );
                    
                    if (match) {
                      assignedToType = 'sub_user';
                      assignedToId = match.id;
                      assignedToName = match.fullname || match.email;
                      assignedToAvatar = match.avatar_url || null;
                      console.log(`    ✓ Assigned to sub-user: ${match.fullname} (${match.id})`);
                    } else {
                      console.log(`    ⚠️ No match found for "${assigned_to_name}" - creating unassigned task`);
                    }
                  }
                }
                
                // Normalize status
                const normalizedStatus = normalizeTaskStatus(status);
                console.log(`    📊 Status: "${status}" → "${normalizedStatus}"`);
                
                const taskData = {
                  title: task_name,
                  description: description || "",
                  status: normalizedStatus,
                  user_id: ownerId,
                  position: 0,
                  deadline_at: deadlineUTC,
                  reminder_at: reminderUTC,
                  email_reminder_enabled: reminder ? true : (email_reminder || false),
                  assigned_to_type: assignedToType,
                  assigned_to_id: assignedToId,
                  assigned_to_name: assignedToName,
                  assigned_to_avatar_url: assignedToAvatar,
                  assigned_at: assignedToId ? new Date().toISOString() : null,
                  assigned_by_type: assignedToId ? requesterType : null,
                  assigned_by_id: assignedToId ? (requesterType === 'admin' ? ownerId : requesterIdentity?.id) : null,
                  created_by_type: requesterType,
                  created_by_name: baseName,  // ← Use clean name without "(AI)"
                  created_by_ai: true,        // ← Boolean flag for AI creation
                  last_edited_by_type: requesterType,
                  last_edited_by_name: baseName,  // ← Use clean name without "(AI)"
                  last_edited_by_ai: true,        // ← Boolean flag for AI edit
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
                    // Auto-link uploaded files (like events!)
                    if (uploadedFileRecords.length > 0) {
                      console.log(`    📎 Auto-linking ${uploadedFileRecords.length} files to task`);
                      for (const file of uploadedFileRecords) {
                        await supabaseAdmin
                          .from('files')
                          .update({ task_id: task_id, parent_type: 'task' })
                          .eq('id', file.id);
                      }
                    }
                    
                    toolResult = { 
                      success: true, 
                      task_id: task_id,
                      action: 'updated',
                      files_attached: uploadedFileRecords.length,
                      assigned_to: assignedToType ? `${assignedToType}: ${assigned_to_name}` : 'unassigned',
                      message: `Task updated: ${task_name}`
                    };
                    
                    // Task update complete - frontend will pick it up via postgres_changes listener
                    console.log(`    ✅ Task updated in database: ${task_id}`);
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
                    
                    // Auto-link uploaded files (like events!)
                    if (uploadedFileRecords.length > 0) {
                      console.log(`    📎 Auto-linking ${uploadedFileRecords.length} files to new task`);
                      for (const file of uploadedFileRecords) {
                        await supabaseAdmin
                          .from('files')
                          .update({ task_id: newTask.id, parent_type: 'task' })
                          .eq('id', file.id);
                      }
                    }
                    
                    toolResult = { 
                      success: true, 
                      task_id: newTask.id,
                      action: 'created',
                      files_attached: uploadedFileRecords.length,
                      assigned_to: assignedToType ? `${assignedToType}: ${assigned_to_name}` : 'unassigned',
                      message: `Task created: ${task_name}. ${uploadedFileRecords.length > 0 ? `Files attached: ${uploadedFileRecords.map(f => f.filename).join(', ')}.` : ''} ${assignedToType ? `Assigned to ${assigned_to_name}.` : ''}`
                    };
                    
                    // Task created in database - frontend will pick it up via postgres_changes listener
                    console.log(`    ✅ Task created in database: ${newTask.id}`);
                  }
                }
              } catch (error) {
                console.error('    ❌ Error in create_or_update_task:', error);
                toolResult = { success: false, error: error.message || 'Unknown error' };
              }
              break;
            }
            
            case 'get_sub_users': {
              console.log('    👥 Fetching sub-users (team members)');
              
              try {
                const { data: subUsers, error: subUsersError } = await supabaseClient
                  .from('sub_users')
                  .select('id, fullname, email, avatar_url')
                  .eq('board_owner_id', ownerId);
                  
                if (subUsersError) {
                  console.error('    ❌ Failed to fetch sub-users:', subUsersError);
                  toolResult = { success: false, error: subUsersError.message };
                } else {
                  console.log(`    ✅ Found ${subUsers.length} sub-users`);
                  toolResult = { 
                    success: true, 
                    sub_users: subUsers,
                    count: subUsers.length,
                    message: subUsers.length > 0 ? `Found ${subUsers.length} team member(s)` : 'No team members - this is a solo workspace'
                  };
                }
              } catch (error) {
                console.error('    ❌ Error fetching sub-users:', error);
                toolResult = { success: false, error: error.message || 'Unknown error' };
              }
              break;
            }
            
            case 'get_public_board_status': {
              console.log('    🌐 Checking public board status');
              
              try {
                const { data: publicBoard, error: boardError } = await supabaseClient
                  .from('public_boards')
                  .select('id, slug, is_active, magic_word, created_at')
                  .eq('user_id', ownerId)
                  .maybeSingle();
                  
                if (boardError) {
                  console.error('    ❌ Failed to fetch public board:', boardError);
                  toolResult = { success: false, error: boardError.message };
                } else {
                  console.log(`    ✅ Public board ${publicBoard?.is_active ? 'enabled' : 'not enabled'}`);
                  toolResult = { 
                    success: true, 
                    public_board: publicBoard,
                    is_enabled: !!publicBoard?.is_active,
                    message: publicBoard?.is_active ? `Public board enabled at /${publicBoard.slug}` : 'Public board not enabled'
                  };
                }
              } catch (error) {
                console.error('    ❌ Error checking public board:', error);
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
                  created_by_name: baseName,  // ← Use clean name without "(AI)"
                  created_by_ai: true,        // ← Boolean flag for AI creation
                  last_edited_by_type: requesterType,
                  last_edited_by_name: baseName,  // ← Use clean name without "(AI)"
                  last_edited_by_ai: true         // ← Boolean flag for AI edit
                };

                // CRITICAL: ALWAYS search for existing customer by name first to prevent duplicates
                // This ensures we update existing customers instead of creating new ones
                console.log(`    🔍 Searching for existing customer: "${full_name}"`);
                
                const { data: existingCustomers, error: searchError } = await supabaseAdmin
                  .from('customers')
                  .select('id, user_surname, created_at')
                  .eq('user_id', ownerId)
                  .is('deleted_at', null)
                  .order('created_at', { ascending: false });
                
                let foundCustomerId: string | null = null;
                
                if (!searchError && existingCustomers && existingCustomers.length > 0) {
                  // Try exact match first (case-insensitive)
                  const exactMatch = existingCustomers.find(c => 
                    c.user_surname?.toLowerCase().trim() === full_name.toLowerCase().trim()
                  );
                  
                  if (exactMatch) {
                    foundCustomerId = exactMatch.id;
                    console.log(`    ✅ Found EXACT match: ${exactMatch.user_surname} (ID: ${foundCustomerId}, Created: ${exactMatch.created_at})`);
                  } else if (!customer_id) {
                    // If no customer_id was provided and no exact match, this is a NEW customer
                    console.log(`    ℹ️ No exact match for "${full_name}" - will create new customer`);
                  }
                }
                
                // Determine if this is an update or create
                const isUpdate = foundCustomerId || customer_id;
                
                if (isUpdate) {
                  // UPDATE existing customer
                  const updateId = foundCustomerId || customer_id;
                  console.log(`    📝 Updating customer ID: ${updateId}`);
                  
                  const { data: updatedCustomer, error: updateError } = await supabaseAdmin
                    .from('customers')
                    .update(customerData)
                    .eq('id', updateId)
                    .eq('user_id', ownerId)
                    .select()
                    .single();
                  
                  if (updateError) {
                    console.error('    ❌ Failed to update customer:', updateError);
                    toolResult = { 
                      success: false, 
                      error: `Failed to update customer: ${updateError.message}`
                    };
                  } else {
                    console.log(`    ✅ Customer updated: ${full_name} (ID: ${updatedCustomer.id})`);
                    
                    // CRITICAL FIX: Link chat attachment files to customer during EDIT
                    let uploadedFiles = [];
                    if (attachments && attachments.length > 0) {
                      console.log(`    📎 Linking ${attachments.length} file attachments to updated customer ${updatedCustomer.id}`);
                      for (const attachment of attachments) {
                        try {
                          console.log(`    → Linking ${attachment.filename} from chat_attachments`);
                          
                          // Create customer_files_new record pointing to chat_attachments file
                          const { error: dbError } = await supabaseAdmin.from('customer_files_new').insert({
                            customer_id: updatedCustomer.id,
                            user_id: ownerId,
                            filename: attachment.filename,
                            file_path: attachment.file_path.startsWith('chat_attachments/') ? attachment.file_path : `chat_attachments/${attachment.file_path}`,
                            content_type: attachment.content_type,
                            size: attachment.size
                          });
                          
                          if (dbError) {
                            console.error(`    ❌ DB insert error for ${attachment.filename}:`, dbError);
                            continue;
                          }
                          
                          uploadedFiles.push(attachment.filename);
                          console.log(`    ✅ File ${attachment.filename} linked to customer`);
                        } catch (fileError) {
                          console.error(`    ❌ Error linking file ${attachment.filename}:`, fileError);
                        }
                      }
                    }
                    
                    let message = `Customer updated: ${full_name}`;
                    if (uploadedFiles.length > 0) {
                      message += ` with ${uploadedFiles.length} new file(s) attached`;
                    }
                    
                    toolResult = { 
                      success: true, 
                      customer_id: updatedCustomer.id,
                      action: 'updated',
                      message,
                      uploaded_files: uploadedFiles
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
                } else {
                  // CREATE new customer
                  console.log(`    ➕ Creating new customer: ${full_name}`);
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
                    
                    // Link chat attachment files to new customer (same pattern as events)
                    let uploadedFiles = [];
                    if (attachments && attachments.length > 0) {
                      console.log(`    📎 Linking ${attachments.length} file attachments to new customer ${newCustomer.id}`);
                      for (const attachment of attachments) {
                        try {
                          console.log(`    → Linking ${attachment.filename} from chat_attachments`);
                          
                          // Create customer_files_new record pointing to chat_attachments file
                          // Use same format as events: include bucket prefix in file_path
                          const { error: dbError } = await supabaseAdmin.from('customer_files_new').insert({
                            customer_id: newCustomer.id,
                            user_id: ownerId,
                            filename: attachment.filename,
                            file_path: attachment.file_path.startsWith('chat_attachments/') ? attachment.file_path : `chat_attachments/${attachment.file_path}`,
                            content_type: attachment.content_type,
                            size: attachment.size
                          });
                          
                          if (dbError) {
                            console.error(`    ❌ DB insert error for ${attachment.filename}:`, dbError);
                            continue;
                          }
                          
                          uploadedFiles.push(attachment.filename);
                          console.log(`    ✅ File ${attachment.filename} linked to customer`);
                        } catch (fileError) {
                          console.error(`    ❌ Error linking file ${attachment.filename}:`, fileError);
                        }
                      }
                    }
                    
                    let message = `Customer created: ${full_name}`;
                    if (uploadedFiles.length > 0) {
                      message += ` with ${uploadedFiles.length} file(s)`;
                    }
                    
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
                        p_created_by_name: baseName,  // ← Use clean name without "(AI)"
                        p_created_by_ai: true,         // ← Boolean flag for AI creation
                        p_last_edited_by_type: requesterType,
                        p_last_edited_by_name: baseName,  // ← Use clean name without "(AI)"
                        p_last_edited_by_ai: true         // ← Boolean flag for AI edit
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
                      message,
                      uploaded_files: uploadedFiles
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
        content: `Generate a concise confirmation message about the action result. Use the user's language (${userLanguage}).

⚠️ CRITICAL RULES - FAILURE TO FOLLOW THESE WILL BREAK THE UI:
1. NEVER EVER show raw JSON objects, arrays, or code-like output ({"is_success": true...})
2. NEVER show technical data like tool_code, function outputs, or debugging info
3. ALWAYS format data as clean, human-readable text
4. DO NOT add "how else can I help?" or "Is there anything else?" - NEVER ask this
5. DO NOT add extra pleasantries or filler text
6. Do not add file names if there are no files attached
7. Do not mention assignee names if there are no assignees

RESPONSE FORMAT (choose ONE based on result):
- If time_conflict: "⚠️ That time slot is already booked with [conflict name]. Would you like a different time?"
- If task created: "✅ Task created: [name]. Assigned to [person]." (only mention assignee if exists)
- If event created: "✅ Event created: [name] on [date/time]."
- If customer created: "✅ Customer created: [name]."
- If updated: "✅ [Type] updated: [name]."
- If files attached: Add "📎 Files attached: [list names]" (ONLY if files exist)
- If reminder: "✅ Reminder set! I'll remind you about [title] at [display_time]. You'll receive both email and dashboard notification."
- If excel: Include download link
- If error: State the error clearly

**CUSTOMER COUNT REQUESTS (NEW CRITICAL RULE)**:
If user asks ONLY for count (e.g., "customer count", "how many customers", "tell me count"):
- ONLY show the count, DO NOT show the full list
- Format: "You have [count] customers this month." 
- STOP there, do not list all customers

**CUSTOMER LIST FORMATTING (CRITICAL)**:
If user asks for list/details (e.g., "show customers", "list customers", "who are my customers"):
1. NEVER EVER return raw JSON like {"is_success": true, "customers": [...]}
2. NEVER show code-like objects or arrays
3. ALWAYS format as a clean, numbered list with details
4. Include: name, email (if provided), phone (if provided), date added
5. Start with total count: "You have [count] customers this month."

Example CORRECT format:
"You have 44 customers this month. Here's the list:

1. John Doe (email: john@example.com, added on 2025-10-15)
2. Jane Smith (phone: 555-1234, added on 2025-10-14)
3. Bob Johnson (added on 2025-10-13)
..."

Example FORBIDDEN format:
❌ {"is_success": true, "customers": [{"customer_id": "c_123", "full_name": "weqe"...}]}
❌ [{"customer_id": "c_20251015", "full_name": "weqe", "email": null...}]

Be direct. Be concise. No extra text.`
      };
      
      const finalResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [...finalMessages, responsePrompt],
          temperature: 0.7,
          max_tokens: 2048
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
