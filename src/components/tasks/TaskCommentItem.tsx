import { useState } from "react";
import { TaskComment, CommentFile } from "@/lib/types";
import { format, parseISO } from "date-fns";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { SimpleFileDisplay } from "@/components/shared/SimpleFileDisplay";
import { FileUploadField } from "@/components/shared/FileUploadField";
import { Edit, Trash2, Save, X, Paperclip, User } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import { updateComment, deleteComment, uploadCommentFile, getCommentFiles } from "@/lib/commentApi";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import { useAuth } from "@/contexts/AuthContext";

interface TaskCommentItemProps {
  comment: TaskComment;
  canDelete: boolean;
  username?: string;
  externalUserName?: string;
  isExternal?: boolean;
  taskCreatorName?: string;
}

const getDisplayName = (comment: TaskComment, fallbackName?: string, externalName?: string) => {
  // Prefer non-email names
  const sanitize = (name?: string) => {
    if (!name) return undefined;
    return name.includes('@') ? name.split('@')[0] : name;
  };

  // For external users
  if (comment.created_by_type === 'external' || comment.created_by_type === 'external_user') {
    const fromComment = sanitize(comment.created_by_name);
    const fromFallback = sanitize(fallbackName);
    const fromExternal = sanitize(externalName);
    return fromComment || fromFallback || fromExternal || 'External User';
  }
  
  // For admin users
  const adminName = sanitize(comment.created_by_name);
  return adminName || 'Unknown User';
};

