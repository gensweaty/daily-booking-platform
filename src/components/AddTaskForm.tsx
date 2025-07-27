
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { TaskFormFields } from '@/components/tasks/TaskFormFields';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { translations } from '@/translations';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, X } from 'lucide-react';

const AddTaskForm = () => {
  const { user } = useAuth();
  const { language } = useLanguage();
  const t = translations[language];
  const queryClient = useQueryClient();
  
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    deadline: '',
    reminder: '',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id) return;

    setIsSubmitting(true);
    
    try {
      const { error } = await supabase
        .from('tasks')
        .insert([{
          title: formData.title,
          description: formData.description,
          status: 'todo',
          user_id: user.id,
          deadline: formData.deadline || null,
          reminder: formData.reminder || null,
          timezone: formData.timezone
        }]);

      if (error) throw error;

      toast.success(t.tasks.taskAdded);
      setFormData({
        title: '',
        description: '',
        deadline: '',
        reminder: '',
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
      });
      setIsOpen(false);
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    } catch (error) {
      console.error('Error adding task:', error);
      toast.error(t.common.error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  if (!isOpen) {
    return (
      <Button
        onClick={() => setIsOpen(true)}
        className="mb-4"
        size="sm"
      >
        <Plus className="h-4 w-4 mr-2" />
        {t.tasks.addTask}
      </Button>
    );
  }

  return (
    <Card className="mb-4">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">{t.tasks.addTask}</CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsOpen(false)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Input
              placeholder={t.tasks.titlePlaceholder}
              value={formData.title}
              onChange={(e) => handleInputChange('title', e.target.value)}
              required
            />
          </div>
          
          <TaskFormFields
            formData={formData}
            onInputChange={handleInputChange}
            isSubmitting={isSubmitting}
          />
          
          <div className="flex gap-2">
            <Button
              type="submit"
              disabled={isSubmitting || !formData.title}
              className="flex-1"
            >
              {isSubmitting ? t.common.submitting : t.common.create}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsOpen(false)}
              className="flex-1"
            >
              {t.common.cancel}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};

export default AddTaskForm;
