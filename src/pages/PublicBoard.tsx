import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Lock, User, CheckCircle } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import { ThemeToggle } from "@/components/ThemeToggle";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { PublicTaskList } from "@/components/tasks/PublicTaskList";
import { supabase } from "@/lib/supabase";
import { motion } from "framer-motion";

interface PublicBoardData {
  board_id: string;
  user_id: string;
  magic_word: string;
  is_active: boolean;
  external_user_name: string;
}

export const PublicBoard = () => {
  const { boardId } = useParams<{ boardId: string }>();
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { toast } = useToast();
  
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [magicWord, setMagicWord] = useState("");
  const [fullName, setFullName] = useState("");
  const [boardData, setBoardData] = useState<PublicBoardData | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (boardId) {
      checkBoardAccess();
    }
  }, [boardId]);

  // Check if user already has access
  useEffect(() => {
    const storedToken = localStorage.getItem(`publicBoard_${boardId}`);
    const storedUserName = localStorage.getItem(`publicBoardUser_${boardId}`);
    
    if (storedToken && storedUserName) {
      setAccessToken(storedToken);
      setFullName(storedUserName);
      verifyExistingAccess(storedToken);
    } else {
      setIsLoading(false);
    }
  }, [boardId]);

  const checkBoardAccess = async () => {
    if (!boardId) {
      navigate('/');
      return;
    }

    try {
      const { data, error } = await supabase
        .from('public_boards')
        .select('*')
        .eq('id', boardId)
        .eq('is_active', true)
        .single();

      if (error || !data) {
        toast({
          title: t("common.error"),
          description: t("publicBoard.boardNotFound"),
          variant: "destructive",
        });
        navigate('/');
        return;
      }
    } catch (error) {
      console.error('Error checking board access:', error);
      navigate('/');
    }
  };

  const verifyExistingAccess = async (token: string) => {
    try {
      const { data, error } = await supabase
        .rpc('get_public_board_by_token', { access_token_param: token });

      if (error || !data || data.length === 0) {
        // Invalid token, clear storage
        localStorage.removeItem(`publicBoard_${boardId}`);
        localStorage.removeItem(`publicBoardUser_${boardId}`);
        setIsLoading(false);
        return;
      }

      setBoardData(data[0]);
      setIsAuthenticated(true);
      setIsLoading(false);

      // Update last accessed time
      await supabase
        .from('public_board_access')
        .update({ last_accessed_at: new Date().toISOString() })
        .eq('access_token', token);
        
    } catch (error) {
      console.error('Error verifying access:', error);
      localStorage.removeItem(`publicBoard_${boardId}`);
      localStorage.removeItem(`publicBoardUser_${boardId}`);
      setIsLoading(false);
    }
  };

  const handleAuthentication = async () => {
    if (!magicWord.trim() || !fullName.trim()) {
      toast({
        title: t("common.error"),
        description: t("publicBoard.fillAllFields"),
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    
    try {
      // First verify the magic word
      const { data: boardData, error: boardError } = await supabase
        .from('public_boards')
        .select('*')
        .eq('id', boardId)
        .eq('magic_word', magicWord.trim())
        .eq('is_active', true)
        .single();

      if (boardError || !boardData) {
        toast({
          title: t("common.error"),
          description: t("publicBoard.invalidMagicWord"),
          variant: "destructive",
        });
        setIsSubmitting(false);
        return;
      }

      // Generate access token
      const newAccessToken = crypto.randomUUID();

      // Create access record
      const { error: accessError } = await supabase
        .from('public_board_access')
        .insert({
          board_id: boardId,
          external_user_name: fullName.trim(),
          access_token: newAccessToken,
        });

      if (accessError) {
        console.error('Error creating access record:', accessError);
        toast({
          title: t("common.error"),
          description: t("publicBoard.errorCreatingAccess"),
          variant: "destructive",
        });
        setIsSubmitting(false);
        return;
      }

      // Store access in localStorage
      localStorage.setItem(`publicBoard_${boardId}`, newAccessToken);
      localStorage.setItem(`publicBoardUser_${boardId}`, fullName.trim());

      // Set state
      setAccessToken(newAccessToken);
      setBoardData({
        board_id: boardData.id,
        user_id: boardData.user_id,
        magic_word: boardData.magic_word,
        is_active: boardData.is_active,
        external_user_name: fullName.trim(),
      });
      setIsAuthenticated(true);

      toast({
        title: t("common.success"),
        description: t("publicBoard.accessGranted"),
      });

    } catch (error) {
      console.error('Error during authentication:', error);
      toast({
        title: t("common.error"),
        description: t("common.unexpectedError"),
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">{t("common.loading")}</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-background">
        {/* Header */}
        <header className="border-b border-border p-4">
          <div className="container mx-auto flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Lock className="h-6 w-6" />
              <h1 className="text-xl font-bold">{t("publicBoard.taskBoard")}</h1>
            </div>
            <div className="flex items-center gap-2">
              <LanguageSwitcher />
              <ThemeToggle />
            </div>
          </div>
        </header>

        {/* Authentication Form */}
        <div className="container mx-auto px-4 py-8 flex items-center justify-center min-h-[calc(100vh-80px)]">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            <Card className="w-full max-w-md">
              <CardHeader className="text-center">
                <CardTitle className="flex items-center justify-center gap-2 text-2xl">
                  <User className="h-6 w-6" />
                  {t("publicBoard.accessBoard")}
                </CardTitle>
                <p className="text-muted-foreground">
                  {t("publicBoard.enterCredentials")}
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="fullName">{t("publicBoard.fullName")} *</Label>
                  <Input
                    id="fullName"
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder={t("publicBoard.enterFullName")}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="magicWord">{t("publicBoard.magicWord")} *</Label>
                  <Input
                    id="magicWord"
                    type="password"
                    value={magicWord}
                    onChange={(e) => setMagicWord(e.target.value)}
                    placeholder={t("publicBoard.enterMagicWord")}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        handleAuthentication();
                      }
                    }}
                  />
                </div>

                <Button
                  onClick={handleAuthentication}
                  disabled={isSubmitting || !magicWord.trim() || !fullName.trim()}
                  className="w-full"
                >
                  {isSubmitting ? (
                    <div className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      {t("common.loading")}
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4" />
                      {t("publicBoard.enterBoard")}
                    </div>
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
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border p-4">
        <div className="container mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle className="h-6 w-6 text-green-500" />
            <h1 className="text-xl font-bold">{t("publicBoard.taskBoard")}</h1>
            <span className="text-sm text-muted-foreground">
              - {boardData?.external_user_name}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <LanguageSwitcher />
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="container mx-auto p-4">
        {boardData && (
          <PublicTaskList 
            boardUserId={boardData.user_id} 
            externalUserName={boardData.external_user_name}
          />
        )}
      </div>
    </div>
  );
};