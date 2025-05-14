// Add to the testEmailSending function the eventNotes parameter
import { supabase } from "./supabase";

export const testEmailSending = async (
  toEmail: string,
  fullName: string,
  businessName: string,
  startDate: string,
  endDate: string,
  paymentStatus?: string,
  paymentAmount?: number | null,
  businessAddress?: string,
  eventId?: string,
  source?: string,
  language?: string,
  eventNotes?: string // Add the event notes parameter
) => {
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token;
    
    if (!accessToken) {
      return { error: "No authentication token available" };
    }
    
    // Create the request payload with event notes
    const payload = {
      recipientEmail: toEmail,
      fullName,
      businessName,
      startDate,
      endDate,
      paymentStatus,
      paymentAmount,
      businessAddress,
      eventId,
      source: source || 'manual',
      language,
      eventNotes // Include event notes in the payload
    };
    
    // Log data being sent (with masked email)
    console.log('Sending email with data:', {
      ...payload,
      recipientEmail: toEmail.substring(0, 3) + '***',
      eventNotes: eventNotes ? 'present' : 'not present'
    });
    
    const response = await fetch(
      "https://mrueqpffzauvdxmuwhfa.supabase.co/functions/v1/send-booking-approval-email",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${accessToken}`
        },
        body: JSON.stringify(payload)
      }
    );
    
    const result = await response.json();
    return result;
  } catch (error) {
    console.error("Error sending test email:", error);
    return { error: "Failed to send email" };
  }
};
