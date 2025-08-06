import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useLanguage } from "@/contexts/LanguageContext";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/lib/supabase";
import { ThemeToggle } from "@/components/ThemeToggle";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { PublicTaskList } from "@/components/tasks/PublicTaskList";
import { motion } from "framer-motion";
import { Loader2, Globe } from "lucide-react";

interface PublicBoardData {
  id: string;
  user_id: string;
  magic_word: string;
  is_active: boolean;
  slug: string;
}

export const PublicBoard = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { toast } = useToast();
  
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [fullName, setFullName] = useState("");
  const [magicWord, setMagicWord] = useState("");
  const [boardData, setBoardData] = useState<PublicBoardData | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (slug) {
      checkBoardAccess();
    } else {
      navigate("/");
    }
  }, [slug, navigate]);

  useEffect(() => {
    // Check for existing access token
    const storedToken = localStorage.getItem(`public-board-access-${slug}`);
    if (storedToken && boardData) {
      verifyExistingAccess(storedToken);
    }
  }, [boardData, slug]);

  const checkBoardAccess = async () => {
    if (!slug) return;

    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('public_boards')
        .select('*')
        .eq('slug', slug)
        .eq('is_active', true)
        .single();

      if (error || !data) {
        toast({
          title: t("common.error"),
          description: t("publicBoard.invalidAccess"),
          variant: "destructive",
        });
        navigate("/");
        return;
      }

      setBoardData(data);
    } catch (error) {
      console.error('Error checking board access:', error);
      navigate("/");
    } finally {
      setIsLoading(false);
    }
  };

  const verifyExistingAccess = async (token: string) => {
    try {
      const { data, error } = await supabase
        .from('public_board_access')
        .select('*')
        .eq('access_token', token)
        .eq('board_id', boardData?.id)
        .single();

      if (!error && data) {
        setAccessToken(token);
        setIsAuthenticated(true);
        setFullName(data.external_user_name);
        
        // Update last accessed time
        await supabase
          .from('public_board_access')
          .update({ last_accessed_at: new Date().toISOString() })
          .eq('id', data.id);
      } else {
        localStorage.removeItem(`public-board-access-${slug}`);
      }
    } catch (error) {
      console.error('Error verifying access:', error);
      localStorage.removeItem(`public-board-access-${slug}`);
    }
  };

  const handleAuthentication = async () => {
    if (!fullName.trim() || !magicWord.trim() || !boardData) {
      toast({
        title: t("common.error"),
        description: !fullName.trim() ? t("publicBoard.enterFullName") : t("publicBoard.enterMagicWordForAccess"),
        variant: "destructive",
      });
      return;
    }

    // Check rate limiting (5 attempts per 15 minutes)
    const rateLimitKey = `public-board-attempts-${slug}`;
    const attempts = JSON.parse(localStorage.getItem(rateLimitKey) || '[]');
    const now = Date.now();
    const fifteenMinutesAgo = now - (15 * 60 * 1000);
    
    // Filter out attempts older than 15 minutes
    const recentAttempts = attempts.filter((attempt: number) => attempt > fifteenMinutesAgo);
    
    if (recentAttempts.length >= 5) {
      toast({
        title: t("common.error"),
        description: "Too many attempts. Please try again in 15 minutes.",
        variant: "destructive",
      });
      return;
    }

    // Validate magic word (case-sensitive exact match)
    if (magicWord.trim() !== boardData.magic_word) {
      // Record failed attempt
      recentAttempts.push(now);
      localStorage.setItem(rateLimitKey, JSON.stringify(recentAttempts));
      
      toast({
        title: t("common.error"),
        description: t("publicBoard.invalidAccess"),
        variant: "destructive",
      });
      return;
    }

    // Clear rate limiting on successful auth
    localStorage.removeItem(rateLimitKey);

    setIsSubmitting(true);
    try {
      // Generate access token
      const token = `${boardData.id}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      // Create access record
      const { error } = await supabase
        .from('public_board_access')
        .insert({
          board_id: boardData.id,
          access_token: token,
          external_user_name: fullName.trim(),
        });

      if (error) throw error;

      // Store token and authenticate
      localStorage.setItem(`public-board-access-${slug}`, token);
      setAccessToken(token);
      setIsAuthenticated(true);

      toast({
        title: t("common.success"),
        description: t("publicBoard.welcomeToBoard"),
      });
    } catch (error) {
      console.error('Error creating access:', error);
      toast({
        title: t("common.error"),
        description: t("publicBoard.invalidAccess"),
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background to-secondary/20 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">{t("common.loading")}...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background to-secondary/20">
        {/* Header */}
        <header className="bg-background/80 backdrop-blur-sm border-b border-border/40 sticky top-0 z-50">
          <div className="container mx-auto px-4 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-gradient-to-br from-primary to-primary/70 rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold text-sm">S</span>
                </div>
                <span className="font-bold text-xl text-foreground">SmartBookly</span>
              </div>
              <div className="flex items-center gap-2">
                <LanguageSwitcher />
                <ThemeToggle />
              </div>
            </div>
          </div>
        </header>

        {/* Authentication Form */}
        <div className="container mx-auto px-4 py-16 flex items-center justify-center min-h-[calc(100vh-80px)]">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="w-full max-w-md"
          >
            <Card className="shadow-xl border-border/50">
              <CardHeader className="space-y-1 text-center">
                <div className="flex items-center justify-center gap-2 mb-4">
                  <Globe className="h-8 w-8 text-primary" />
                </div>
                <CardTitle className="text-2xl font-bold">
                  {t("publicBoard.accessBoard")}
                </CardTitle>
                <p className="text-muted-foreground">
                  {t("publicBoard.enterMagicWordForAccess")}
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="fullName" className="text-sm font-medium">
                    {t("publicBoard.enterFullName")} *
                  </Label>
                  <Input
                    id="fullName"
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder={t("publicBoard.enterFullName")}
                    className="w-full"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="magicWord" className="text-sm font-medium">
                    {t("publicBoard.magicWord")} *
                  </Label>
                  <Input
                    id="magicWord"
                    type="password"
                    value={magicWord}
                    onChange={(e) => setMagicWord(e.target.value)}
                    placeholder={t("publicBoard.enterMagicWord")}
                    className="w-full"
                    onKeyPress={(e) => e.key === 'Enter' && handleAuthentication()}
                  />
                </div>

                <Button
                  onClick={handleAuthentication}
                  disabled={isSubmitting || !fullName.trim() || !magicWord.trim()}
                  className="w-full bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70"
                >
                  {isSubmitting ? (
                    <div className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      {t("common.loading")}
                    </div>
                  ) : (
                    t("publicBoard.accessBoard")
                  )}
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-secondary/20">
      {/* Header */}
      <header className="bg-background/80 backdrop-blur-sm border-b border-border/40 sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gradient-to-br from-primary to-primary/70 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">S</span>
              </div>
              <span className="font-bold text-xl text-foreground">SmartBookly</span>
              <span className="text-sm text-muted-foreground ml-2">- {t("publicBoard.public")}</span>
            </div>
            <div className="flex items-center gap-2">
              <LanguageSwitcher />
              <ThemeToggle />
            </div>
          </div>
        </div>
      </header>

      {/* Public Task List */}
      <div className="container mx-auto px-4 py-6">
        {boardData && (
          <PublicTaskList 
            boardUserId={boardData.user_id} 
            externalUserName={fullName}
          />
        )}
      </div>
    </div>
  );
};