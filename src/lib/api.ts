import { supabase } from "./supabase";

export const sendBookingApprovalEmail = async (
  email: string,
  customerName: string,
  businessName: string,
  startDate: string,
  endDate: string,
  paymentStatus: string,
  paymentAmount: number | null,
  businessAddress: string,
  eventId: string,
  language: string
): Promise<{ success: boolean; error?: string }> => {
  try {
    const { data, error } = await supabase.functions.invoke('send-booking-approval-email', {
      body: {
        email,
        customerName,
        businessName,
        startDate,
        endDate,
        paymentStatus,
        paymentAmount,
        businessAddress,
        eventId,
        language
      }
    });

    if (error) {
      console.error('Error sending booking approval email:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error: any) {
    console.error('Error sending booking approval email:', error);
    return { success: false, error: error.message };
  }
};

export const sendEventCreationEmail = async (
  email: string,
  customerName: string,
  businessName: string,
  startDate: string,
  endDate: string,
  paymentStatus: string,
  paymentAmount: number | null,
  businessAddress: string,
  eventId: string,
  language: string,
  eventNotes: string
): Promise<{ success: boolean; error?: string }> => {
  try {
    const { data, error } = await supabase.functions.invoke('send-booking-approval-email', {
      body: {
        email,
        customerName,
        businessName,
        startDate,
        endDate,
        paymentStatus,
        paymentAmount,
        businessAddress,
        eventId,
        language,
        eventNotes
      }
    });

    if (error) {
      console.error('Error sending event creation email:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error: any) {
    console.error('Error sending event creation email:', error);
    return { success: false, error: error.message };
  }
};

export const sendBookingConfirmationToMultipleRecipients = async (
  recipients: Array<{ email: string; name: string }>,
  businessName: string,
  startDate: string,
  endDate: string,
  paymentStatus: string,
  paymentAmount: number | null,
  businessAddress: string,
  eventId: string,
  language: string,
  eventNotes: string
): Promise<{ successful: number; failed: number; total: number }> => {
  try {
    let successful = 0;
    let failed = 0;
    
    for (const recipient of recipients) {
      const result = await sendEventCreationEmail(
        recipient.email,
        recipient.name,
        businessName,
        startDate,
        endDate,
        paymentStatus,
        paymentAmount,
        businessAddress,
        eventId,
        language,
        eventNotes
      );
      
      if (result.success) {
        successful++;
      } else {
        failed++;
      }
    }
    
    return {
      successful,
      failed,
      total: recipients.length
    };
  } catch (error: any) {
    console.error('Error sending multiple booking confirmations:', error);
    return {
      successful: 0,
      failed: recipients.length,
      total: recipients.length
    };
  }
};
