
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";

// CORS headers to allow cross-origin requests
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface BookingNotificationRequest {
  businessId: string;
  requesterName: string;
  startDate: string;
  endDate: string;
  requesterPhone?: string;
  notes?: string;
  businessName?: string;
  requesterEmail?: string;
  businessEmail?: string; // Added to support direct email specification
  hasAttachment?: boolean;
  paymentStatus?: string;
  paymentAmount?: number;
  businessAddress?: string; // Added for consistency
  language?: string; // Added for currency symbol selection and email language
}

// Helper function to get currency symbol based on language
function getCurrencySymbolByLanguage(language?: string): string {
  console.log(`Getting currency symbol for language: ${language || 'undefined'}`);
  
  if (!language) {
    console.log("No language provided, defaulting to $ (en)");
    return '$';
  }
  
  const normalizedLang = language.toLowerCase();
  
  switch (normalizedLang) {
    case 'es':
      console.log("Spanish language detected, using € symbol");
      return '€';
    case 'ka':
      console.log("Georgian language detected, using ₾ symbol");
      return '₾';
    case 'en':
    default:
      console.log(`Using $ symbol for language: ${language}`);
      return '$';
  }
}

// Function to get email content based on language
function getEmailContent(
  language: string, 
  requesterName: string, 
  formattedStartDate: string,
  formattedEndDate: string,
  requesterPhone: string = "",
  requesterEmail: string = "",
  notes: string = "",
  hasAttachment: boolean = false,
  formattedPaymentStatus: string = "",
  businessName: string = "SmartBookly"
): { html: string, text: string } {
  // Normalize language to lowercase and handle undefined
  const normalizedLang = (language || 'en').toLowerCase();
  
  console.log(`Creating email content in language: ${normalizedLang}`);
  
  switch (normalizedLang) {
    case 'ka': // Georgian
      {
        const html = `
          <!DOCTYPE html>
          <html lang="ka">
          <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>ახალი დაჯავშნის მოთხოვნა</title>
            <style>
              body { font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333; }
              .container { border: 1px solid #e1e1e1; border-radius: 8px; padding: 20px; background-color: #1d1f21; color: #e6e6e6; }
              .header { color: #3b82f6; margin-top: 0; }
              .details { margin: 20px 0; background-color: #2d2f33; padding: 15px; border-radius: 4px; }
              .detail { margin: 8px 0; }
              .button { text-align: center; margin: 25px 0; }
              .button a { background-color: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold; }
              .footer { color: #a0a0a0; font-size: 14px; text-align: center; margin-top: 20px; }
              .small { font-size: 12px; color: #a0a0a0; }
              hr { border: none; border-top: 1px solid #444; margin: 20px 0; }
            </style>
          </head>
          <body>
            <div class="container">
              <h2 class="header">ახალი დაჯავშნის მოთხოვნა</h2>
              <p>გამარჯობა,</p>
              <p>თქვენ მიიღეთ ახალი დაჯავშნის მოთხოვნა <strong>${requesterName}</strong>-სგან.</p>
              <div class="details">
                <p class="detail"><strong>დაწყების თარიღი:</strong> ${formattedStartDate}</p>
                <p class="detail"><strong>დასრულების თარიღი:</strong> ${formattedEndDate}</p>
                ${requesterPhone ? `<p class="detail"><strong>ტელეფონი:</strong> ${requesterPhone}</p>` : ''}
                ${requesterEmail ? `<p class="detail"><strong>ელფოსტა:</strong> ${requesterEmail}</p>` : ''}
                ${notes ? `<p class="detail"><strong>შენიშვნები:</strong> ${notes}</p>` : ''}
                ${hasAttachment ? `<p class="detail"><strong>დანართი:</strong> დიახ</p>` : ''}
                <p class="detail"><strong>გადახდის სტატუსი:</strong> ${formattedPaymentStatus}</p>
              </div>
              <p>გთხოვთ შეხვიდეთ თქვენს საინფორმაციო დაფაზე, რომ ნახოთ და უპასუხოთ ამ მოთხოვნას:</p>
              <div class="button">
                <a href="https://smartbookly.com/dashboard">გადადით Dashboard-ზე</a>
              </div>
              <hr>
              <p class="footer">ეს არის ავტომატური შეტყობინება SmartBookly-დან</p>
              <p class="small">თუ არ დარეგისტრირებულხართ SmartBookly-ში, გთხოვთ, უგულებელყოთ ეს ელფოსტა.</p>
            </div>
          </body>
          </html>
        `;
        
        const plainText = `
ახალი დაჯავშნის მოთხოვნა

გამარჯობა,

თქვენ მიიღეთ ახალი დაჯავშნის მოთხოვნა ${requesterName}-სგან.

დაწყების თარიღი: ${formattedStartDate}
დასრულების თარიღი: ${formattedEndDate}
${requesterPhone ? `ტელეფონი: ${requesterPhone}` : ''}
${requesterEmail ? `ელფოსტა: ${requesterEmail}` : ''}
${notes ? `შენიშვნები: ${notes}` : ''}
${hasAttachment ? `დანართი: დიახ` : ''}
გადახდის სტატუსი: ${formattedPaymentStatus}

გთხოვთ შეხვიდეთ თქვენს საინფორმაციო დაფაზე, რომ ნახოთ და უპასუხოთ ამ მოთხოვნას:
https://smartbookly.com/dashboard

ეს არის ავტომატური შეტყობინება SmartBookly-დან

თუ არ დარეგისტრირებულხართ SmartBookly-ში, გთხოვთ, უგულებელყოთ ეს ელფოსტა.
        `;
        
        return { html, text: plainText };
      }
      
    case 'es': // Spanish
      {
        const html = `
          <!DOCTYPE html>
          <html lang="es">
          <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Nueva solicitud de reserva</title>
            <style>
              body { font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333; }
              .container { border: 1px solid #e1e1e1; border-radius: 8px; padding: 20px; background-color: #1d1f21; color: #e6e6e6; }
              .header { color: #3b82f6; margin-top: 0; }
              .details { margin: 20px 0; background-color: #2d2f33; padding: 15px; border-radius: 4px; }
              .detail { margin: 8px 0; }
              .button { text-align: center; margin: 25px 0; }
              .button a { background-color: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold; }
              .footer { color: #a0a0a0; font-size: 14px; text-align: center; margin-top: 20px; }
              .small { font-size: 12px; color: #a0a0a0; }
              hr { border: none; border-top: 1px solid #444; margin: 20px 0; }
            </style>
          </head>
          <body>
            <div class="container">
              <h2 class="header">Nueva solicitud de reserva</h2>
              <p>Hola,</p>
              <p>Ha recibido una nueva solicitud de reserva de <strong>${requesterName}</strong>.</p>
              <div class="details">
                <p class="detail"><strong>Fecha de inicio:</strong> ${formattedStartDate}</p>
                <p class="detail"><strong>Fecha de finalización:</strong> ${formattedEndDate}</p>
                ${requesterPhone ? `<p class="detail"><strong>Teléfono:</strong> ${requesterPhone}</p>` : ''}
                ${requesterEmail ? `<p class="detail"><strong>Correo electrónico:</strong> ${requesterEmail}</p>` : ''}
                ${notes ? `<p class="detail"><strong>Notas:</strong> ${notes}</p>` : ''}
                ${hasAttachment ? `<p class="detail"><strong>Tiene archivo adjunto:</strong> Sí</p>` : ''}
                <p class="detail"><strong>Estado del pago:</strong> ${formattedPaymentStatus}</p>
              </div>
              <p>Inicie sesión en su panel de control para ver y responder a esta solicitud:</p>
              <div class="button">
                <a href="https://smartbookly.com/dashboard">Ir al panel de control</a>
              </div>
              <hr>
              <p class="footer">Este es un mensaje automático de SmartBookly</p>
              <p class="small">Si no se registró en SmartBookly, ignore este correo.</p>
            </div>
          </body>
          </html>
        `;
        
        const plainText = `
Nueva solicitud de reserva

Hola,

Ha recibido una nueva solicitud de reserva de ${requesterName}.

Fecha de inicio: ${formattedStartDate}
Fecha de finalización: ${formattedEndDate}
${requesterPhone ? `Teléfono: ${requesterPhone}` : ''}
${requesterEmail ? `Correo electrónico: ${requesterEmail}` : ''}
${notes ? `Notas: ${notes}` : ''}
${hasAttachment ? `Tiene archivo adjunto: Sí` : ''}
Estado del pago: ${formattedPaymentStatus}

Inicie sesión en su panel de control para ver y responder a esta solicitud:
https://smartbookly.com/dashboard

Este es un mensaje automático de SmartBookly

Si no se registró en SmartBookly, ignore este correo.
        `;
        
        return { html, text: plainText };
      }
      
    default: // English (default)
      {
        const html = `
          <!DOCTYPE html>
          <html lang="en">
          <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>New Booking Request</title>
            <style>
              body { font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333; }
              .container { border: 1px solid #e1e1e1; border-radius: 8px; padding: 20px; background-color: #1d1f21; color: #e6e6e6; }
              .header { color: #3b82f6; margin-top: 0; }
              .details { margin: 20px 0; background-color: #2d2f33; padding: 15px; border-radius: 4px; }
              .detail { margin: 8px 0; }
              .button { text-align: center; margin: 25px 0; }
              .button a { background-color: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold; }
              .footer { color: #a0a0a0; font-size: 14px; text-align: center; margin-top: 20px; }
              .small { font-size: 12px; color: #a0a0a0; }
              hr { border: none; border-top: 1px solid #444; margin: 20px 0; }
            </style>
          </head>
          <body>
            <div class="container">
              <h2 class="header">New Booking Request</h2>
              <p>Hello,</p>
              <p>You have received a new booking request from <strong>${requesterName}</strong>.</p>
              <div class="details">
                <p class="detail"><strong>Start Date:</strong> ${formattedStartDate}</p>
                <p class="detail"><strong>End Date:</strong> ${formattedEndDate}</p>
                ${requesterPhone ? `<p class="detail"><strong>Phone:</strong> ${requesterPhone}</p>` : ''}
                ${requesterEmail ? `<p class="detail"><strong>Email:</strong> ${requesterEmail}</p>` : ''}
                ${notes ? `<p class="detail"><strong>Notes:</strong> ${notes}</p>` : ''}
                ${hasAttachment ? `<p class="detail"><strong>Has attachment:</strong> Yes</p>` : ''}
                <p class="detail"><strong>Payment status:</strong> ${formattedPaymentStatus}</p>
              </div>
              <p>Please log in to your dashboard to view and respond to this request:</p>
              <div class="button">
                <a href="https://smartbookly.com/dashboard">Go to Dashboard</a>
              </div>
              <hr>
              <p class="footer">This is an automated message from SmartBookly</p>
              <p class="small">If you did not sign up for SmartBookly, please disregard this email.</p>
            </div>
          </body>
          </html>
        `;
        
        const plainText = `
New Booking Request

Hello,

You have received a new booking request from ${requesterName}.

Start Date: ${formattedStartDate}
End Date: ${formattedEndDate}
${requesterPhone ? `Phone: ${requesterPhone}` : ''}
${requesterEmail ? `Email: ${requesterEmail}` : ''}
${notes ? `Notes: ${notes}` : ''}
${hasAttachment ? `Has attachment: Yes` : ''}
Payment status: ${formattedPaymentStatus}

Please log in to your dashboard to view and respond to this request:
https://smartbookly.com/dashboard

This is an automated message from SmartBookly

If you did not sign up for SmartBookly, please disregard this email.
        `;
        
        return { html, text: plainText };
      }
  }
}

