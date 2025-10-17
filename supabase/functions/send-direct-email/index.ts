import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@4.3.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface DirectEmailRequest {
  recipient_email: string;
  subject: string;
  message: string;
  language?: string;
  sender_name?: string;
  sender_email?: string;
  business_name?: string;
}

const getEmailContent = (
  message: string,
  language: string = 'en',
  senderName?: string
): { subject: string; html: string } => {
  const subjects = {
    en: 'Message from SmartBookly',
    ka: 'შეტყობინება SmartBookly-დან',
    es: 'Mensaje de SmartBookly',
    ru: 'Сообщение от SmartBookly'
  };

  const greetings = {
    en: 'Hello',
    ka: 'გამარჯობა',
    es: 'Hola',
    ru: 'Здравствуйте'
  };

  const footers = {
    en: 'Best regards,<br>SmartBookly Team',
    ka: 'პატივისცემით,<br>SmartBookly გუნდი',
    es: 'Saludos cordiales,<br>Equipo SmartBookly',
    ru: 'С уважением,<br>Команда SmartBookly'
  };

  const lang = language as keyof typeof subjects;
  const subject = subjects[lang] || subjects.en;
  const greeting = greetings[lang] || greetings.en;
  const footer = footers[lang] || footers.en;

  const senderInfo = senderName ? `<p><strong>${senderName}</strong></p>` : '';

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
          .message { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; white-space: pre-wrap; }
          .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>SmartBookly</h1>
          </div>
          <div class="content">
            <p>${greeting},</p>
            ${senderInfo}
            <div class="message">${message}</div>
            <div class="footer">
              <p>${footer}</p>
            </div>
          </div>
        </div>
      </body>
    </html>
  `;

  return { subject, html };
};

const handler = async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
    if (!RESEND_API_KEY) {
      console.error('RESEND_API_KEY is not set');
      return new Response(
        JSON.stringify({ success: false, error: 'Email service not configured' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500,
        }
      );
    }

    const emailRequest: DirectEmailRequest = await req.json();
    console.log('📧 Direct email request:', {
      recipient: emailRequest.recipient_email,
      language: emailRequest.language,
      sender: emailRequest.sender_name,
      senderEmail: emailRequest.sender_email,
      businessName: emailRequest.business_name
    });

    if (!emailRequest.recipient_email || !emailRequest.message) {
      return new Response(
        JSON.stringify({ success: false, error: 'Recipient email and message are required' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        }
      );
    }

    const resend = new Resend(RESEND_API_KEY);
    const { subject, html } = getEmailContent(
      emailRequest.message,
      emailRequest.language || 'en',
      emailRequest.sender_name
    );

    // Construct from address: "Business/User Name (email) <noreply@smartbookly.com>"
    let displayName = 'SmartBookly';
    
    if (emailRequest.business_name && emailRequest.sender_email) {
      // Business exists: "Business Name (sender@email.com)"
      displayName = `${emailRequest.business_name} (${emailRequest.sender_email})`;
    } else if (emailRequest.sender_name && emailRequest.sender_email) {
      // No business: "User Name (sender@email.com)"
      displayName = `${emailRequest.sender_name} (${emailRequest.sender_email})`;
    } else if (emailRequest.sender_email) {
      // Only email available
      displayName = emailRequest.sender_email;
    }
    
    const fromAddress = `${displayName} <noreply@smartbookly.com>`;
    console.log('📧 Sending email with from address:', fromAddress);
    console.log('📧 Recipient:', emailRequest.recipient_email);
    console.log('📧 Using RESEND_API_KEY:', RESEND_API_KEY ? 'Present (length: ' + RESEND_API_KEY.length + ')' : 'MISSING');

    const emailResult = await resend.emails.send({
      from: fromAddress,
      to: [emailRequest.recipient_email],
      subject: emailRequest.subject || subject,
      html: html,
    });

    console.log('✅ Direct email sent:', emailResult);

    // Check if Resend returned an error (even with 200 status)
    if (emailResult.error) {
      console.error('❌ Resend API error:', emailResult.error);
      
      // Special handling for domain verification error
      if (emailResult.error.message && emailResult.error.message.includes('verify a domain')) {
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: 'Domain verification required',
            message: 'To send emails to external recipients, please verify your domain at resend.com/domains and update the "from" address to use your verified domain.'
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 403,
          }
        );
      }
      
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: emailResult.error.message || 'Failed to send email'
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500,
        }
      );
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Email sent successfully',
        emailId: emailResult.id
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('❌ Error sending direct email:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
};

serve(handler);