export const TaskCommentItem = ({ 
  comment, 
  canDelete, 
  username, 
  externalUserName, 
  isExternal = false,
  taskCreatorName
}: TaskCommentItemProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(comment.content);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const { toast } = useToast();
  const { t } = useLanguage();
const queryClient = useQueryClient();
const { session: adminSession } = useAdminAuth();
const { user } = useAuth();

  const sanitizeName = (name?: string) => (name ? (name.includes('@') ? name.split('@')[0] : name) : '');

  // Fetch comment files
  const { data: files = [] } = useQuery({
    queryKey: ['commentFiles', comment.id],
    queryFn: () => getCommentFiles(comment.id),
  });

  // Update comment mutation
  const updateMutation = useMutation({
    mutationFn: ({ content, editorName, editorType }: { 
      content: string; 
      editorName: string; 
      editorType: string;
    }) => updateComment(comment.id, {
      content,
      last_edited_by_name: editorName,
      last_edited_by_type: editorType,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['taskComments'] });
      setIsEditing(false);
      toast({
        title: t?.('taskComments.updateSuccess') || 'Comment updated successfully',
      });
    },
    onError: (error) => {
      console.error('Error updating comment:', error);
      toast({
        title: t?.('taskComments.updateError') || 'Failed to update comment',
        variant: 'destructive',
      });
    },
  });

  // Delete comment mutation
  const deleteMutation = useMutation({
    mutationFn: () => deleteComment(comment.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['taskComments'] });
      toast({
        title: t?.('taskComments.deleteSuccess') || 'Comment deleted successfully',
      });
    },
    onError: (error) => {
      console.error('Error deleting comment:', error);
      toast({
        title: t?.('taskComments.deleteError') || 'Failed to delete comment',
        variant: 'destructive',
      });
    },
  });

  // Upload file mutation
  const uploadFileMutation = useMutation({
    mutationFn: (file: File) => uploadCommentFile(comment.id, file, comment.user_id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['commentFiles', comment.id] });
      setSelectedFile(null);
      toast({
        title: t?.('taskComments.fileUploadSuccess') || 'File uploaded successfully',
      });
    },
    onError: (error) => {
      console.error('Error uploading file:', error);
      toast({
        title: t?.('taskComments.fileUploadError') || 'Failed to upload file',
        variant: 'destructive',
      });
    },
  });

  // Prefer admin profile full name; fallback to session username; never email prefix
  const getAdminName = () => {
    if (username && !username.includes('@')) return username;
    const fullName = (user?.user_metadata?.full_name as string) || '';
    if (fullName && !fullName.includes('@')) return fullName;
    if (adminSession?.isAuthenticated && adminSession.username && !adminSession.username.includes('@')) return adminSession.username;
    const name = username || (fullName || user?.email || 'Admin');
    return name.includes('@') ? name.split('@')[0] : name;
  };

  const handleSave = () => {
    if (!editContent.trim()) return;
    
    const editorName = isExternal
      ? externalUserName || 'External User'
      : getAdminName();
    const editorType = isExternal ? 'external_user' : 'admin';
    
    updateMutation.mutate({
      content: editContent,
      editorName,
      editorType,
    });
  };

  const handleCancel = () => {
    setEditContent(comment.content);
    setIsEditing(false);
  };

  const handleFileUpload = () => {
    if (selectedFile) {
      uploadFileMutation.mutate(selectedFile);
    }
  };

  const handleFileDeleted = () => {
    queryClient.invalidateQueries({ queryKey: ['commentFiles', comment.id] });
  };

  return (
    <Card className="mb-3">
      <CardContent className="p-3">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            <User className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">
              {getDisplayName(comment, taskCreatorName, externalUserName)}
            </span>
            <span className="text-xs text-muted-foreground">
              {(comment.created_by_type === 'external' || comment.created_by_type === 'external_user') ? '(Sub User)' : '(User)'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {!isEditing && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsEditing(true)}
              >
                <Edit className="h-4 w-4" />
              </Button>
            )}
            {canDelete && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => deleteMutation.mutate()}
                disabled={deleteMutation.isPending}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>

        {isEditing ? (
          <div className="space-y-3">
            <Textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              placeholder={t?.('taskComments.contentPlaceholder') || 'Enter your comment...'}
              className="min-h-[80px]"
            />
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                onClick={handleSave}
                disabled={!editContent.trim() || updateMutation.isPending}
              >
                <Save className="h-4 w-4 mr-1" />
                {t?.('common.save') || 'Save'}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleCancel}
              >
                <X className="h-4 w-4 mr-1" />
                {t?.('common.cancel') || 'Cancel'}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm whitespace-pre-wrap">{comment.content}</p>
            
            {files.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-1">
                  <Paperclip className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium text-muted-foreground">
                    {t?.('taskComments.attachments') || 'Attachments'}
                  </span>
                </div>
                {files.map((file) => (
                  <SimpleFileDisplay
                    key={file.id}
                    files={[{
                      id: file.id,
                      filename: file.filename,
                      file_path: file.file_path,
                      content_type: file.content_type || '',
                      size: file.size || 0,
                      created_at: file.created_at,
                      user_id: file.user_id || '',
                      parentType: 'task'
                    }]}
                    parentType="task"
                    allowDelete={canDelete}
                    onFileDeleted={handleFileDeleted}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {isEditing && (
          <>
            <Separator className="my-3" />
            <div className="space-y-3">
              <div className="flex items-center gap-1">
                <Paperclip className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium text-muted-foreground">
                  {t?.('taskComments.addAttachment') || 'Add Attachment'}
                </span>
              </div>
              <FileUploadField
                onFileSelect={setSelectedFile}
                disabled={uploadFileMutation.isPending}
              />
            </div>
          </>
        )}

        <Separator className="my-3" />
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            {t?.('common.created') || 'Created'}: {format(parseISO(comment.created_at), 'MMM dd, yyyy HH:mm')}
          </span>
          {comment.last_edited_at && (
            <span>
              {t?.('common.lastUpdated') || 'Last updated'}: {format(parseISO(comment.last_edited_at), 'MMM dd, yyyy HH:mm')} {t?.('common.by') || 'by'} {sanitizeName(comment.last_edited_by_name)} ({comment.last_edited_by_type})
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
};