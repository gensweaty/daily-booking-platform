
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
  businessEmail?: string;
  hasAttachment?: boolean;
  paymentStatus?: string;
  paymentAmount?: number;
  language?: string; // Added language parameter
}

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
    // Using businessEmail if directly provided, otherwise we need businessId
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
          const errorText = await response.text();
          console.error(`❌ Error from email lookup API: ${response.status} ${errorText}`);
          
          // Try a different approach - query business_profiles and auth.users directly
          const { businessEmail: altEmail, error: altError } = await getBusinessOwnerEmailDirect(requestData.businessId);
          
          if (altError) {
            throw new Error(`Failed to get business owner email using alternative method: ${altError}`);
          }
          
          if (altEmail) {
            businessEmail = altEmail;
            console.log(`📧 Found business owner email (alternative method): ${businessEmail}`);
          } else {
            throw new Error("No email found for business owner through any method");
          }
        } else {
          const result = await response.json();
          console.log("📧 Email lookup result:", result);
          
          if (result && result.email) {
            businessEmail = result.email;
            console.log(`📧 Found business owner email: ${businessEmail}`);
          } else {
            throw new Error("No email found for business owner");
          }
        }
      } catch (error) {
        console.error("❌ Error getting business owner email:", error);
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: "Failed to get business owner email",
            details: error.message 
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
    }

    // Ensure we have an email to send to
    if (!businessEmail || !businessEmail.includes('@')) {
      console.error("❌ Invalid or missing business email:", businessEmail);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Invalid business email format or missing email address" 
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

    const { requesterName, startDate, endDate, requesterPhone = "", notes = "", businessName = "Your Business", requesterEmail = "", language = "en" } = requestData;
    
    console.log(`🌐 Email language: ${language}`);

    // Format dates for display
    const formatDate = (isoString: string) => {
      try {
        const date = new Date(isoString);
        return date.toLocaleString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: 'numeric',
          minute: 'numeric',
          hour12: true
        });
      } catch (e) {
        console.error("❌ Date formatting error:", e, "for date:", isoString);
        return isoString; // Fallback to the original string if parsing fails
      }
    };

    const formattedStartDate = formatDate(startDate);
    const formattedEndDate = formatDate(endDate);
    
    console.log("📅 Formatted start date:", formattedStartDate);
    console.log("📅 Formatted end date:", formattedEndDate);

    // Format payment status for display - Convert keys to readable text
    const formatPaymentStatus = (status?: string, amount?: number): string => {
      if (!status) return "Not specified";
      
      switch (status) {
        case "not_paid":
          return "Not Paid";
        case "partly_paid":
        case "partly":
          return amount ? `Partly Paid ($${amount})` : "Partly Paid";
        case "fully_paid":
        case "fully":
          return amount ? `Fully Paid ($${amount})` : "Fully Paid";
        default:
          return status.charAt(0).toUpperCase() + status.slice(1).replace(/_/g, ' ');
      }
    };

    const formattedPaymentStatus = formatPaymentStatus(
      requestData.paymentStatus, 
      requestData.paymentAmount
    );
    
    console.log("💰 Formatted payment status:", formattedPaymentStatus);

    // Get localized email content
    const emailContent = getLocalizedRequestContent(language, {
      requesterName,
      formattedStartDate,
      formattedEndDate,
      requesterPhone,
      requesterEmail,
      notes,
      hasAttachment: requestData.hasAttachment || false,
      formattedPaymentStatus
    });

    // Create email content - improve formatting for better deliverability
    const emailHtml = `
      <!DOCTYPE html>
      <html lang="${language}">
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
          ${emailContent}
          <hr>
          <p class="footer">This is an automated message from SmartBookly</p>
          <p class="small">If you did not sign up for SmartBookly, please disregard this email.</p>
        </div>
      </body>
      </html>
    `;
    
    // Create plain text version for better deliverability
    const plainText = getLocalizedRequestPlainText(language, {
      requesterName,
      formattedStartDate,
      formattedEndDate,
      requesterPhone,
      requesterEmail,
      notes,
      hasAttachment: requestData.hasAttachment || false,
      formattedPaymentStatus
    });
    
    console.log("📧 Sending email to:", businessEmail);
    
    // Use your verified domain for the from address
    const fromEmail = "SmartBookly <info@smartbookly.com>";
    
    console.log("📧 Final recipient:", businessEmail);
    console.log("📧 Sending from:", fromEmail);
    console.log("📧 Subject: New Booking Request - Action Required");
    
    let emailResult;
    try {
      console.log("📤 About to execute Resend API call");
      
      // Make sure we fully await the email sending before returning
      emailResult = await resend.emails.send({
        from: fromEmail,
        to: [businessEmail],
        subject: "New Booking Request - Action Required",
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
        email: businessEmail
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

// Get localized email content based on language for booking request notifications
function getLocalizedRequestContent(language: string, data: {
  requesterName: string,
  formattedStartDate: string,
  formattedEndDate: string,
  requesterPhone: string,
  requesterEmail: string,
  notes: string,
  hasAttachment: boolean,
  formattedPaymentStatus: string
}): string {
  const {
    requesterName,
    formattedStartDate,
    formattedEndDate,
    requesterPhone,
    requesterEmail,
    notes,
    hasAttachment,
    formattedPaymentStatus
  } = data;
  
  switch (language) {
    case 'ka': // Georgian
      return `
        <h2 class="header">ახალი დაჯავშნის მოთხოვნა</h2>
        <p>გამარჯობა,</p>
        <p>თქვენ მიიღეთ ახალი დაჯავშნის მოთხოვნა <strong>${requesterName}</strong>-სგან.</p>
        <div class="details">
          <p class="detail"><strong>დაწყების თარიღი:</strong> ${formattedStartDate}</p>
          <p class="detail"><strong>დასრულების თარიღი:</strong> ${formattedEndDate}</p>
          ${requesterPhone ? `<p class="detail"><strong>ტელეფონი:</strong> ${requesterPhone}</p>` : ''}
          ${requesterEmail ? `<p class="detail"><strong>ელფოსტა:</strong> ${requesterEmail}</p>` : ''}
          ${notes ? `<p class="detail"><strong>შენიშვნები:</strong> ${notes}</p>` : ''}
          ${hasAttachment ? `<p class="detail"><strong>აქვს დანართი:</strong> დიახ</p>` : ''}
          <p class="detail"><strong>გადახდის სტატუსი:</strong> ${formattedPaymentStatus}</p>
        </div>
        <p>გთხოვთ შეხვიდეთ თქვენს საინფორმაციო დაფაზე, რომ ნახოთ და უპასუხოთ ამ მოთხოვნას:</p>
        <div class="button">
          <a href="https://smartbookly.com/dashboard">გადადით Dashboard-ზე</a>
        </div>
      `;
    case 'es': // Spanish
      return `
        <h2 class="header">Nueva solicitud de reserva</h2>
        <p>Hola,</p>
        <p>Ha recibido una nueva solicitud de reserva de <strong>${requesterName}</strong>.</p>
        <div class="details">
          <p class="detail"><strong>Fecha de inicio:</strong> ${formattedStartDate}</p>
          <p class="detail"><strong>Fecha de finalización:</strong> ${formattedEndDate}</p>
          ${requesterPhone ? `<p class="detail"><strong>Teléfono:</strong> ${requesterPhone}</p>` : ''}
          ${requesterEmail ? `<p class="detail"><strong>Correo electrónico:</strong> ${requesterEmail}</p>` : ''}
          ${notes ? `<p class="detail"><strong>Notas:</strong> ${notes}</p>` : ''}
          ${hasAttachment ? `<p class="detail"><strong>Tiene adjunto:</strong> Sí</p>` : ''}
          <p class="detail"><strong>Estado de pago:</strong> ${formattedPaymentStatus}</p>
        </div>
        <p>Inicie sesión en su panel de control para ver y responder a esta solicitud:</p>
        <div class="button">
          <a href="https://smartbookly.com/dashboard">Ir al panel de control</a>
        </div>
      `;
    default: // English
      return `
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
      `;
  }
}

// Get localized plain text email content
function getLocalizedRequestPlainText(language: string, data: {
  requesterName: string,
  formattedStartDate: string,
  formattedEndDate: string,
  requesterPhone: string,
  requesterEmail: string,
  notes: string,
  hasAttachment: boolean,
  formattedPaymentStatus: string
}): string {
  const {
    requesterName,
    formattedStartDate,
    formattedEndDate,
    requesterPhone,
    requesterEmail,
    notes,
    hasAttachment,
    formattedPaymentStatus
  } = data;
  
  switch (language) {
    case 'ka': // Georgian
      return `
ახალი დაჯავშნის მოთხოვნა

გამარჯობა,

თქვენ მიიღეთ ახალი დაჯავშნის მოთხოვნა ${requesterName}-სგან.

დაწყების თარიღი: ${formattedStartDate}
დასრულების თარიღი: ${formattedEndDate}
${requesterPhone ? `ტელეფონი: ${requesterPhone}` : ''}
${requesterEmail ? `ელფოსტა: ${requesterEmail}` : ''}
${notes ? `შენიშვნები: ${notes}` : ''}
${hasAttachment ? `აქვს დანართი: დიახ` : ''}
გადახდის სტატუსი: ${formattedPaymentStatus}

გთხოვთ შეხვიდეთ თქვენს საინფორმაციო დაფაზე, რომ ნახოთ და უპასუხოთ ამ მოთხოვნას:
https://smartbookly.com/dashboard

ეს არის ავტომატური შეტყობინება SmartBookly-სგან

თუ არ დარეგისტრირებულხართ SmartBookly-ზე, გთხოვთ უგულებელყოთ ეს ელფოსტა.
      `;
    case 'es': // Spanish
      return `
Nueva solicitud de reserva

Hola,

Ha recibido una nueva solicitud de reserva de ${requesterName}.

Fecha de inicio: ${formattedStartDate}
Fecha de finalización: ${formattedEndDate}
${requesterPhone ? `Teléfono: ${requesterPhone}` : ''}
${requesterEmail ? `Correo electrónico: ${requesterEmail}` : ''}
${notes ? `Notas: ${notes}` : ''}
${hasAttachment ? `Tiene adjunto: Sí` : ''}
Estado de pago: ${formattedPaymentStatus}

Inicie sesión en su panel de control para ver y responder a esta solicitud:
https://smartbookly.com/dashboard

Este es un mensaje automatizado de SmartBookly

Si no se registró en SmartBookly, ignore este correo electrónico.
      `;
    default: // English
      return `
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
  }
}

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
      const errorText = await businessProfileResponse.text();
      console.error(`❌ Error fetching business profile: ${businessProfileResponse.status} ${errorText}`);
      return { businessEmail: null, error: `Business profile fetch failed: ${errorText}` };
    }
    
    const businessProfiles = await businessProfileResponse.json();
    console.log("🔍 Business profiles result:", businessProfiles);
    
    if (!businessProfiles || businessProfiles.length === 0) {
      console.error("❌ No business profile found with ID:", businessId);
      return { businessEmail: null, error: "No business profile found" };
    }
    
    const userId = businessProfiles[0].user_id;
    console.log("🔍 Found user ID:", userId);
    
    if (!userId) {
      return { businessEmail: null, error: "No user ID associated with business profile" };
    }
    
    // Use the Admin API with service role key to get user email directly
    // This is a fallback method when the RPC function fails
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
      const errorText = await userResponse.text();
      console.error(`❌ Error fetching user: ${userResponse.status} ${errorText}`);
      return { businessEmail: null, error: `User fetch failed: ${errorText}` };
    }
    
    const userData = await userResponse.json();
    console.log("🔍 User data result (email masked for logs):", { ...userData, email: "***" });
    
    if (!userData || !userData.email) {
      return { businessEmail: null, error: "No email found in user data" };
    }
    
    return { businessEmail: userData.email, error: null };
  } catch (error) {
    console.error("❌ Error in alternative email lookup:", error);
    return { businessEmail: null, error: error instanceof Error ? error.message : "Unknown error in alternative email lookup" };
  }
}

// Start server and make sure all promises resolve before shutdown
serve(handler);
