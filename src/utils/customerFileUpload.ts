import { supabase } from "@/lib/supabase";

export interface UploadCustomerFilesOptions {
  files: File[];
  customerId: string;
  userId: string;
  isPublicMode?: boolean;
  ownerId?: string; // board owner id for public mode
}

/**
 * Upload files to customer_attachments storage and create records in customer_files_new table
 * @param options - Upload configuration including files, customerId, userId, and context
 * @returns Promise that resolves when all files are uploaded
 */
export const uploadCustomerFiles = async (options: UploadCustomerFilesOptions): Promise<void> => {
  const { files, customerId, userId, isPublicMode = false, ownerId } = options;
  
  if (files.length === 0) return;
  
  console.log(`📤 Uploading ${files.length} files for customer:`, customerId);
  
  const uploadPromises = files.map(async (file) => {
    const fileExt = file.name.split('.').pop();
    const fileName = `${customerId}/${Date.now()}.${fileExt}`;
    
    // Upload file to storage
    const { error: uploadError } = await supabase.storage
      .from('customer_attachments')
      .upload(fileName, file);

    if (uploadError) {
      console.error('❌ Error uploading customer file:', uploadError);
      throw uploadError;
    }

    // Create record in customer_files_new table - simple direct insert
    if (isPublicMode && ownerId) {
      // PUBLIC: use RPC for public boards
      const { error: rpcError } = await supabase.rpc('public_insert_customer_file', {
        p_owner_id: ownerId,
        p_customer_id: customerId,
        p_filename: file.name,
        p_file_path: fileName,
        p_content_type: file.type,
        p_size: file.size
      });

      if (rpcError) {
        console.error('❌ Error saving customer file record via RPC:', rpcError);
        throw rpcError;
      }
    } else {
      // INTERNAL: direct insert (RLS has simple policies now)
      const { error: dbError } = await supabase
        .from('customer_files_new')
        .insert({
          filename: file.name,
          file_path: fileName,
          content_type: file.type,
          size: file.size,
          user_id: userId,
          customer_id: customerId
        });

      if (dbError) {
        console.error('❌ Error saving customer file record:', dbError);
        throw dbError;
      }
    }

    console.log('✅ Customer file uploaded successfully:', file.name);
    return fileName;
  });

  await Promise.all(uploadPromises);
  console.log('✅ All customer files uploaded successfully for customer:', customerId);
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
    console.error('❌ Error loading existing customer files:', error);
    return [];
  }
};