import { supabase } from "./supabase";
import { BookingRequest } from "@/types/database";

// Function to create a booking request
export const createBookingRequest = async (data: Partial<BookingRequest>) => {
  console.log("Creating booking request with data:", data);
  
  try {
    // Check if booking_files table exists, if not create it
    let tableCheckError = null;
    try {
      const result = await supabase
        .from('booking_files')
        .select('id')
        .limit(1);
      tableCheckError = result.error;
    } catch (error) {
      tableCheckError = { message: 'Table does not exist' };
    }
    
    if (tableCheckError) {
      console.log('booking_files table might not exist, trying to create it');
      
      try {
        // Execute SQL to create the table
        const { error: createTableError } = await supabase.rpc('create_booking_files_table_if_not_exists');
        
        if (createTableError) {
          console.error('Error creating booking_files table:', createTableError);
        } else {
          console.log('Successfully created booking_files table');
        }
      } catch (err) {
        console.error('Exception creating booking_files table:', err);
      }
    }
    
    const { data: insertedData, error } = await supabase
      .from('booking_requests')
      .insert(data)
      .select()
      .single();
      
    if (error) {
      console.error("Error creating booking request:", error);
      throw new Error(error.message);
    }
    
    return insertedData;
  } catch (error: any) {
    console.error("Exception in createBookingRequest:", error);
    throw new Error(`Failed to create booking request: ${error.message}`);
  }
};

// Get public calendar events
export const getPublicCalendarEvents = async (businessId: string) => {
  try {
    console.log("Getting public calendar events for business ID:", businessId);
    
    // Call the Supabase function to get public events
    const { data, error } = await supabase.rpc('get_public_calendar_events', {
      business_id: businessId
    });
    
    if (error) {
      console.error("Error fetching public calendar events:", error);
      throw error;
    }
    
    return data || { events: [], bookings: [] };
  } catch (error) {
    console.error("Exception in getPublicCalendarEvents:", error);
    return { events: [], bookings: [] };
  }
};

// Tasks API Functions
export const createTask = async (taskData: Partial<Task>) => {
  try {
    const { data, error } = await supabase
      .from('tasks')
      .insert(taskData)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  } catch (error: any) {
    console.error("Error creating task:", error);
    throw new Error(`Failed to create task: ${error.message}`);
  }
};

export const updateTask = async (id: string, updates: Partial<Task>) => {
  try {
    const { data, error } = await supabase
      .from('tasks')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  } catch (error: any) {
    console.error("Error updating task:", error);
    throw new Error(`Failed to update task: ${error.message}`);
  }
};

export const getTasks = async (): Promise<Task[]> => {
  try {
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .order('position', { ascending: true });
    
    if (error) throw error;
    return data || [];
  } catch (error: any) {
    console.error("Error fetching tasks:", error);
    throw new Error(`Failed to fetch tasks: ${error.message}`);
  }
};

export const deleteTask = async (id: string) => {
  try {
    const { error } = await supabase
      .from('tasks')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
    return true;
  } catch (error: any) {
    console.error("Error deleting task:", error);
    throw new Error(`Failed to delete task: ${error.message}`);
  }
};

// Notes API Functions
export const createNote = async (noteData: Partial<Note>) => {
  try {
    const { data, error } = await supabase
      .from('notes')
      .insert(noteData)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  } catch (error: any) {
    console.error("Error creating note:", error);
    throw new Error(`Failed to create note: ${error.message}`);
  }
};

export const updateNote = async (id: string, updates: Partial<Note>) => {
  try {
    const { data, error } = await supabase
      .from('notes')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  } catch (error: any) {
    console.error("Error updating note:", error);
    throw new Error(`Failed to update note: ${error.message}`);
  }
};

export const getNotes = async (): Promise<Note[]> => {
  try {
    const { data, error } = await supabase
      .from('notes')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return data || [];
  } catch (error: any) {
    console.error("Error fetching notes:", error);
    throw new Error(`Failed to fetch notes: ${error.message}`);
  }
};

export const deleteNote = async (id: string) => {
  try {
    const { error } = await supabase
      .from('notes')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
    return true;
  } catch (error: any) {
    console.error("Error deleting note:", error);
    throw new Error(`Failed to delete note: ${error.message}`);
  }
};

// Reminders API Functions
export const createReminder = async (reminderData: Partial<Reminder>) => {
  try {
    const { data, error } = await supabase
      .from('reminders')
      .insert(reminderData)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  } catch (error: any) {
    console.error("Error creating reminder:", error);
    throw new Error(`Failed to create reminder: ${error.message}`);
  }
};

export const updateReminder = async (id: string, updates: Partial<Reminder>) => {
  try {
    const { data, error } = await supabase
      .from('reminders')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  } catch (error: any) {
    console.error("Error updating reminder:", error);
    throw new Error(`Failed to update reminder: ${error.message}`);
  }
};

export const getReminders = async (): Promise<Reminder[]> => {
  try {
    const { data, error } = await supabase
      .from('reminders')
      .select('*')
      .order('remind_at', { ascending: true });
    
    if (error) throw error;
    return data || [];
  } catch (error: any) {
    console.error("Error fetching reminders:", error);
    throw new Error(`Failed to fetch reminders: ${error.message}`);
  }
};

export const deleteReminder = async (id: string) => {
  try {
    const { error } = await supabase
      .from('reminders')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
    return true;
  } catch (error: any) {
    console.error("Error deleting reminder:", error);
    throw new Error(`Failed to delete reminder: ${error.message}`);
  }
};
