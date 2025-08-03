
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface BookingApprovalRequest {
  recipientEmail: string;
  fullName: string;
  businessName: string;
  startDate: string;
  endDate: string;
  paymentStatus: string;
  paymentAmount: number | null;
  contactAddress: string;
  eventId: string;
  language?: string;
  eventNotes?: string;
  isReminder?: boolean;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { 
      recipientEmail, 
      fullName, 
      businessName, 
      startDate, 
      endDate, 
      paymentStatus, 
      paymentAmount, 
      contactAddress, 
      eventId, 
      language = 'en',
      eventNotes = '',
      isReminder = false
    }: BookingApprovalRequest = await req.json();

    console.log('Sending booking email:', { recipientEmail, fullName, businessName, isReminder });

    // Format dates
    const startDateFormatted = new Date(startDate).toLocaleString();
    const endDateFormatted = new Date(endDate).toLocaleString();

    // Format payment status
    let paymentStatusText = '';
    switch (paymentStatus) {
      case 'fully_paid':
        paymentStatusText = language === 'ka' ? 'სრულად გადახდილი' : 'Fully Paid';
        break;
      case 'partly_paid':
        paymentStatusText = language === 'ka' ? 'ნაწილობრივ გადახდილი' : 'Partly Paid';
        break;
      default:
        paymentStatusText = language === 'ka' ? 'არ არის გადახდილი' : 'Not Paid';
    }

    // Subject line - add [Reminder] prefix if this is a reminder
    const subjectPrefix = isReminder ? '[Reminder] ' : '';
    const subject = language === 'ka' 
      ? `${subjectPrefix}თქვენი ჯავშანი დადასტურებულია - ${businessName}`
      : `${subjectPrefix}Your Booking is Confirmed - ${businessName}`;

    const emailResponse = await resend.emails.send({
      from: "Booking System <onboarding@resend.dev>",
      to: [recipientEmail],
      subject: subject,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #333;">${isReminder ? (language === 'ka' ? 'შეხსენება - ' : 'Reminder - ') : ''}${language === 'ka' ? 'ჯავშანი დადასტურებულია' : 'Booking Confirmed'}</h2>
          
          <p>${language === 'ka' ? 'გამარჯობა' : 'Hello'} ${fullName},</p>
          
          <p>${isReminder 
            ? (language === 'ka' ? 'ეს არის შეხსენება თქვენი მომავალი ჯავშნის შესახებ:' : 'This is a reminder about your upcoming booking:')
            : (language === 'ka' ? 'თქვენი ჯავშანი წარმატებით დადასტურდა:' : 'Your booking has been successfully confirmed:')
          }</p>
          
          <div style="background-color: #f5f5f5; padding: 20px; margin: 20px 0; border-radius: 5px;">
            <h3 style="margin-top: 0;">${language === 'ka' ? 'ჯავშნის დეტალები' : 'Booking Details'}</h3>
            <p><strong>${language === 'ka' ? 'ბიზნესი:' : 'Business:'}</strong> ${businessName}</p>
            <p><strong>${language === 'ka' ? 'დაწყება:' : 'Start:'}</strong> ${startDateFormatted}</p>
            <p><strong>${language === 'ka' ? 'დასრულება:' : 'End:'}</strong> ${endDateFormatted}</p>
            <p><strong>${language === 'ka' ? 'გადახდის სტატუსი:' : 'Payment Status:'}</strong> ${paymentStatusText}</p>
            ${paymentAmount ? `<p><strong>${language === 'ka' ? 'თანხა:' : 'Amount:'}</strong> ${paymentAmount} ${language === 'ka' ? 'ლარი' : 'GEL'}</p>` : ''}
            ${contactAddress ? `<p><strong>${language === 'ka' ? 'მისამართი:' : 'Address:'}</strong> ${contactAddress}</p>` : ''}
            ${eventNotes ? `<p><strong>${language === 'ka' ? 'შენიშვნები:' : 'Notes:'}</strong> ${eventNotes}</p>` : ''}
          </div>
          
          <p>${language === 'ka' ? 'გმადლობთ ჩვენი სერვისის არჩევისთვის!' : 'Thank you for choosing our service!'}</p>
          
          <p style="color: #666; font-size: 12px; margin-top: 30px;">
            ${language === 'ka' ? 'ეს ავტომატური ელწერილია. გთხოვთ ნუ უპასუხებთ ამ წერილს.' : 'This is an automated email. Please do not reply to this message.'}
          </p>
        </div>
      `,
    });

    console.log("Email sent successfully:", emailResponse);

    return new Response(JSON.stringify(emailResponse), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  } catch (error: any) {
    console.error("Error in send-booking-approval-email function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
