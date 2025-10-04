import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.47.2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    )

    // Get the current user
    const {
      data: { user },
    } = await supabaseClient.auth.getUser()

    if (!user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    const { messageId, content } = await req.json()

    if (!messageId || !content?.trim()) {
      return new Response(
        JSON.stringify({ error: 'Message ID and content are required' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    console.log('📝 Edit message request:', { messageId, userId: user.id, contentLength: content.length })

    // Get the message to validate ownership and check edit time limit
    const { data: message, error: fetchError } = await supabaseClient
      .from('chat_messages')
      .select('*')
      .eq('id', messageId)
      .single()

    if (fetchError || !message) {
      console.error('❌ Message not found:', fetchError)
      return new Response(
        JSON.stringify({ error: 'Message not found' }),
        { 
          status: 404, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Check ownership
    const isOwner = (message.sender_type === 'admin' && message.sender_user_id === user.id) ||
                   (message.sender_type === 'sub_user' && message.sender_sub_user_id === user.id)

    if (!isOwner) {
      console.error('❌ Not message owner:', { messageOwner: message.sender_user_id, currentUser: user.id })
      return new Response(
        JSON.stringify({ error: 'You can only edit your own messages' }),
        { 
          status: 403, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Check 12-hour time limit
    const messageTime = new Date(message.created_at).getTime()
    const now = new Date().getTime()
    const hoursDiff = (now - messageTime) / (1000 * 60 * 60)

    if (hoursDiff > 12) {
      console.error('❌ Edit time limit exceeded:', { hoursDiff })
      return new Response(
        JSON.stringify({ error: 'Messages can only be edited within 12 hours' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Only allow editing text messages
    if (message.message_type !== 'text' && message.message_type !== null) {
      return new Response(
        JSON.stringify({ error: 'Only text messages can be edited' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Store original content if this is the first edit
    const updateData: any = {
      content: content.trim(),
      edited_at: new Date().toISOString(),
    }

    if (!message.original_content) {
      updateData.original_content = message.content
    }

    // Update the message
    const { error: updateError } = await supabaseClient
      .from('chat_messages')
      .update(updateData)
      .eq('id', messageId)

    if (updateError) {
      console.error('❌ Error updating message:', updateError)
      return new Response(
        JSON.stringify({ error: 'Failed to update message' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    console.log('✅ Message edited successfully:', messageId)

    return new Response(
      JSON.stringify({ success: true }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('❌ Unexpected error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})