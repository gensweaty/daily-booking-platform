
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { PlusCircle } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { RichTextEditor } from "./shared/RichTextEditor";
import { FileUploadField } from "./shared/FileUploadField";

export const AddNoteForm = () => {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [isExpanded, setIsExpanded] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { t } = useLanguage();

  const createNoteMutation = useMutation({
    mutationFn: async ({
      title,
      content,
      userId,
      file,
    }: {
      title: string;
      content: string;
      userId: string;
      file: File | null;
    }) => {
      // Create the note first
      const { data: note, error } = await supabase
        .from("notes")
        .insert([
          {
            title,
            content,
            user_id: userId,
          },
        ])
        .select()
        .single();

      if (error) throw error;

      // If we have a file, upload it and create a record
      if (file && note) {
        const fileExt = file.name.split('.').pop();
        const filePath = `${userId}/${note.id}/${crypto.randomUUID()}.${fileExt}`;
        
        const { error: uploadError } = await supabase.storage
          .from('note_attachments')
          .upload(filePath, file);
          
        if (uploadError) throw uploadError;
        
        // Create a record in files table
        const { error: fileError } = await supabase
          .from('files')
          .insert([
            {
              filename: file.name,
              file_path: filePath,
              content_type: file.type,
              size: file.size,
              user_id: userId,
              note_id: note.id
            }
          ]);
          
        if (fileError) throw fileError;
      }

      return note;
    },
    onSuccess: () => {
      setTitle("");
      setContent("");
      setSelectedFile(null);
      setIsExpanded(false);
      queryClient.invalidateQueries({ queryKey: ["notes"] });
      toast.note.added();
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        description: error.message
      });
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim()) {
      toast({
        variant: "destructive",
        description: t("notes.titleRequired")
      });
      return;
    }

    if (!user) {
      toast({
        variant: "destructive",
        description: t("common.authRequired")
      });
      return;
    }

    createNoteMutation.mutate({
      title,
      content,
      userId: user.id,
      file: selectedFile,
    });
  };

  if (!isExpanded) {
    return (
      <Card className="shadow-sm mb-6">
        <CardContent className="pt-6">
          <div
            className="flex items-center gap-3 cursor-pointer"
            onClick={() => setIsExpanded(true)}
          >
            <PlusCircle className="h-5 w-5 text-muted-foreground" />
            <p className="text-muted-foreground">
              {t("notes.addNewNote")}
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-sm mb-6">
      <CardContent className="py-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">{t("notes.title")}</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t("notes.titlePlaceholder")}
            />
          </div>

          <div className="space-y-2">
            <Label>{t("notes.content")}</Label>
            <RichTextEditor
              content={content}
              onChange={setContent}
              placeholder={t("notes.contentPlaceholder")}
            />
          </div>

          <FileUploadField
            onChange={setSelectedFile}
            fileError={fileError}
            setFileError={setFileError}
          />

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setIsExpanded(false);
                setTitle("");
                setContent("");
                setSelectedFile(null);
                setFileError("");
              }}
            >
              {t("common.cancel")}
            </Button>
            <Button
              type="submit"
              disabled={createNoteMutation.isPending || !title.trim()}
            >
              {createNoteMutation.isPending
                ? t("common.saving")
                : t("common.save")}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};
