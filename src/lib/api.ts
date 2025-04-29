
// File handling functions
import { supabase } from "./supabase";
import type { FileRecord } from "@/types/files";
import { Task, Note, Reminder } from "@/lib/types";
import { v4 as uuidv4 } from 'uuid';

/**
 * Get all files for an event by event ID
 */
export async function getEventFiles(eventId: string): Promise<FileRecord[]> {
  try {
    console.log(`Fetching files for event ID: ${eventId}`);
    const { data, error } = await supabase
      .from('event_files')
      .select('*')
      .eq('event_id', eventId);
      
    if (error) {
      console.error('Error fetching event files:', error);
      throw error;
    }
    
    console.log(`Found ${data?.length || 0} files for event`);
    return data || [];
  } catch (error) {
    console.error('Exception in getEventFiles:', error);
    return [];
  }
}

/**
 * Get the download URL for a file
 */
export function getFileUrl(filePath: string, bucket: string = 'event_attachments'): string {
  // Clean up path to ensure consistent handling
  const cleanPath = filePath.replace(/^event_attachments\//, '');
  
  console.log(`Getting URL for file path: ${cleanPath} in bucket: ${bucket}`);
  
  return supabase.storage
    .from(bucket)
    .getPublicUrl(cleanPath).data.publicUrl;
}

/**
 * Delete a file from both storage and database
 */
export async function deleteFile(
  file: FileRecord, 
  bucket: string = 'event_attachments'
): Promise<boolean> {
  try {
    // Clean up path to ensure consistent handling
    const cleanPath = file.file_path.replace(/^event_attachments\//, '');
    console.log(`Attempting to delete file from storage: ${cleanPath}`);
    
    // First remove from storage
    const { error: storageError } = await supabase.storage
      .from(bucket)
      .remove([cleanPath]);
      
    if (storageError) {
      console.error('Error removing file from storage:', storageError);
      // Continue anyway to try removing the database record
    }
    
    // Then remove database record
    const { error: dbError } = await supabase
      .from('event_files')
      .delete()
      .eq('id', file.id);
      
    if (dbError) {
      console.error('Error removing file record from database:', dbError);
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('Exception in deleteFile:', error);
    return false;
  }
}

// Task-related functions

/**
 * Get all tasks for the current user
 */
export async function getTasks(): Promise<Task[]> {
  try {
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .order('position', { ascending: true });
      
    if (error) throw error;
    
    return data || [];
  } catch (error) {
    console.error('Error fetching tasks:', error);
    return [];
  }
}

/**
 * Create a new task
 */
export async function createTask(taskData: Omit<Task, 'id' | 'created_at'>): Promise<Task | null> {
  try {
    const { data, error } = await supabase
      .from('tasks')
      .insert(taskData)
      .select()
      .single();
      
    if (error) throw error;
    
    return data;
  } catch (error) {
    console.error('Error creating task:', error);
    return null;
  }
}

/**
 * Update an existing task
 */
export async function updateTask(id: string, updates: Partial<Task>): Promise<Task | null> {
  try {
    const { data, error } = await supabase
      .from('tasks')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
      
    if (error) throw error;
    
    return data;
  } catch (error) {
    console.error('Error updating task:', error);
    return null;
  }
}

/**
 * Delete a task
 */
export async function deleteTask(id: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('tasks')
      .delete()
      .eq('id', id);
      
    if (error) throw error;
    
    return true;
  } catch (error) {
    console.error('Error deleting task:', error);
    return false;
  }
}

// Note-related functions

/**
 * Get all notes for the current user
 */
export async function getNotes(): Promise<Note[]> {
  try {
    const { data, error } = await supabase
      .from('notes')
      .select('*')
      .order('created_at', { ascending: false });
      
    if (error) throw error;
    
    return data || [];
  } catch (error) {
    console.error('Error fetching notes:', error);
    return [];
  }
}

/**
 * Create a new note
 */
export async function createNote(noteData: Omit<Note, 'id' | 'created_at'>): Promise<Note | null> {
  try {
    const { data, error } = await supabase
      .from('notes')
      .insert(noteData)
      .select()
      .single();
      
    if (error) throw error;
    
    return data;
  } catch (error) {
    console.error('Error creating note:', error);
    return null;
  }
}

/**
 * Update an existing note
 */
export async function updateNote(id: string, updates: Partial<Note>): Promise<Note | null> {
  try {
    const { data, error } = await supabase
      .from('notes')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
      
    if (error) throw error;
    
    return data;
  } catch (error) {
    console.error('Error updating note:', error);
    return null;
  }
}

/**
 * Delete a note
 */
export async function deleteNote(id: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('notes')
      .delete()
      .eq('id', id);
      
    if (error) throw error;
    
    return true;
  } catch (error) {
    console.error('Error deleting note:', error);
    return false;
  }
}

// Reminder-related functions

/**
 * Get all reminders for the current user
 */
export async function getReminders(): Promise<Reminder[]> {
  try {
    const { data, error } = await supabase
      .from('reminders')
      .select('*')
      .order('remind_at', { ascending: true });
      
    if (error) throw error;
    
    return data || [];
  } catch (error) {
    console.error('Error fetching reminders:', error);
    return [];
  }
}

/**
 * Create a new reminder
 */
export async function createReminder(reminderData: Omit<Reminder, 'id' | 'created_at'>): Promise<Reminder | null> {
  try {
    const { data, error } = await supabase
      .from('reminders')
      .insert(reminderData)
      .select()
      .single();
      
    if (error) throw error;
    
    return data;
  } catch (error) {
    console.error('Error creating reminder:', error);
    return null;
  }
}

/**
 * Update an existing reminder
 */
export async function updateReminder(id: string, updates: Partial<Reminder>): Promise<Reminder | null> {
  try {
    const { data, error } = await supabase
      .from('reminders')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
      
    if (error) throw error;
    
    return data;
  } catch (error) {
    console.error('Error updating reminder:', error);
    return null;
  }
}

/**
 * Delete a reminder
 */
export async function deleteReminder(id: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('reminders')
      .delete()
      .eq('id', id);
      
    if (error) throw error;
    
    return true;
  } catch (error) {
    console.error('Error deleting reminder:', error);
    return false;
  }
}

