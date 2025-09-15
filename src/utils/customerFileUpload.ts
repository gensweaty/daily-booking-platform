import { supabase } from "@/lib/supabase";

export interface UploadCustomerFilesOptions {
  files: File[];
  customerId: string;
  userId: string;
  isPublicMode?: boolean;
}

/**
 * Upload files to customer_attachments storage and create records in customer_files_new table
 * @param options - Upload configuration including files, customerId, userId, and context
 * @returns Promise that resolves when all files are uploaded
 */
export const uploadCustomerFiles = async (options: UploadCustomerFilesOptions): Promise<void> => {
  const { files, customerId, userId, isPublicMode = false } = options;
  
  if (files.length === 0) return;
  
  console.log(`📤 [${isPublicMode ? 'Public' : 'Internal'}] Uploading ${files.length} files for customer:`, customerId);
  
  for (const file of files) {
    const fileExt = file.name.split('.').pop() || 'bin';
    const fileName = `${customerId}/${crypto.randomUUID()}.${fileExt}`;
    
    // Upload file to storage
    const { error: uploadError } = await supabase.storage
      .from('customer_attachments')
      .upload(fileName, file);

    if (uploadError) {
      console.error(`❌ [${isPublicMode ? 'Public' : 'Internal'}] Error uploading file:`, uploadError);
      throw uploadError; // Surface the real error
    }

    // Create record in customer_files_new table
    const { error: dbError } = await supabase
      .from('customer_files_new')
      .insert({
        filename: file.name,
        file_path: fileName,
        content_type: file.type,
        size: file.size,
        user_id: userId, // Always use the provided userId (board owner for public customers)
        customer_id: customerId
      });

    if (dbError) {
      console.error(`❌ [${isPublicMode ? 'Public' : 'Internal'}] Error saving file record:`, dbError);
      throw dbError; // Surface the real error for RLS debugging
    }

    console.log(`✅ [${isPublicMode ? 'Public' : 'Internal'}] File uploaded successfully:`, file.name);
  }
  
  console.log(`✅ [${isPublicMode ? 'Public' : 'Internal'}] All files uploaded successfully for customer:`, customerId);
};

/**
 * Load existing files for a customer from the customer_files_new table
 * @param customerId - The customer ID to load files for
 * @returns Promise that resolves to an array of file records
 */
export const loadCustomerFiles = async (customerId: string) => {
  try {
    console.log('🔍 Loading existing files for customer:', customerId);

    const { data: customerFiles, error } = await supabase
      .from('customer_files_new')
      .select('*')
      .eq('customer_id', customerId);

    if (error) {
      console.error('❌ Error loading customer files:', error);
      return [];
    }

    console.log('✅ Loaded existing files:', customerFiles?.length || 0, 'files for customer:', customerId);
    return customerFiles || [];
  } catch (error) {
    console.error('❌ Error loading existing files:', error);
    return [];
  }
};