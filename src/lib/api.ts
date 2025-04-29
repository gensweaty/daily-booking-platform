
import { Task, Note, Reminder, CalendarEvent } from "@/lib/types";
import { supabase, normalizeFilePath } from "@/lib/supabase";
import { BookingRequest } from "@/types/database";

const BOOKING_RATE_LIMIT_KEY = "lastBookingTimestamp";
const BOOKING_RATE_LIMIT_SECONDS = 60;

export const rateLimitActive = () => {
  const lastTimestamp = localStorage.getItem(BOOKING_RATE_LIMIT_KEY);
  if (!lastTimestamp) return false;
  
  const now = Date.now();
  const elapsed = now - parseInt(lastTimestamp, 10);
  return elapsed < BOOKING_RATE_LIMIT_SECONDS * 1000;
};

export const isBookingFormBlocked = () => {
  return rateLimitActive();
};

export const checkRateLimit = () => {
  const lastTimestamp = localStorage.getItem(BOOKING_RATE_LIMIT_KEY);
  
  if (lastTimestamp) {
    const now = Date.now();
    const elapsed = now - parseInt(lastTimestamp, 10);
    
    if (elapsed < BOOKING_RATE_LIMIT_SECONDS * 1000) {
      const remainingSeconds = Math.ceil((BOOKING_RATE_LIMIT_SECONDS * 1000 - elapsed) / 1000);
      throw new Error(`Please wait ${remainingSeconds} seconds before submitting another request`);
    }
  }
  
  return true;
};

export const updateRateLimitTimestamp = () => {
  const now = Date.now();
  localStorage.setItem(BOOKING_RATE_LIMIT_KEY, now.toString());
};

export const resetRateLimit = () => {
  localStorage.removeItem(BOOKING_RATE_LIMIT_KEY);
};

export const createBookingRequest = async (request: Omit<BookingRequest, "id" | "created_at" | "updated_at" | "status" | "user_id">, file?: File) => {
  // Get current user if available
  const { data: userData } = await supabase.auth.getUser();
  
  console.log("Creating booking request:", request);
  console.log("File attached:", file ? file.name : "No file");
  
  try {
    // Check rate limit before creating booking
    checkRateLimit();
    
    // Add user ID if authenticated
    const bookingData = {
      ...request,
      user_id: userData?.user?.id || null,
    };
    
    const { data, error } = await supabase
      .from("booking_requests")
      .insert(bookingData)
      .select()
      .single();
    
    if (error) {
      console.error("Error creating booking request:", error);
      throw error;
    }
    
    // Handle file upload if a file is provided
    if (file && data?.id) {
      try {
        console.log("Uploading file for booking request:", file.name);
        
        // Generate a unique filename
        const fileExt = file.name.split('.').pop();
        const filePath = `${crypto.randomUUID()}.${fileExt}`;
        
        // Upload the file to storage
        const { error: uploadError } = await supabase.storage
          .from('event_attachments')
          .upload(filePath, file);
          
        if (uploadError) {
          console.error("Error uploading file:", uploadError);
          throw uploadError;
        }
        
        // Create a file record in the database linked to the booking request
        const fileData = {
          filename: file.name,
          file_path: filePath,
          content_type: file.type,
          size: file.size,
          event_id: data.id,
          user_id: userData?.user?.id || null
        };
        
        const { error: fileRecordError } = await supabase
          .from('event_files')
          .insert(fileData);
          
        if (fileRecordError) {
          console.error("Error creating file record:", fileRecordError);
          throw fileRecordError;
        }
        
        console.log("File uploaded and associated with booking request:", data.id);
      } catch (fileError) {
        console.error("Error handling file upload:", fileError);
        // Continue even if file upload fails, we've already created the booking request
      }
    }
    
    // Store current timestamp in localStorage for rate limiting
    updateRateLimitTimestamp();
    
    return data;
  } catch (error) {
    console.error("Error in createBookingRequest:", error);
    throw error;
  }
};

export const getPublicBusinessProfile = async (slug: string) => {
  console.log("Fetching business profile for:", slug);
  const { data, error } = await supabase
    .from("business_profiles")
    .select("*")
    .eq("slug", slug)
    .single();

  if (error) {
    console.error("Error fetching public business profile:", error);
    throw error;
  }

  return data;
};
