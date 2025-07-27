
import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getArchivedTasks, restoreTask, deleteTask } from '@/lib/api';
import { useLanguage } from '@/contexts/LanguageContext';
import { ArchivedTaskCard } from './ArchivedTaskCard';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Trash2, RotateCcw, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { LanguageText } from '@/components/shared/LanguageText';

export const ArchivedTasksPage = () => {
  const { t } = useLanguage();
  const { toast } = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: archivedTasks = [], isLoading, error } = useQuery({
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
        description: "Task restored successfully",
      });
    },
    onError: (error) => {
      console.error('Error restoring task:', error);
      toast({
        title: t('common.error'),
        description: "Failed to restore task",
        variant: "destructive",
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
    onError: (error) => {
      console.error('Error deleting task:', error);
      toast({
        title: t('common.error'),
        description: "Failed to delete task permanently",
        variant: "destructive",
      });
    },
  });

  const handleRestore = (taskId: string) => {
    restoreTaskMutation.mutate(taskId);
  };

  const handleDelete = (taskId: string) => {
    deleteTaskMutation.mutate(taskId);
  };

  const handleView = (taskId: string) => {
    // Navigate to task view or open modal
    console.log('View task:', taskId);
  };

  const handleGoBack = () => {
    navigate('/dashboard');
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg">
          <LanguageText textKey="common.loading" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg text-red-500">
          <LanguageText textKey="common.error" />
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4">
      <div className="flex items-center gap-4 mb-6">
        <Button
          variant="outline"
          onClick={handleGoBack}
          className="flex items-center gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          <LanguageText textKey="common.back" />
        </Button>
        <h1 className="text-2xl font-bold">
          <LanguageText textKey="tasks.archivedTasks" />
        </h1>
      </div>

      {archivedTasks.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>
              <LanguageText textKey="tasks.noArchivedTasks" />
            </CardTitle>
            <CardDescription>
              <LanguageText textKey="tasks.noArchivedTasksDescription" />
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="grid gap-4">
          {archivedTasks.map((task) => (
            <ArchivedTaskCard
              key={task.id}
              task={task}
              onRestore={() => handleRestore(task.id)}
              onDelete={() => handleDelete(task.id)}
              onView={() => handleView(task.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
};
