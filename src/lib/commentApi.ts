import { supabase } from './supabase';
import { TaskComment, CommentFile } from './types';

// Comment CRUD operations
export const createComment = async (comment: {
  task_id: string;
  content: string;
  user_id?: string;
  created_by_name?: string;
  created_by_type?: string;
}): Promise<TaskComment | null> => {
  try {
    const { data, error } = await supabase
      .from('task_comments')
      .insert([comment])
      .select()
      .single();

    if (error) throw error;

    // Fire-and-forget email notification via Edge Function
    try {
      const { data: auth } = await supabase.auth.getUser();
      const actorEmail = auth?.user?.email;
      const baseUrl = window.location.origin;
      await supabase.functions.invoke('send-comment-email', {
        body: {
          taskId: comment.task_id,
          commentId: data?.id,
          actorName: comment.created_by_name,
          actorType: comment.created_by_type,
          actorEmail,
          content: comment.content,
          baseUrl,
        },
      });
    } catch (e) {
      console.warn('[commentApi] Failed to invoke send-comment-email:', e);
    }

    return data;
  } catch (error) {
    console.error('Error creating comment:', error);
    throw error;
  }
};

export const updateComment = async (
  id: string, 
  updates: {
    content?: string;
    last_edited_by_name?: string;
    last_edited_by_type?: string;
  }
): Promise<TaskComment | null> => {
  try {
    const { data, error } = await supabase
      .from('task_comments')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error updating comment:', error);
    throw error;
  }
};

export const getTaskComments = async (taskId: string): Promise<TaskComment[]> => {
  try {
    const { data, error } = await supabase
      .from('task_comments')
      .select('*')
      .eq('task_id', taskId)
      .is('deleted_at', null)
      .order('created_at', { ascending: true });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching comments:', error);
    throw error;
  }
};

export const deleteComment = async (id: string): Promise<void> => {
  try {
    const { error } = await supabase
      .from('task_comments')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id);

    if (error) throw error;
  } catch (error) {
    console.error('Error deleting comment:', error);
    throw error;
  }
};

// Comment files operations
export const getCommentFiles = async (commentId: string): Promise<CommentFile[]> => {
  try {
    const { data, error } = await supabase
      .from('comment_files')
      .select('*')
      .eq('comment_id', commentId)
      .order('created_at', { ascending: true });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching comment files:', error);
    throw error;
  }
};

export const uploadCommentFile = async (
  commentId: string,
  file: File,
  userId?: string
): Promise<CommentFile | null> => {
  try {
    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}.${fileExt}`;
    const filePath = `comment-files/${commentId}/${fileName}`;

    // Upload file to storage
    const { error: uploadError } = await supabase.storage
      .from('task_attachments')
      .upload(filePath, file);

    if (uploadError) throw uploadError;

    // Create file record
    const { data, error } = await supabase
      .from('comment_files')
      .insert([{
        comment_id: commentId,
        filename: file.name,
        file_path: filePath,
        content_type: file.type,
        size: file.size,
        user_id: userId
      }])
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error uploading comment file:', error);
    throw error;
  }
};

export const deleteCommentFile = async (fileId: string, filePath: string): Promise<void> => {
  try {
    // Delete from storage
    const { error: storageError } = await supabase.storage
      .from('task_attachments')
      .remove([filePath]);

    if (storageError) throw storageError;

    // Delete record
    const { error } = await supabase
      .from('comment_files')
      .delete()
      .eq('id', fileId);

    if (error) throw error;
  } catch (error) {
    console.error('Error deleting comment file:', error);
    throw error;
  }
};