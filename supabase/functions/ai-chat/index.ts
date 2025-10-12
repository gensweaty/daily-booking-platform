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
    const { channelId, prompt, ownerId } = await req.json();
    
    console.log('🤖 AI Chat request:', { channelId, ownerId, promptLength: prompt?.length });

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
          description: "Get the current date and time. Use this first to know what day it is before fetching schedules.",
          parameters: { type: "object", properties: {} }
        }
      },
      {
        type: "function",
        function: {
          name: "get_todays_schedule",
          description: "Get today's calendar events and appointments",
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
    
    const messages = [
      { 
        role: "system", 
        content: `You are Smartbookly AI, an intelligent assistant for a booking management and CRM workspace. You have comprehensive READ-ONLY access to:

**Calendar & Events**: View schedules, check availability, see booking details
**Tasks**: Monitor progress, completion rates, and priorities  
**CRM**: Search customers, view payment histories, contact information
**Booking Requests**: Check pending approvals and booking statistics
**Business Analytics**: Revenue summaries, monthly statistics, trends

**Key Capabilities**:
1. Always check the current date/time first using get_current_datetime before providing schedules
2. Provide actionable insights based on real data
3. Identify patterns in bookings, payments, and customer behavior
4. Suggest optimal time slots based on calendar availability
5. Alert about pending bookings that need attention
6. Summarize task progress and highlight overdue items
7. Give payment summaries and revenue insights

**Important**:
- You CANNOT modify data - you're read-only
- Always provide specific, data-backed responses
- When suggesting actions, explain why based on the data you see
- Be concise but informative
- Use the user's timezone context when discussing dates/times`
      },
      { role: "user", content: prompt }
    ];

    console.log('📤 Calling Lovable AI...');
    
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
              const now = new Date();
              toolResult = {
                currentDateTime: now.toISOString(),
                date: now.toISOString().split('T')[0],
                time: now.toTimeString().split(' ')[0],
                dayOfWeek: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][now.getDay()],
                timezone: 'UTC'
              };
              console.log(`    ✓ Current date/time: ${toolResult.date}`);
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

      // Get final response after tool execution
      console.log('📤 Getting final AI response with tool results...');
      const finalResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: finalMessages
        }),
      });

      if (finalResponse.ok) {
        const finalResult = await finalResponse.json();
        const finalMessage = finalResult.choices[0].message;
        console.log('✅ Final response received');
        
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
