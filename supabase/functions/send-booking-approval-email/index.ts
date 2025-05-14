
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from '../_shared/cors.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.47.2';

const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';

const supabase = createClient(supabaseUrl, supabaseKey);

serve(async (req) => {
  // Handle CORS pre-flight request
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { event_id } = await req.json();

    if (!event_id) {
      return new Response(JSON.stringify({ error: 'Missing event_id' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch event details
    const { data: event, error: eventError } = await supabase
      .from('events')
      .select(`
        id,
        start_date,
        end_date,
        title,
        notes,
        customer_id,
        customers (
          full_name,
          user_number,
          social_network_link
        ),
        payment_status,
        payment_amount,
        business_profiles (
          business_name,
          email
        )
      `)
      .eq('id', event_id)
      .single();

    if (eventError) {
      console.error('Error fetching event:', eventError);
      return new Response(JSON.stringify({ error: 'Failed to fetch event details' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!event) {
      return new Response(JSON.stringify({ error: 'Event not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Extract customer and event details
    const customerName = event.customers?.full_name || 'N/A';
    const customerEmail = event.customers?.social_network_link || 'N/A';
    const eventTitle = event.title || 'N/A';
    const eventStartDate = new Date(event.start_date).toLocaleDateString();
    const eventStartTime = new Date(event.start_date).toLocaleTimeString();
    const eventEndDate = new Date(event.end_date).toLocaleDateString();
    const eventEndTime = new Date(event.end_date).toLocaleTimeString();
    const eventNotes = event.notes || 'N/A';
    const paymentStatus = event.payment_status || 'not_paid';
    const paymentAmount = event.payment_amount || '0';
    const businessName = event.business_profiles?.business_name || 'Your Business';
    const businessEmail = event.business_profiles?.email || 'your_email@example.com';

    // Fetch business profile's language
    const { data: businessProfile, error: businessProfileError } = await supabase
      .from('business_profiles')
      .select('language')
      .eq('id', event.business_profiles.id)
      .single();

    if (businessProfileError) {
      console.error('Error fetching business profile:', businessProfileError);
      return new Response(JSON.stringify({ error: 'Failed to fetch business profile details' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const language = businessProfile?.language || 'en';

    // Function to get translated payment status
    const getTranslatedPaymentStatus = (status: string, language: string = 'en') => {
      // Normalize language to ensure we handle all variants
      const normalizedLang = language.substring(0, 2).toLowerCase();
      
      // Default to 'not_paid' if status is not recognized
      if (!status || (status !== 'not_paid' && status !== 'partly_paid' && status !== 'fully_paid' && 
          status !== 'partly' && status !== 'fully')) {
        // Return translated status based on language
        if (normalizedLang === 'ka') return "გადაუხდელი";
        if (normalizedLang === 'es') return "No Pagado";
        return "Not Paid";
      }
      
      // Handle statuses
      if (status === 'fully_paid' || status === 'fully') {
        // Return translated payment status based on language
        if (normalizedLang === 'ka') return "სრულად გადახდილი";
        if (normalizedLang === 'es') return "Pagado Completamente";
        return "Fully Paid";
      }
      
      if (status === "partly_paid" || status === "partly") {
        // Return translated payment status based on language
        if (normalizedLang === 'ka') return "ნაწილობრივ გადახდილი";
        if (normalizedLang === 'es') return "Pagado Parcialmente";
        return "Partly Paid";
      }
      
      // Default case for 'not_paid'
      if (normalizedLang === 'ka') return "გადაუხდელი";
      if (normalizedLang === 'es') return "No Pagado";
      return "Not Paid";
    };

    const translatedPaymentStatus = getTranslatedPaymentStatus(paymentStatus, language);

    // Construct the email body
    const emailBody = `
      Dear ${customerName},

      Your booking request has been approved! Here are the details:

      Event: ${eventTitle}
      Date: ${eventStartDate}
      Time: ${eventStartTime} - ${eventEndTime}
      Notes: ${eventNotes}
      Payment Status: ${translatedPaymentStatus}
      Payment Amount: ${paymentAmount}

      Thank you for booking with ${businessName}!
    `;

    // Send email using Supabase Edge Function (replace with your actual email sending logic)
    const { error: emailError } = await supabase.functions.invoke('send-email', {
      body: {
        to: customerEmail,
        subject: 'Booking Request Approved',
        body: emailBody,
      },
    });

    if (emailError) {
      console.error('Error sending email:', emailError);
      return new Response(JSON.stringify({ error: 'Failed to send approval email' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ data: 'Approval email sent successfully' }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error', details: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