// Format payment status for display in different languages
function formatPaymentStatus(status?: string, amount?: number, language?: string, currencySymbol?: string): string {
  if (!status) return language === 'ka' ? "არ არის მითითებული" : (language === 'es' ? "No especificado" : "Not specified");
  
  // Default to $ if no currency symbol provided
  const currency = currencySymbol || '$';
  
  // Normalize language
  const normalizedLang = (language || 'en').toLowerCase();
  
  switch (status) {
    case "not_paid":
      return normalizedLang === 'ka' 
        ? "გადაუხდელი" 
        : (normalizedLang === 'es' ? "No Pagado" : "Not Paid");
        
    case "partly_paid":
    case "partly":
      if (amount !== undefined && amount !== null) {
        return normalizedLang === 'ka'
          ? `ნაწილობრივ გადახდილი (${currency}${amount})`
          : (normalizedLang === 'es' 
              ? `Pagado Parcialmente (${currency}${amount})`
              : `Partly Paid (${currency}${amount})`);
      } else {
        return normalizedLang === 'ka'
          ? "ნაწილობრივ გადახდილი" 
          : (normalizedLang === 'es' ? "Pagado Parcialmente" : "Partly Paid");
      }
        
    case "fully_paid":
    case "fully":
      if (amount !== undefined && amount !== null) {
        return normalizedLang === 'ka'
          ? `სრულად გადახდილი (${currency}${amount})`
          : (normalizedLang === 'es' 
              ? `Pagado Totalmente (${currency}${amount})`
              : `Fully Paid (${currency}${amount})`);
      } else {
        return normalizedLang === 'ka'
          ? "სრულად გადახდილი" 
          : (normalizedLang === 'es' ? "Pagado Totalmente" : "Fully Paid");
      }
        
    default:
      return status.charAt(0).toUpperCase() + status.slice(1).replace(/_/g, ' ');
  }
}

