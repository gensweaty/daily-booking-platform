
import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getArchivedTasks, restoreTask, deleteTask } from '@/lib/api';
import { Task } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/use-toast';
import { useLanguage } from '@/contexts/LanguageContext';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { useNavigate } from 'react-router-dom';
import { Edit, Eye, RotateCw, Trash2, AlertCircle } from 'lucide-react';

interface ArchivedTaskCardProps {
  task: Task;
  onRestore: (taskId: string) => Promise<void>;
  onDelete: (taskId: string) => Promise<void>;
  onView: (taskId: string) => void;
}

const ArchivedTaskCard: React.FC<ArchivedTaskCardProps> = ({ task, onDelete, onRestore, onView }) => {
  const { t } = useLanguage();
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  return (
    <Card className="bg-zinc-100 dark:bg-zinc-900">
      <CardHeader>
        <CardTitle>{task.title}</CardTitle>
        <CardDescription>
          {t('tasks.archive')} {new Date(task.archived_at || '').toLocaleDateString()}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {task.description}
      </CardContent>
      <CardFooter className="flex justify-between items-center">
        <Button variant="outline" size="sm" onClick={() => onView(task.id)}>
          <Eye className="mr-2 h-4 w-4" />
          {t('common.view')}
        </Button>
        <div>
          <Button variant="ghost" size="sm" onClick={() => onRestore(task.id)}>
            <RotateCw className="mr-2 h-4 w-4" />
            {t('tasks.restore')}
          </Button>
          <Button variant="destructive" size="sm" onClick={() => setIsDeleteDialogOpen(true)}>
            <Trash2 className="mr-2 h-4 w-4" />
            {t('common.delete')}
          </Button>
        </div>
      </CardFooter>

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-destructive" />
              {t('common.deleteConfirmTitle')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t('tasks.deleteTaskConfirmation')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={() => {
              onDelete(task.id);
              setIsDeleteDialogOpen(false);
            }} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {t('common.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
};

export const ArchivedTasksPage = () => {
  const { t } = useLanguage();
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: archivedTasks, isLoading, isError } = useQuery({
    queryKey: ['archivedTasks'],
    queryFn: getArchivedTasks,
  });

  const restoreTaskMutation = useMutation({
    mutationFn: restoreTask,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['archivedTasks'] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      toast({
        title: t('common.success'),
        description: t('tasks.taskUpdated'),
      });
    },
    onError: (error: any) => {
      toast({
        variant: 'destructive',
        title: t('common.error'),
        description: error.message || t('common.errorOccurred'),
      });
    },
  });

  const deleteTaskMutation = useMutation({
    mutationFn: deleteTask,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['archivedTasks'] });
      toast({
        title: t('common.success'),
        description: t('tasks.taskDeleted'),
      });
    },
    onError: (error: any) => {
      toast({
        variant: 'destructive',
        title: t('common.error'),
        description: error.message || t('common.errorOccurred'),
      });
    },
  });

  const handleRestore = async (taskId: string) => {
    await restoreTaskMutation.mutateAsync(taskId);
  };

  const handleDelete = async (taskId: string) => {
    await deleteTaskMutation.mutateAsync(taskId);
  };

  const handleView = (taskId: string) => {
    const task = archivedTasks?.find(t => t.id === taskId);
    if (task) {
      setSelectedTask(task);
      setIsViewDialogOpen(true);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">{t('tasks.archive')}</h2>
        <Button onClick={() => navigate('/tasks')}>{t('tasks.title')}</Button>
      </div>

      {isLoading && <p>{t('common.loading')}</p>}
      {isError && <p>{t('common.error')}</p>}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {archivedTasks?.map((task) => (
          <ArchivedTaskCard
            key={task.id}
            task={task}
            onRestore={handleRestore}
            onDelete={handleDelete}
            onView={handleView}
          />
        ))}
      </div>

      {selectedTask && (
        <AlertDialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{selectedTask.title}</AlertDialogTitle>
              <AlertDialogDescription>
                {selectedTask.description}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <Button onClick={() => setIsViewDialogOpen(false)}>{t('common.cancel')}</Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
};
