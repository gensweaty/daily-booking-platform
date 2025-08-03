import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { Resend } from "https://esm.sh/resend@2.0.0";

const resend = new Resend(Deno.env.get('RESEND_API_KEY'));

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface BookingApprovalRequest {
  bookingId: string;
  isReminder?: boolean;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { bookingId, isReminder = false }: BookingApprovalRequest = await req.json();
    
    console.log('📧 Processing booking approval email:', { bookingId, isReminder });
    
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Fetch booking data
    const { data: booking, error: bookingError } = await supabase
      .from('booking_requests')
      .select('*')
      .eq('id', bookingId)
      .single();

    if (bookingError || !booking) {
      console.error('❌ Error fetching booking:', bookingError);
      throw new Error('Booking not found');
    }

    // Get business profile
    const { data: businessProfile, error: businessError } = await supabase
      .from('business_profiles')
      .select('*')
      .eq('id', booking.business_id)
      .single();

    if (businessError) {
      console.log('ℹ️ No business profile found, using default business info');
    }
    
    // Modify only the email subject when isReminder is true
    const emailSubject = isReminder 
      ? `[Reminder] Booking Confirmation - ${businessProfile?.business_name || 'Your Business'}`
      : `Booking Confirmation - ${businessProfile?.business_name || 'Your Business'}`;

    const emailHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Booking Confirmation</title>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #f8f9fa; padding: 20px; text-align: center; border-radius: 5px; }
            .content { padding: 20px 0; }
            .booking-details { background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 15px 0; }
            .footer { text-align: center; padding-top: 20px; border-top: 1px solid #eee; color: #666; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>${isReminder ? '🔔 Reminder: ' : ''}Booking Confirmed</h1>
            </div>
            <div class="content">
              <p>Dear ${booking.requester_name},</p>
              <p>Your booking has been confirmed. Here are the details:</p>
              <div class="booking-details">
                <strong>Service:</strong> ${booking.title}<br>
                <strong>Date:</strong> ${new Date(booking.start_date).toLocaleDateString()}<br>
                <strong>Time:</strong> ${new Date(booking.start_date).toLocaleTimeString()} - ${new Date(booking.end_date).toLocaleTimeString()}<br>
                <strong>Description:</strong> ${booking.description}
              </div>
              <p>Thank you for your booking!</p>
            </div>
            <div class="footer">
              <p>Contact us at: ${businessProfile?.contact_email || 'contact@example.com'}</p>
              <p>${businessProfile?.business_name || 'Your Business'}</p>
            </div>
          </div>
        </body>
      </html>
    `;

    const { error: emailError } = await resend.emails.send({
      from: `${businessProfile?.business_name || 'Business'} <onboarding@resend.dev>`,
      to: [booking.requester_email],
      subject: emailSubject,
      html: emailHtml,
    });

    if (emailError) {
      console.error('❌ Error sending email:', emailError);
      throw emailError;
    }

    console.log(`✅ ${isReminder ? 'Reminder e' : 'E'}mail sent successfully to:`, booking.requester_email);

    return new Response(
      JSON.stringify({ success: true, message: `${isReminder ? 'Reminder e' : 'E'}mail sent successfully` }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error: any) {
    console.error('❌ Error in send-booking-approval-email function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
};

serve(handler);