// Format dates for different languages
function formatDateTime(isoString: string, language?: string): string {
  try {
    // Determine locale based on language
    let locale = 'en-US';
    if (language === 'ka') {
      locale = 'ka-GE';
    } else if (language === 'es') {
      locale = 'es-ES';
    }
    
    // Add date formatting based on locale
    const date = new Date(isoString);
    return date.toLocaleString(locale, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      hour12: language !== 'ka', // Georgian typically uses 24-hour format
    });
  } catch (e) {
    return isoString; // Fallback to the original string if parsing fails
  }
}

const handler = async (req: Request): Promise<Response> => {
  console.log(`🔔 Booking notification function invoked with method: ${req.method}`);
  
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

    // Quick validation of required fields
    if ((!requestData.businessEmail && !requestData.businessId) || !requestData.requesterName || !requestData.startDate || !requestData.endDate) {
      const missingFields = [];
      if (!requestData.businessEmail && !requestData.businessId) missingFields.push("businessEmail or businessId");
      if (!requestData.requesterName) missingFields.push("requesterName");
      if (!requestData.startDate) missingFields.push("startDate");
      if (!requestData.endDate) missingFields.push("endDate");
      
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

    // Get business owner email from RPC function if not directly provided
    let businessEmail = requestData.businessEmail;
    
    if (!businessEmail && requestData.businessId) {
      try {
        console.log(`🔍 Looking up email for business ID: ${requestData.businessId}`);
        
        // Make a direct request to our RPC function
        const response = await fetch(
          `https://mrueqpffzauvdxmuwhfa.supabase.co/rest/v1/rpc/get_business_owner_email`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "apikey": Deno.env.get("SUPABASE_ANON_KEY") || "",
            },
            body: JSON.stringify({ business_id_param: requestData.businessId }),
          }
        );
        
        if (!response.ok) {
          console.error(`❌ Error from email lookup API: ${response.status}`);
          
          // Try a different approach - query business_profiles and auth.users directly
          const { businessEmail: altEmail, error: altError } = await getBusinessOwnerEmailDirect(requestData.businessId);
          
          if (altEmail) {
            businessEmail = altEmail;
            console.log(`📧 Found business owner email (alternative method): ${businessEmail}`);
          } else {
            console.error(`Email lookup failed: ${altError}`);
            // Return success anyway since we'll continue in the background
          }
        } else {
          const result = await response.json();
          if (result && result.email) {
            businessEmail = result.email;
            console.log(`📧 Found business owner email: ${businessEmail}`);
          }
        }
      } catch (error) {
        console.error("❌ Error getting business owner email:", error);
        // Return success anyway, we'll try to send the email in the background
      }
    }

    // Initialize resend early
    console.log("🔄 Initializing Resend client");
    const resend = new Resend(resendApiKey);
    
    // Return success early - we'll finish the email processing in the background
    const successResponse = new Response(
      JSON.stringify({ 
        success: true, 
        message: "Email notification processing started",
        email: businessEmail || "pending",
        language: requestData.language || "en" // Include language in response
      }),
      { 
        status: 200, 
        headers: { 
          "Content-Type": "application/json",
          ...corsHeaders 
        } 
      }
    );

    // Continue email processing in the background using EdgeRuntime.waitUntil
    if (typeof EdgeRuntime !== 'undefined' && businessEmail && businessEmail.includes('@')) {
      console.log("📧 Continuing email processing in background for:", businessEmail);
      
      EdgeRuntime.waitUntil((async () => {
        try {
          const { requesterName, startDate, endDate, requesterPhone = "", notes = "", businessName = "Your Business", requesterEmail = "", businessAddress = "", language = "en" } = requestData;
          
          console.log(`Using language: ${language} for currency symbol and email content`);
    
          // Get currency symbol based on language
          const currencySymbol = getCurrencySymbolByLanguage(language);
          console.log(`Using currency symbol: ${currencySymbol} for language: ${language}`);
          
          // Format dates for display in the appropriate language
          const formattedStartDate = formatDateTime(startDate, language);
          const formattedEndDate = formatDateTime(endDate, language);
    
          // Format payment status for display in the appropriate language
          const formattedPaymentStatus = formatPaymentStatus(
            requestData.paymentStatus, 
            requestData.paymentAmount,
            language,
            currencySymbol
          );
          
          // Generate email content based on language
          const emailContent = getEmailContent(
            language,
            requesterName,
            formattedStartDate,
            formattedEndDate,
            requesterPhone,
            requesterEmail,
            notes,
            requestData.hasAttachment,
            formattedPaymentStatus,
            businessName
          );
          
          // Email subjects based on language
          const emailSubject = language === 'ka' 
            ? "ახალი დაჯავშნის მოთხოვნა - საჭიროებს ქმედებას" 
            : (language === 'es' 
                ? "Nueva solicitud de reserva - Acción requerida" 
                : "New Booking Request - Action Required");
          
          console.log("📧 Sending email to:", businessEmail);
          
          // Use your verified domain for the from address
          const fromEmail = "SmartBookly <info@smartbookly.com>";
    
          try {
            const emailResult = await resend.emails.send({
              from: fromEmail,
              to: [businessEmail],
              subject: emailSubject,
              html: emailContent.html,
              text: emailContent.text,
              reply_to: "no-reply@smartbookly.com",
            });
            
            console.log("✅ Email sent successfully with ID:", emailResult.data?.id);
            
          } catch (resendError) {
            console.error("❌ Resend API error:", resendError);
          }
        } catch (error) {
          console.error("❌ Background email processing error:", error);
        }
      })());
    }

    // Return the success response
    return successResponse;
    
  } catch (error) {
    console.error("❌ Unhandled error in send-booking-request-notification:", error);
    
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

// Helper function to get business email directly if the RPC function fails
async function getBusinessOwnerEmailDirect(businessId: string): Promise<{businessEmail: string | null, error: string | null}> {
  try {
    console.log("🔍 Attempting alternative method to get business owner email");
    
    // First get the user_id from business_profiles
    const businessProfileResponse = await fetch(
      `https://mrueqpffzauvdxmuwhfa.supabase.co/rest/v1/business_profiles?id=eq.${businessId}&select=user_id`,
      {
        headers: {
          "apikey": Deno.env.get("SUPABASE_ANON_KEY") || "",
        }
      }
    );
    
    if (!businessProfileResponse.ok) {
      return { businessEmail: null, error: `Business profile fetch failed: ${businessProfileResponse.status}` };
    }
    
    const businessProfiles = await businessProfileResponse.json();
    
    if (!businessProfiles || businessProfiles.length === 0) {
      return { businessEmail: null, error: "No business profile found" };
    }
    
    const userId = businessProfiles[0].user_id;
    
    if (!userId) {
      return { businessEmail: null, error: "No user ID associated with business profile" };
    }
    
    // Use the Admin API with service role key to get user email directly
    const userResponse = await fetch(
      `https://mrueqpffzauvdxmuwhfa.supabase.co/auth/v1/admin/users/${userId}`,
      {
        headers: {
          "apikey": Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "",
          "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || ""}`,
        }
      }
    );
    
    if (!userResponse.ok) {
      return { businessEmail: null, error: `User fetch failed: ${userResponse.status}` };
    }
    
    const userData = await userResponse.json();
    
    if (!userData || !userData.email) {
      return { businessEmail: null, error: "No email found in user data" };
    }
    
    return { businessEmail: userData.email, error: null };
  } catch (error) {
    return { businessEmail: null, error: error instanceof Error ? error.message : "Unknown error" };
  }
}

// Start server
serve(handler);
