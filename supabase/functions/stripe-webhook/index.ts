
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@12.18.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const stripe = new Stripe(Deno.env.get("STRIPE_API_KEY") || "", {
  apiVersion: "2023-10-16",
  httpClient: Stripe.createFetchHttpClient(),
});

const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET") || "";

const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const supabase = createClient(supabaseUrl, supabaseServiceKey);

function logStep(step: string, data?: any) {
  console.log(`[STRIPE-WEBHOOK] ${step}`, data ? JSON.stringify(data) : "");
}

serve(async (req) => {
  // Get the signature from the header
  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return new Response(
      JSON.stringify({ error: "No stripe signature found" }),
      { status: 400 }
    );
  }

  try {
    // Get the raw body directly as text
    const rawBody = await req.text();
    
    // Verify the webhook signature
    const event = await stripe.webhooks.constructEventAsync(
      rawBody,
      signature,
      webhookSecret,
      undefined,
      Stripe.createSubtleCryptoProvider()
    );
    
    logStep(`Processing ${event.type} event`);
    
    // Handle specific event types
    switch (event.type) {
      case 'checkout.session.completed':
        const session = event.data.object;
        await handleCheckoutSessionCompleted(session);
        break;
        
      case 'customer.subscription.updated':
      case 'customer.subscription.created':
        const subscription = event.data.object;
        await handleSubscriptionUpdated(subscription);
        break;
    }
    
    return new Response(JSON.stringify({ success: true }), { status: 200 });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    logStep(`Error processing webhook: ${errorMessage}`);
    return new Response(
      JSON.stringify({ error: `Webhook Error: ${errorMessage}` }),
      { status: 400 }
    );
  }
});

async function handleCheckoutSessionCompleted(session) {
  logStep("Processing completed checkout session", { sessionId: session.id });

  // Extract customer details
  const customerId = session.customer;
  const customerEmail = session.customer_details?.email;
  const subscriptionId = session.subscription;
  
  // Get user ID from metadata or lookup by email
  let userId = session.metadata?.user_id;
  
  if (!userId && customerEmail) {
    // Find user by email if not in metadata
    const { data: users } = await supabase.auth.admin.listUsers();
    const matchingUser = users.users.find(u => u.email === customerEmail);
    if (matchingUser) {
      userId = matchingUser.id;
      logStep("Found user by email", { userId });
    }
  }
  
  if (!userId) {
    logStep("No user ID found for checkout session");
    return;
  }
  
  // Get subscription details from Stripe
  const stripeSubscription = await stripe.subscriptions.retrieve(subscriptionId);
  const planType = stripeSubscription.items.data[0].plan.interval === 'month' ? 'monthly' : 'yearly';
  const currentPeriodEnd = new Date(stripeSubscription.current_period_end * 1000);
  
  // Update subscription in database
  const { error } = await supabase
    .from('subscriptions')
    .upsert({
      user_id: userId,
      email: customerEmail,
      status: stripeSubscription.status,
      stripe_customer_id: customerId,
      stripe_subscription_id: subscriptionId,
      plan_type: planType,
      current_period_end: currentPeriodEnd.toISOString(),
      updated_at: new Date().toISOString()
    }, { onConflict: 'user_id' });
  
  if (error) {
    logStep("Error updating subscription", { error });
  } else {
    logStep("Successfully updated subscription");
  }
}

async function handleSubscriptionUpdated(subscription) {
  logStep("Processing subscription update", { subscriptionId: subscription.id });
  
  // Get subscription details
  const customerId = subscription.customer;
  const status = subscription.status;
  const subscriptionId = subscription.id;
  
  // Find user by customer ID
  const { data, error } = await supabase
    .from('subscriptions')
    .select('user_id, email')
    .eq('stripe_customer_id', customerId)
    .single();
    
  if (error || !data) {
    logStep("No user found with customer ID", { customerId });
    return;
  }
  
  // Update subscription status
  const { error: updateError } = await supabase
    .from('subscriptions')
    .update({
      status: status,
      current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq('user_id', data.user_id);
  
  if (updateError) {
    logStep("Error updating subscription status", { updateError });
  } else {
    logStep("Successfully updated subscription status");
  }
}
