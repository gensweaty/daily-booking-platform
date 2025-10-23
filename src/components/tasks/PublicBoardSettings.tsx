import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Copy, ExternalLink, Globe, Lock } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/lib/supabase";
import { motion } from "framer-motion";
import { SubUsersSection } from "./SubUsersSection";

interface PublicBoard {
  id: string;
  magic_word: string;
  is_active: boolean;
  slug: string;
}

interface PublicBoardSettingsProps {
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  hideTrigger?: boolean;
}

export const PublicBoardSettings = ({ isOpen: externalIsOpen, onOpenChange: externalOnOpenChange, hideTrigger = false }: PublicBoardSettingsProps = {}) => {
  const { user } = useAuth();
  const { t } = useLanguage();
  const { toast } = useToast();
  const [internalIsOpen, setInternalIsOpen] = useState(false);
  
  // Use external state if provided, otherwise use internal state
  const isOpen = externalIsOpen !== undefined ? externalIsOpen : internalIsOpen;
  const setIsOpen = externalOnOpenChange || setInternalIsOpen;
  const [isPublic, setIsPublic] = useState(false);
  const [magicWord, setMagicWord] = useState("");
  const [slug, setSlug] = useState("");
  const [publicBoard, setPublicBoard] = useState<PublicBoard | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const publicUrl = publicBoard && publicBoard.slug ? 
    `${window.location.origin}/board/${publicBoard.slug}` : "";

  // Fetch existing public board settings when component mounts or user changes
  useEffect(() => {
    if (user) {
      fetchPublicBoard();
    }
  }, [user]);

  const fetchPublicBoard = async () => {
    if (!user) return;
    
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('public_boards')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        console.error('Error fetching public board:', error);
        return;
      }

      if (data) {
        setPublicBoard(data);
        setIsPublic(data.is_active);
        setMagicWord(data.magic_word);
        setSlug(data.slug || "");
      }
    } catch (error) {
      console.error('Error fetching public board:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Auto-generate slug from user name or email if not set
  useEffect(() => {
    if (user && !slug && !publicBoard && isPublic) {
      const userEmail = user.email?.split('@')[0] || 'user';
      const autoSlug = userEmail.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/--+/g, '-');
      setSlug(autoSlug);
    }
  }, [user, slug, publicBoard, isPublic]);

  const handleSaveSettings = async () => {
    if (!user || !magicWord.trim() || (isPublic && !slug.trim())) {
      toast({
        title: t("common.error"),
        description: !magicWord.trim() ? t("publicBoard.magicWordRequired") : t("publicBoard.slugRequired"),
        variant: "destructive",
      });
      return;
    }

    // Check for slug uniqueness if it's a new board or slug has changed
    if (isPublic && slug.trim() && (!publicBoard || publicBoard.slug !== slug.trim())) {
      const { data: existingBoard } = await supabase
        .from('public_boards')
        .select('id')
        .eq('slug', slug.trim())
        .neq('user_id', user.id)
        .maybeSingle();

      if (existingBoard) {
        toast({
          title: t("common.error"),
          description: "This URL is already taken. Please choose another one.",
          variant: "destructive",
        });
        return;
      }
    }

    setIsSubmitting(true);
    try {
      if (publicBoard) {
        // Update existing board
        const { error } = await supabase
          .from('public_boards')
          .update({
            magic_word: magicWord.trim(),
            slug: slug.trim(),
            is_active: isPublic,
            updated_at: new Date().toISOString(),
          })
          .eq('id', publicBoard.id);

        if (error) throw error;

        setPublicBoard(prev => prev ? {
          ...prev,
          magic_word: magicWord.trim(),
          slug: slug.trim(),
          is_active: isPublic,
        } : null);
      } else {
        // Create new board
        const { data, error } = await supabase
          .from('public_boards')
          .insert({
            user_id: user.id,
            magic_word: magicWord.trim(),
            slug: slug.trim(),
            is_active: isPublic,
          })
          .select()
          .single();

        if (error) throw error;
        setPublicBoard(data);
      }

      toast({
        title: t("common.success"),
        description: isPublic ? t("publicBoard.boardMadePublic") : t("publicBoard.boardMadePrivate"),
      });
    } catch (error) {
      console.error('Error saving public board settings:', error);
      toast({
        title: t("common.error"),
        description: t("publicBoard.errorSaving"),
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: t("common.success"),
      description: t("publicBoard.linkCopied"),
    });
  };

  const openInNewTab = (url: string) => {
    window.open(url, '_blank');
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      {!hideTrigger && (
        <DialogTrigger asChild>
          <Button 
            variant="outline" 
            className="flex items-center gap-2 bg-gradient-to-r from-primary/10 to-primary/5 hover:from-primary/20 hover:to-primary/10 border-primary/20 hover:border-primary/30 transition-all duration-300"
          >
            {isPublic ? <Globe className="h-4 w-4 text-green-500" /> : <Lock className="h-4 w-4 text-muted-foreground" />}
            <span className="font-medium">
              {isPublic ? t("publicBoard.public") : t("publicBoard.private")}
            </span>
          </Button>
        </DialogTrigger>
      )}
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            {t("publicBoard.boardSettings")}
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Public/Private Toggle */}
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label htmlFor="public-toggle" className="text-sm font-medium">
                  {t("publicBoard.makePublic")}
                </Label>
                <p className="text-xs text-muted-foreground">
                  {t("publicBoard.publicDescription")}
                </p>
              </div>
              <Switch
                id="public-toggle"
                checked={isPublic}
                onCheckedChange={setIsPublic}
              />
            </div>

            {/* Slug and Magic Word Inputs */}
            {isPublic && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="space-y-6"
              >
                <div className="grid gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="slug" className="text-sm font-medium">
                      {t("publicBoard.boardSlug")} *
                    </Label>
                    <div className="space-y-2">
                      <div className="text-sm text-muted-foreground">
                        {window.location.origin}/board/
                      </div>
                      <Input
                        id="slug"
                        type="text"
                        value={slug}
                        onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/--+/g, '-'))}
                        placeholder={t("publicBoard.enterSlug")}
                        className="w-full text-base px-3 py-2"
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {t("publicBoard.slugDescription")}
                    </p>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="magic-word" className="text-sm font-medium">
                      {t("publicBoard.magicWord")} *
                    </Label>
                    <Input
                      id="magic-word"
                      type="text"
                      value={magicWord}
                      onChange={(e) => setMagicWord(e.target.value)}
                      placeholder={t("publicBoard.enterMagicWord")}
                      className="w-full text-base px-3 py-2"
                    />
                    <div className="flex items-center gap-2 mt-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => copyToClipboard(magicWord)}
                        disabled={!magicWord.trim()}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                      <p className="text-xs text-muted-foreground flex-1">
                        {t("publicBoard.magicWordDescription")}
                      </p>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Public URL Display */}
            {isPublic && publicBoard && publicBoard.is_active && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                className="space-y-2"
              >
                <Label className="text-sm font-medium">
                  {t("publicBoard.publicLink")}
                </Label>
                <div className="flex items-center gap-2">
                  <Input
                    value={publicUrl}
                    readOnly
                    className="flex-1 bg-muted"
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => copyToClipboard(publicUrl)}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => openInNewTab(publicUrl)}
                  >
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                </div>
              </motion.div>
            )}

            {/* Sub Users Section */}
            {isPublic && publicBoard && publicBoard.is_active && (
              <SubUsersSection boardOwnerId={user?.id} />
            )}

            {/* Save Button */}
            <Button
              onClick={handleSaveSettings}
              disabled={isSubmitting || (isPublic && (!magicWord.trim() || !slug.trim()))}
              className="w-full bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70"
            >
              {isSubmitting ? (
                <div className="flex items-center gap-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current"></div>
                  {t("common.saving")}
                </div>
              ) : (
                t("common.save")
              )}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};