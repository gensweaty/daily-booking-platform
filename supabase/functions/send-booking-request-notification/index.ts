
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";

// CORS headers to allow cross-origin requests
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface BookingNotificationRequest {
  businessEmail: string;
  requesterName: string;
  requestDate: string;
  endDate: string;
  phoneNumber?: string;
  notes?: string;
  businessName?: string;
  requesterEmail?: string;
  language?: string; // Added language parameter
}

// Email translation templates
const emailTranslations = {
  en: {
    subject: "New Booking Request - Action Required",
    heading: "New Booking Request",
    intro: "Hello,",
    details: "You have received a new booking request from",
    startDate: "Start Date",
    endDate: "End Date",
    phone: "Phone",
    notes: "Notes",
    email: "Email",
    viewDashboard: "Please log in to your dashboard to view and respond to this request:",
    buttonText: "Go to Dashboard",
    automatedMessage: "This is an automated message from SmartBookly",
    disclaimer: "If you did not sign up for SmartBookly, please disregard this email."
  },
  es: {
    subject: "Nueva solicitud de reserva - Acción requerida",
    heading: "Nueva solicitud de reserva",
    intro: "Hola,",
    details: "Has recibido una nueva solicitud de reserva de",
    startDate: "Fecha de inicio",
    endDate: "Fecha de finalización",
    phone: "Teléfono",
    notes: "Notas",
    email: "Correo electrónico",
    viewDashboard: "Por favor inicie sesión en su panel para ver y responder a esta solicitud:",
    buttonText: "Ir al panel",
    automatedMessage: "Este es un mensaje automatizado de SmartBookly",
    disclaimer: "Si no se registró para SmartBookly, ignore este correo electrónico."
  },
  ka: {
    subject: "ახალი ჯავშნის მოთხოვნა - საჭიროა ქმედება",
    heading: "ახალი ჯავშნის მოთხოვნა",
    intro: "გამარჯობა,",
    details: "თქვენ მიიღეთ ახალი ჯავშნის მოთხოვნა მომხმარებლისგან",
    startDate: "დაწყების თარიღი",
    endDate: "დასრულების თარიღი",
    phone: "ტელეფონი",
    notes: "შენიშვნები",
    email: "ელ-ფოსტა",
    viewDashboard: "დასათვალიერებლად და პასუხის გასაცემად შედით თქვენს პანელში:",
    buttonText: "გადადით პანელზე",
    automatedMessage: "ეს არის ავტომატური შეტყობინება SmartBookly-სგან",
    disclaimer: "თუ არ დარეგისტრირებულხართ SmartBookly-ში, გთხოვთ, უგულებელყოთ ეს წერილი."
  }
};

