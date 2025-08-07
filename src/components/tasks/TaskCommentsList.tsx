import { useState } from "react";
import { TaskComment } from "@/lib/types";
import { TaskCommentItem } from "./TaskCommentItem";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { FileUploadField } from "@/components/shared/FileUploadField";
import { MessageSquare, Plus, Paperclip } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import { createComment, uploadCommentFile, getTaskComments } from "@/lib/commentApi";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";

interface TaskCommentsListProps {
  taskId: string;
  isEditing?: boolean;
  username?: string;
  externalUserName?: string;
  externalUserEmail?: string;
  isExternal?: boolean;
  userId?: string;
  taskCreatorName?: string;
}

export const TaskCommentsList = ({ 
  taskId, 
  isEditing = false, 
  username, 
  externalUserName, 
  externalUserEmail,
  isExternal = false,
  userId,
  taskCreatorName
}: TaskCommentsListProps) => {
  const [newComment, setNewComment] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [showAddComment, setShowAddComment] = useState(false);
  const { toast } = useToast();
  const { t } = useLanguage();
  const queryClient = useQueryClient();

  // Fetch comments
  const { data: comments = [], isLoading } = useQuery({
    queryKey: ['taskComments', taskId],
    queryFn: () => getTaskComments(taskId),
  });

  // Create comment mutation
  const createMutation = useMutation({
    mutationFn: async (commentData: {
      task_id: string;
      content: string;
      user_id?: string;
      created_by_name: string;
      created_by_type: string;
    }) => {
      const comment = await createComment(commentData);
      if (!comment) throw new Error('Failed to create comment');
      
      // Upload file if selected
      if (selectedFile) {
        await uploadCommentFile(comment.id, selectedFile, userId);
      }
      
      return comment;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['taskComments', taskId] });
      setNewComment("");
      setSelectedFile(null);
      setShowAddComment(false);
      toast({
        title: t?.('taskComments.createSuccess') || 'Comment added successfully',
      });
    },
    onError: (error) => {
      console.error('Error creating comment:', error);
      toast({
        title: t?.('taskComments.createError') || 'Failed to add comment',
        variant: 'destructive',
      });
    },
  });

  const handleAddComment = () => {
    if (!newComment.trim()) return;
    
    // Use the full name from sub_users table, not email
    const creatorName = isExternal ? `${externalUserName || 'External User'} (Sub User)` : username || 'Admin';
    const creatorType = isExternal ? 'external_user' : 'admin';
    
    createMutation.mutate({
      task_id: taskId,
      content: newComment,
      user_id: userId,
      created_by_name: creatorName,
      created_by_type: creatorType,
    });
  };

  const handleCancel = () => {
    setNewComment("");
    setSelectedFile(null);
    setShowAddComment(false);
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <MessageSquare className="h-5 w-5" />
            {t?.('taskComments.title') || 'Comments'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center text-muted-foreground">
            {t?.('common.loading') || 'Loading...'}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-0 shadow-none">
      <CardHeader className="p-3 pb-2">
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-base">
            <MessageSquare className="h-4 w-4" />
            {t?.('taskComments.title') || 'Comments'} ({comments.length})
          </div>
          {isEditing && !showAddComment && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowAddComment(true)}
              className="h-7 px-2 text-xs"
            >
              <Plus className="h-3 w-3 mr-1" />
              {t?.('taskComments.addComment') || 'Add Comment'}
            </Button>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-3 pt-1">
        {/* Add new comment form (only in edit mode) */}
        {isEditing && showAddComment && (
          <Card className="mb-4 border-dashed">
            <CardContent className="p-4">
              <div className="space-y-3">
                <Textarea
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder={t?.('taskComments.contentPlaceholder') || 'Enter your comment...'}
                  className="min-h-[80px]"
                />
                
                <div className="space-y-3">
                  <div className="flex items-center gap-1">
                    <Paperclip className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium text-muted-foreground">
                      {t?.('taskComments.addAttachment') || 'Add Attachment'}
                    </span>
                  </div>
                  <FileUploadField
                    onFileSelect={setSelectedFile}
                  />
                </div>
                
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    onClick={handleAddComment}
                    disabled={!newComment.trim() || createMutation.isPending}
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    {t?.('taskComments.addComment') || 'Add Comment'}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCancel}
                  >
                    {t?.('common.cancel') || 'Cancel'}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Comments list */}
        {comments.length === 0 ? (
          <div className="text-center text-muted-foreground py-2">
            <MessageSquare className="h-4 w-4 mx-auto mb-1 opacity-50" />
            <p className="text-xs">{t?.('taskComments.noComments') || 'No comments yet'}</p>
          </div>
        ) : (
          <ScrollArea className="max-h-[400px]">
            <div className="space-y-0">
              {comments.slice(0, 20).map((comment, index) => (
                <div key={comment.id}>
                  <TaskCommentItem
                    comment={comment}
                    canDelete={
                      isExternal 
                        ? comment.created_by_type === 'external_user' && 
                          comment.created_by_name === `${externalUserName} (Sub User)`
                        : userId === comment.user_id
                    }
                    username={username}
                    externalUserName={externalUserName}
                    isExternal={isExternal}
                    taskCreatorName={taskCreatorName}
                  />
                  {index < comments.length - 1 && <Separator />}
                </div>
              ))}
              {comments.length > 20 && (
                <div className="text-center text-sm text-muted-foreground py-2">
                  {t?.('taskComments.maxCommentsReached') || 'Showing latest 20 comments'}
                </div>
              )}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
};