/**
 * Get public calendar events
 */
export async function getPublicCalendarEvents(businessId: string, startDate?: string, endDate?: string) {
  try {
    console.log('Fetching public calendar events for business:', businessId);
    
    // First, get the events directly from events table
    let eventsQuery = supabase
      .from('events')
      .select('*')
      .eq('user_id', businessId)
      .is('deleted_at', null);
    
    if (startDate) {
      eventsQuery = eventsQuery.gte('start_date', startDate);
    }
    
    if (endDate) {
      eventsQuery = eventsQuery.lte('end_time', endDate);
    }
    
    const { data: userEvents, error: eventsError } = await eventsQuery;
    
    if (eventsError) {
      console.error('Error fetching user events:', eventsError);
    }
    
    // Then get the approved booking requests for this business
    const { data: bookings, error: bookingsError } = await supabase
      .from('booking_requests')
      .select('*')
      .eq('business_id', businessId)
      .eq('status', 'approved');
    
    if (bookingsError) {
      console.error('Error fetching approved bookings:', bookingsError);
    }
    
    console.log(`Public calendar: found ${userEvents?.length || 0} direct events`);
    console.log(`Public calendar: found ${bookings?.length || 0} booking events`);
    
    // Return the combined result
    return {
      events: userEvents || [],
      bookings: bookings || []
    };
  } catch (error) {
    console.error('Error fetching public calendar events:', error);
    return { events: [], bookings: [] };
  }
}

/**
 * Upload a file for a task and create the database record
 */
export async function uploadTaskFile(
  taskId: string,
  file: File,
  userId: string
): Promise<{ success: boolean; file?: any; error?: string }> {
  try {
    // Generate a unique filename
    const fileExt = file.name.split('.').pop();
    const uniqueId = uuidv4();
    const filePath = `${taskId}/${uniqueId}.${fileExt}`;
    
    // Upload to storage
    const { error: uploadError } = await supabase.storage
      .from('task_attachments')
      .upload(filePath, file);

    if (uploadError) {
      console.error('Error uploading file:', uploadError);
      return { success: false, error: uploadError.message };
    }
    
    // Create file record in database
    const fileData = {
      task_id: taskId,
      filename: file.name,
      file_path: filePath,
      content_type: file.type,
      size: file.size,
      user_id: userId
    };
    
    const { data: fileRecord, error: dbError } = await supabase
      .from('files')
      .insert(fileData)
      .select()
      .single();

    if (dbError) {
      console.error('Error creating file record:', dbError);
      return { success: false, error: dbError.message };
    }
    
    return { success: true, file: fileRecord };
  } catch (error) {
    console.error('Exception in uploadTaskFile:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

/**
 * Delete a task file 
 */
export async function deleteTaskFile(
  fileId: string,
  filePath: string
): Promise<boolean> {
  try {
    // First remove from storage
    const { error: storageError } = await supabase.storage
      .from('task_attachments')
      .remove([filePath]);
      
    if (storageError) {
      console.error('Error removing file from storage:', storageError);
      // Continue anyway to try removing the database record
    }
    
    // Then remove database record
    const { error: dbError } = await supabase
      .from('files')
      .delete()
      .eq('id', fileId);
      
    if (dbError) {
      console.error('Error removing file record from database:', dbError);
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('Exception in deleteTaskFile:', error);
    return false;
  }
}
