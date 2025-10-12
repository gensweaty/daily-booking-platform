import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.47.2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { channelId, prompt, ownerId, conversationHistory = [], userTimezone = 'UTC', currentLocalTime } = await req.json();
    
    console.log('🤖 AI Chat request:', { channelId, ownerId, promptLength: prompt?.length, historyLength: conversationHistory.length, userTimezone });

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
          description: "Get tasks with optional status filter",
          parameters: {
            type: "object",
            properties: {
              status: { type: "string", enum: ["todo", "in_progress", "done"], description: "Filter by status (optional)" }
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
          description: "Generate an Excel (.xlsx) file with data and provide download link. Use this when user asks for 'excel report', 'export to excel', 'download excel', 'create spreadsheet', etc. Available report types: 'payments' (payment history), 'events' (calendar events), 'tasks' (task list), 'customers' (CRM data), 'bookings' (booking requests). ALWAYS use this tool when user asks for Excel/spreadsheet - don't direct them to do it manually.",
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
                description: "Number of months of historical data (default: 12)",
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
          description: `Creates a custom reminder. User gets dashboard + email notifications at scheduled time. WORKFLOW: Call get_current_datetime(), add duration, call this with UTC time. RESPONSE: Say "✅ Reminder set! I'll remind you about '{title}' at {display_time}. You'll receive both an email and dashboard notification." Use display_time from response, never UTC.`,
          parameters: {
            type: "object",
            properties: {
              title: {
                type: "string",
                description: "Brief title for the reminder notification"
              },
              message: {
                type: "string",
                description: "Optional detailed message for the notification"
              },
              remind_at: {
                type: "string",
                description: `ISO 8601 UTC timestamp when notification should trigger. Example: if currentTime is "2025-10-12T18:35:00.000Z" and user wants "in 5 minutes", use "2025-10-12T18:40:00.000Z".`
              }
            },
            required: ["title", "remind_at"]
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

    const systemPrompt = `You are Smartbookly AI, an intelligent business assistant with deep integration into the user's business management platform.

**USER TIMEZONE**: ${userTimezone}
**CURRENT DATE CONTEXT**: Today is ${dayOfWeek}, ${today}. Tomorrow is ${tomorrow}.

**CREATING REMINDERS**:
When user says "remind me in X" or "set reminder":
1. Call get_current_datetime()
2. Add duration to get remind_at (UTC)
3. Call create_custom_reminder()
4. Response: "✅ Reminder set! I'll remind you about '{title}' at {display_time}. You'll receive both an email and dashboard notification."

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
2. **ALWAYS fetch and analyze data when asked**: 
   - If user asks about payments, revenue, or financial history → Call analyze_payment_history
   - If user asks for "excel report", "export to excel", "download spreadsheet" → Call generate_excel_report with appropriate report_type
   - If user asks "what's on my schedule", "today's calendar" → Call get_todays_schedule
   - If user asks about "upcoming", "this week" → Call get_upcoming_events
   - NEVER respond about data without calling the actual data fetching tool first
   - NEVER direct users to do manual exports - you have the generate_excel_report tool to create files directly
3. **Connect the dots**: Find patterns across calendar, tasks, and CRM data
4. **Be proactive**: Suggest actions based on what you see (e.g., "You have 3 pending bookings that need approval")
5. **Natural language dates**: Understand "tomorrow", "next Monday", "in 2 weeks" - calculate the exact date from today (${today})
6. **Memory**: Reference previous messages - if user asks followup questions, maintain context
7. **Be conversational**: Don't be robotic, use emojis, be helpful and friendly

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

**LIMITATIONS**:
❌ You CANNOT modify data (read-only access)
❌ You CANNOT create/edit/delete events, tasks, customers
✅ You CAN provide insights, answer questions, find information, give recommendations

Remember: You're a smart assistant that understands context, remembers conversation history, and provides useful insights based on real business data!`;

    // Build conversation with history
    const messages = [
      { role: 'system', content: systemPrompt },
      ...conversationHistory.map((msg: any) => ({
        role: msg.role,
        content: msg.content
      })),
      { role: 'user', content: prompt }
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
              let query = supabaseClient
                .from('tasks')
                .select('id, title, description, status, priority, due_date, assignee')
                .eq('user_id', ownerId)
                .is('archived_at', null)
                .order('created_at', { ascending: false });
              
              if (args.status) {
                query = query.eq('status', args.status);
              }
              
              const { data: tasks } = await query.limit(50);
              toolResult = { tasks: tasks || [], filter: args.status || 'all' };
              console.log(`    ✓ Found ${toolResult.tasks.length} tasks`);
              break;
            }

            case 'get_task_statistics': {
              const { data: tasks } = await supabaseClient
                .from('tasks')
                .select('status')
                .eq('user_id', ownerId)
                .is('archived_at', null);
              
              const stats = {
                total: tasks?.length || 0,
                todo: tasks?.filter(t => t.status === 'todo').length || 0,
                in_progress: tasks?.filter(t => t.status === 'in_progress').length || 0,
                done: tasks?.filter(t => t.status === 'done').length || 0
              };
              
              stats['completion_rate'] = stats.total > 0 
                ? Math.round((stats.done / stats.total) * 100) 
                : 0;
              
              toolResult = stats;
              console.log(`    ✓ Task stats: ${stats.completion_rate}% complete`);
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
              } else {
                toolResult = {
                  success: true,
                  download_url: excelData.downloadUrl,
                  filename: excelData.filename,
                  report_type: reportType,
                  record_count: excelData.recordCount
                };
                console.log(`    ✅ Excel report generated: ${excelData.filename}, ${excelData.recordCount} records`);
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
              console.log('📅 Creating custom reminder with args:', JSON.stringify(args));
              const { title, message, remind_at } = args;
              
              // Parse the remind_at time - it should be in UTC ISO format
              const reminderDate = new Date(remind_at);
              const currentTime = new Date();
              
              // Verify remind_at is in the future (with 1 second tolerance)
              if (reminderDate <= new Date(currentTime.getTime() - 1000)) {
                const reminderUTC = reminderDate.toISOString();
                const currentUTC = currentTime.toISOString();
                console.warn(`⚠️ Reminder in the past! Current: ${currentUTC}, Reminder: ${reminderUTC}`);
                toolResult = {
                  success: false,
                  error: `Reminder time must be in the future. Current time (UTC): ${currentUTC}, You tried to schedule: ${reminderUTC}`
                };
                break;
              }
              
              // Format reminder time in user's local timezone for display
              const reminderTimeLocal = reminderDate.toLocaleString('en-US', {
                timeZone: userTimezone,
                year: 'numeric',
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                hour12: true
              });
              
              // Also get time-only format for easier reading
              const reminderTimeShort = reminderDate.toLocaleString('en-US', {
                timeZone: userTimezone,
                hour: '2-digit',
                minute: '2-digit',
                hour12: true
              });
              
              console.log(`⏰ Creating reminder - UTC: ${reminderDate.toISOString()}, User TZ (${userTimezone}): ${reminderTimeLocal}`);
              
              const { data: reminderData, error: reminderError } = await supabaseClient
                .from('custom_reminders')
                .insert({
                  user_id: ownerId,
                  title,
                  message,
                  remind_at
                })
                .select()
                .single();

              if (reminderError) throw reminderError;

              toolResult = {
                success: true,
                reminder_id: reminderData.id,
                title: title,
                display_time: reminderTimeShort,
                display_time_full: reminderTimeLocal,
                user_timezone: userTimezone
              };
              console.log('✅ Reminder created - Display as:', reminderTimeShort, userTimezone);
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
        content: "Respond to the user. If create_custom_reminder was called successfully, say EXACTLY: '✅ Reminder set! I'll remind you about [title] at [display_time]. You'll receive both an email and dashboard notification.' Use the display_time from the tool result. For reports, include download link. Be concise."
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
