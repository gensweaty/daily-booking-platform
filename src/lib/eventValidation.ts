
// Comprehensive event data validation service
export interface EventValidationResult {
  isValid: boolean;
  errors: string[];
  sanitizedData?: any;
}

export interface EventFormData {
  startDate: string;
  endDate: string;
  userSurname: string;
  title?: string;
  userNumber?: string;
  socialNetworkLink?: string;
  eventNotes?: string;
  eventName?: string;
  paymentStatus?: string;
  paymentAmount?: string;
  isRecurring?: boolean;
  repeatPattern?: string;
  repeatUntil?: string;
}

export const validateEventData = (formData: EventFormData): EventValidationResult => {
  const errors: string[] = [];
  
  console.log("🔍 Validating event form data:", formData);
  
  // CRITICAL: Validate start date
  if (!formData.startDate || formData.startDate.trim() === '') {
    errors.push("Start date is required");
  } else {
    const startDate = new Date(formData.startDate);
    if (isNaN(startDate.getTime())) {
      errors.push("Start date is invalid");
    }
  }
  
  // CRITICAL: Validate end date
  if (!formData.endDate || formData.endDate.trim() === '') {
    errors.push("End date is required");
  } else {
    const endDate = new Date(formData.endDate);
    if (isNaN(endDate.getTime())) {
      errors.push("End date is invalid");
    }
    
    // Check that end date is after start date
    if (formData.startDate && !isNaN(new Date(formData.startDate).getTime())) {
      const startDate = new Date(formData.startDate);
      if (endDate <= startDate) {
        errors.push("End date must be after start date");
      }
    }
  }
  
  // CRITICAL: Validate title
  if (!formData.userSurname && !formData.title) {
    errors.push("Event title is required");
  }
  
  // If validation passes, create sanitized data
  if (errors.length === 0) {
    const sanitizedData = {
      title: formData.userSurname || formData.title || 'Untitled Event',
      user_surname: formData.userSurname || formData.title || 'Unknown',
      user_number: formData.userNumber || '',
      social_network_link: formData.socialNetworkLink || '',
      event_notes: formData.eventNotes || '',
      event_name: formData.eventName || '',
      start_date: new Date(formData.startDate).toISOString(),
      end_date: new Date(formData.endDate).toISOString(),
      payment_status: formData.paymentStatus || 'not_paid',
      payment_amount: formData.paymentAmount || '',
      type: 'event',
      is_recurring: formData.isRecurring || false,
      repeat_pattern: formData.isRecurring ? (formData.repeatPattern || 'none') : null,
      repeat_until: (formData.isRecurring && formData.repeatUntil) ? formData.repeatUntil : null
    };
    
    console.log("✅ Event validation passed, sanitized data:", sanitizedData);
    
    return {
      isValid: true,
      errors: [],
      sanitizedData
    };
  }
  
  console.error("❌ Event validation failed:", errors);
  
  return {
    isValid: false,
    errors
  };
};
