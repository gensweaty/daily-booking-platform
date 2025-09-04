import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

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

    const { messageId } = await req.json()

    if (!messageId) {
      return new Response(
        JSON.stringify({ error: 'Message ID is required' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    console.log('🗑️ Delete message request:', { messageId, userId: user.id })

    // Get the message to validate ownership
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
        JSON.stringify({ error: 'You can only delete your own messages' }),
        { 
          status: 403, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Soft delete - mark as deleted and replace content
    const { error: updateError } = await supabaseClient
      .from('chat_messages')
      .update({
        is_deleted: true,
        content: 'Message deleted',
        updated_at: new Date().toISOString(),
      })
      .eq('id', messageId)

    if (updateError) {
      console.error('❌ Error deleting message:', updateError)
      return new Response(
        JSON.stringify({ error: 'Failed to delete message' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    console.log('✅ Message deleted successfully:', messageId)

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