
import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0"

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[VERIFY-STRIPE] ${step}${detailsStr}`);
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Check if this is a direct verification request with a session ID
    const { sessionId } = await req.json().catch(() => ({}));
    logStep('Received direct verification request', { sessionId });

    if (!sessionId) {
      logStep('No session ID provided');
      return new Response(
        JSON.stringify({ success: false, error: 'Session ID is required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Get Stripe API key from environment
    const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');
    if (!stripeKey) {
      throw new Error('STRIPE_SECRET_KEY is not set');
    }

    // Initialize Stripe
    const stripe = new Stripe(stripeKey, { apiVersion: '2023-10-16' });

    // Initialize Supabase admin client with service role key
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    );

    // Get the checkout session from Stripe
    logStep('Retrieving checkout session from Stripe', { sessionId });
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (!session) {
      logStep('Session not found');
      return new Response(
        JSON.stringify({ success: false, error: 'Session not found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
      );
    }

    logStep('Session retrieved successfully', { 
      status: session.status, 
      payment_status: session.payment_status,
      customer_email: session.customer_details?.email,
      metadata: session.metadata
    });

    // Check if payment is completed
    if (session.payment_status !== 'paid') {
      logStep('Payment not completed', { payment_status: session.payment_status });
      return new Response(
        JSON.stringify({ success: false, error: 'Payment not completed' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Get user ID from session metadata
    const userId = session.metadata?.user_id;
    const customerEmail = session.customer_details?.email;

    if (!customerEmail) {
      logStep('No email found in session');
      return new Response(
        JSON.stringify({ success: false, error: 'No email associated with session' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    let foundUserId = userId;

    // If no userId in metadata, try to find the user by their email
    if (!foundUserId && customerEmail) {
      logStep('No userId in metadata, searching by email', { email: customerEmail });
      
      try {
        // First check auth users by email
        const { data: users, error: authError } = await supabaseAdmin.auth.admin.listUsers();
        
        if (authError) {
          logStep('Error looking up users:', { error: authError.message });
        } else {
          const matchingUser = users.users.find((u: any) => u.email === customerEmail);
          if (matchingUser) {
            foundUserId = matchingUser.id;
            logStep('Found user by email:', { userId: foundUserId });
          }
        }
      } catch (authError: any) {
        logStep('Error querying auth users:', { error: authError.message });
      }
    }

    // Get subscription details
    const subscriptionId = session.subscription;
    let planType = 'monthly'; // Default to monthly
    let periodEnd = null;

    // If we have subscription details, get more info
    if (subscriptionId) {
      try {
        const subscription = await stripe.subscriptions.retrieve(subscriptionId);
        
        // Calculate end date
        periodEnd = new Date(subscription.current_period_end * 1000).toISOString();
        
        // Try to determine plan type
        if (subscription.items?.data?.length > 0) {
          const item = subscription.items.data[0];
          if (item.plan?.interval === 'year') {
            planType = 'yearly';
          }
        }
        
        logStep('Extracted subscription details', { 
          subscriptionId, 
          planType,
          periodEnd
        });
      } catch (err) {
        logStep('Error retrieving subscription details', { error: err.message });
        // Continue despite subscription lookup error
      }
    } else {
      // If no subscription found but payment is successful, set default end date
      const thirtyDaysFromNow = new Date();
      thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
      periodEnd = thirtyDaysFromNow.toISOString();
      logStep('No subscription found, using default end date', { periodEnd });
    }

    // Create or update subscription in database
    const subscriptionData = {
      user_id: foundUserId,
      email: customerEmail,
      stripe_customer_id: session.customer,
      stripe_subscription_id: subscriptionId,
      status: 'active',
      plan_type: planType,
      current_period_end: periodEnd,
      updated_at: new Date().toISOString()
    };

    logStep('Updating subscription with data:', subscriptionData);

    // Try updating by user_id first if available
    if (foundUserId) {
      try {
        const { data, error } = await supabaseAdmin
          .from('subscriptions')
          .upsert(subscriptionData, { 
            onConflict: 'user_id',
            ignoreDuplicates: false 
          })
          .select()
          .single();
          
        if (error) {
          logStep('Error upserting subscription by user_id:', { error: error.message });
        } else {
          logStep('Successfully updated subscription by user_id:', data);
          
          return new Response(
            JSON.stringify({ 
              success: true, 
              message: 'Subscription verified and updated successfully',
              data: {
                userId: foundUserId,
                email: customerEmail,
                planType
              }
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      } catch (dbError: any) {
        logStep('Database operation error:', { error: dbError.message });
      }
    }

    // If user_id update failed or wasn't available, try by email
    try {
      const { data, error } = await supabaseAdmin
        .from('subscriptions')
        .upsert(subscriptionData, { 
          onConflict: 'email',
          ignoreDuplicates: false 
        })
        .select()
        .single();
        
      if (error) {
        logStep('Error upserting subscription by email:', { error: error.message });
        throw error;
      } else {
        logStep('Successfully updated subscription by email:', data);
        
        return new Response(
          JSON.stringify({ 
            success: true, 
            message: 'Subscription verified and updated successfully by email',
            data: {
              userId: foundUserId,
              email: customerEmail,
              planType
            }
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    } catch (dbError: any) {
      logStep('Database operation error during email upsert:', { error: dbError.message });
      throw dbError;
    }

  } catch (error) {
    logStep('ERROR in verify-stripe-subscription:', { message: error.message });
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