const handler = async (req: Request): Promise<Response> => {
  console.log(`🔔 Booking notification function invoked with method: ${req.method}`);
  console.log(`🌐 Request URL: ${req.url}`);
  
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    console.log("✅ Handling OPTIONS request");
    return new Response(null, { headers: corsHeaders });
  }

  console.log("🚀 Received actual POST request to send email");

  try {
    // Get the API key from environment variables
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    
    console.log("🔑 API Key available:", !!resendApiKey);
    
    if (!resendApiKey) {
      console.error("❌ RESEND_API_KEY is not configured in environment variables");
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Email service configuration is missing",
          apiKeyPresent: false
        }),
        { 
          status: 500, 
          headers: { 
            "Content-Type": "application/json",
            ...corsHeaders 
          } 
        }
      );
    }
    
    // Initialize Resend with the API key
    console.log("🔄 Initializing Resend client");
    const resend = new Resend(resendApiKey);
    
    // Parse request body
    let requestData: BookingNotificationRequest;
    try {
      const body = await req.text();
      console.log("📝 Raw request body:", body);
      requestData = JSON.parse(body);
      console.log("📋 Parsed request data:", JSON.stringify(requestData));
    } catch (error) {
      console.error("❌ Failed to parse request body:", error);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Invalid JSON in request body",
          details: error.message 
        }),
        { 
          status: 400, 
          headers: { 
            "Content-Type": "application/json",
            ...corsHeaders 
          } 
        }
      );
    }

    // Validate required fields
    const { businessEmail, requesterName, requestDate, endDate, phoneNumber = "", notes = "", businessName = "Your Business", requesterEmail = "", language = "en" } = requestData;
    
    if (!businessEmail || !requesterName || !requestDate || !endDate) {
      const missingFields = [];
      if (!businessEmail) missingFields.push("businessEmail");
      if (!requesterName) missingFields.push("requesterName");
      if (!requestDate) missingFields.push("requestDate");
      if (!endDate) missingFields.push("endDate");
      
      console.error("❌ Missing required fields:", missingFields.join(", "));
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Missing required fields: ${missingFields.join(", ")}` 
        }),
        { 
          status: 400, 
          headers: { 
            "Content-Type": "application/json",
            ...corsHeaders 
          } 
        }
      );
    }

    // Validate email format
    if (!businessEmail.includes('@')) {
      console.error("❌ Invalid email format:", businessEmail);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Invalid email format" 
        }),
        { 
          status: 400, 
          headers: { 
            "Content-Type": "application/json",
            ...corsHeaders
          } 
        }
      );
    }

    // Get the correct translations based on language
    const lang = (language && emailTranslations[language]) ? language : "en";
    const t = emailTranslations[lang];

    console.log(`💬 Using language: ${lang} for email`);

    // Create email content - improve formatting for better deliverability
    const emailHtml = `
      <!DOCTYPE html>
      <html lang="${lang}">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${t.subject}</title>
        <style>
          body { font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333; }
          .container { border: 1px solid #e1e1e1; border-radius: 8px; padding: 20px; }
          .header { color: #0070f3; margin-top: 0; }
          .details { margin: 20px 0; background-color: #f9f9f9; padding: 15px; border-radius: 4px; }
          .detail { margin: 8px 0; }
          .button { text-align: center; margin: 25px 0; }
          .button a { background-color: #0070f3; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold; }
          .footer { color: #666; font-size: 14px; text-align: center; margin-top: 20px; }
          .small { font-size: 12px; color: #666; }
        </style>
      </head>
      <body>
        <div class="container">
          <h2 class="header">${t.heading}</h2>
          <p>${t.intro}</p>
          <p>${t.details} <strong>${requesterName}</strong>.</p>
          <div class="details">
            <p class="detail"><strong>${t.startDate}:</strong> ${requestDate}</p>
            <p class="detail"><strong>${t.endDate}:</strong> ${endDate}</p>
            ${phoneNumber ? `<p class="detail"><strong>${t.phone}:</strong> ${phoneNumber}</p>` : ''}
            ${notes ? `<p class="detail"><strong>${t.notes}:</strong> ${notes}</p>` : ''}
            ${requesterEmail ? `<p class="detail"><strong>${t.email}:</strong> ${requesterEmail}</p>` : ''}
          </div>
          <p>${t.viewDashboard}</p>
          <div class="button">
            <a href="https://smartbookly.com/dashboard">${t.buttonText}</a>
          </div>
          <hr style="border: none; border-top: 1px solid #e1e1e1; margin: 20px 0;">
          <p class="footer">${t.automatedMessage}</p>
          <p class="small">${t.disclaimer}</p>
        </div>
      </body>
      </html>
    `;
    
    // Create plain text version for better deliverability
    const plainText = `
${t.heading}

${t.intro}

${t.details} ${requesterName}.

${t.startDate}: ${requestDate}
${t.endDate}: ${endDate}
${phoneNumber ? `${t.phone}: ${phoneNumber}` : ''}
${notes ? `${t.notes}: ${notes}` : ''}
${requesterEmail ? `${t.email}: ${requesterEmail}` : ''}

${t.viewDashboard}
https://smartbookly.com/dashboard

${t.automatedMessage}

${t.disclaimer}
    `;
    
    console.log("📧 Sending email to:", businessEmail);
    
    // Use your verified domain for the from address
    const fromEmail = "SmartBookly <info@smartbookly.com>";
    
    console.log("📧 Final recipient:", businessEmail);
    console.log("📧 Sending from:", fromEmail);
    console.log(`📧 Subject: ${t.subject}`);
    
    let emailResult;
    try {
      console.log("📤 About to execute Resend API call");
      
      // Make sure we fully await the email sending before returning
      emailResult = await resend.emails.send({
        from: fromEmail,
        to: [businessEmail],
        subject: t.subject,
        html: emailHtml,
        text: plainText,
        reply_to: "no-reply@smartbookly.com",
      });
      
      console.log("📬 Raw Resend API response:", JSON.stringify(emailResult));
      
      if (emailResult.error) {
        throw new Error(emailResult.error.message || "Unknown error from Resend API");
      }
      
      console.log("✅ Email sent successfully with ID:", emailResult.data?.id);
      console.log("✅ Recipient:", businessEmail);
      
      // Wait a moment to ensure the email is processed
      await new Promise(resolve => setTimeout(resolve, 500));
      
    } catch (resendError) {
      console.error("❌ Resend API error:", resendError);
      
      // Provide helpful guidance about domain verification
      let errorMessage = resendError instanceof Error ? resendError.message : "Unknown Resend error";
      let helpfulError = errorMessage;
      
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Email sending failed", 
          details: helpfulError,
          originalError: errorMessage,
        }),
        { 
          status: 500, 
          headers: { 
            "Content-Type": "application/json",
            ...corsHeaders 
          } 
        }
      );
    }

    // Success response
    console.log("✅ Request processed successfully, returning response");
    
    // Wait to ensure all logs are flushed before returning
    await new Promise(resolve => setTimeout(resolve, 300));
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Email notification sent successfully",
        id: emailResult.data?.id,
        email: businessEmail,
        language: lang
      }),
      { 
        status: 200, 
        headers: { 
          "Content-Type": "application/json",
          ...corsHeaders 
        } 
      }
    );
    
  } catch (error) {
    console.error("❌ Unhandled error in send-booking-request-notification:", error);
    
    // Wait to ensure all logs are flushed before returning
    await new Promise(resolve => setTimeout(resolve, 300));
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : "Unknown error occurred",
        stack: error instanceof Error ? error.stack : undefined
      }),
      { 
        status: 500, 
        headers: { 
          "Content-Type": "application/json",
          ...corsHeaders 
        } 
      }
    );
  }
};

// Start server and make sure all promises resolve before shutdown
serve(handler);
