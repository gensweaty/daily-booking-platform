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
import { Loader2, Globe, LogOut } from "lucide-react";
import { useBoardPresence } from "@/hooks/useBoardPresence";
import { validatePassword } from "@/utils/signupValidation";
import { useTheme } from "next-themes";

// Password hashing utilities (PBKDF2, client-side)
const bufToBase64 = (buffer: ArrayBuffer) => btoa(String.fromCharCode(...new Uint8Array(buffer)));
const base64ToBuf = (b64: string) => {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
};
const deriveBits = async (password: string, salt: Uint8Array) => {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey("raw", enc.encode(password), { name: "PBKDF2" }, false, ["deriveBits"]);
  return crypto.subtle.deriveBits({ name: "PBKDF2", salt, iterations: 100000, hash: "SHA-256" }, keyMaterial, 256);
};
const createPasswordHash = async (password: string) => {
  const salt = new Uint8Array(16);
  crypto.getRandomValues(salt);
  const bits = await deriveBits(password, salt);
  return { hash: bufToBase64(bits), salt: bufToBase64(salt.buffer) };
};
const verifyPasswordHash = async (password: string, saltB64: string, hashB64: string) => {
  const salt = new Uint8Array(base64ToBuf(saltB64));
  const bits = await deriveBits(password, salt);
  return bufToBase64(bits) === hashB64;
};

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
  const { theme } = useTheme();
  
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [magicWord, setMagicWord] = useState("");
  const [boardData, setBoardData] = useState<PublicBoardData | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const { onlineUsers } = useBoardPresence(
    boardData?.id,
    isAuthenticated ? { name: fullName, email } : null,
    { updateSubUserLastLogin: true, boardOwnerId: boardData?.user_id || null }
  );

  useEffect(() => {
    if (slug) {
      checkBoardAccess();
    } else {
      navigate("/");
    }
  }, [slug]);

  useEffect(() => {
    // Check for existing access token with 3-hour expiration
    const storedData = localStorage.getItem(`public-board-access-${slug}`);
    if (storedData && boardData) {
      try {
        const parsedData = JSON.parse(storedData);
        const { token, timestamp, fullName: storedFullName, email: storedEmail } = parsedData;
        const threeHoursInMs = 3 * 60 * 60 * 1000; // 3 hours
        const isExpired = Date.now() - timestamp > threeHoursInMs;
        
        if (!isExpired) {
          // If we have stored fullName and email, use them immediately
          if (storedFullName && storedEmail) {
            setFullName(storedFullName);
            setEmail(storedEmail);
          }
          verifyExistingAccess(token, storedEmail, storedFullName);
        } else {
          // Clear expired token
          localStorage.removeItem(`public-board-access-${slug}`);
        }
      } catch (error) {
        // Clear invalid stored data
        localStorage.removeItem(`public-board-access-${slug}`);
      }
    }
  }, [boardData, slug]);

  // Ensure we never show email in greeting; resolve to sub user fullname if needed
  useEffect(() => {
    const resolveName = async () => {
      if (!boardData || !isAuthenticated) return;
      if (fullName && fullName.includes("@")) {
        const { data: rpcData, error: rpcError } = await supabase.rpc('get_sub_user_auth', {
          p_owner_id: boardData.user_id,
          p_email: (email || '').trim().toLowerCase(),
        });
        if (!rpcError && rpcData && rpcData.length > 0 && rpcData[0].fullname) {
          setFullName(rpcData[0].fullname);
        }
      }
    };
    resolveName();
  }, [fullName, email, isAuthenticated, boardData?.user_id]);

  // Track tab visibility to maintain session
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && isAuthenticated && accessToken) {
        // Tab became visible again, update session timestamp
        const storedData = localStorage.getItem(`public-board-access-${slug}`);
        if (storedData) {
          try {
            const parsedData = JSON.parse(storedData);
            const { token, fullName: storedFullName, email: storedEmail } = parsedData;
            localStorage.setItem(`public-board-access-${slug}`, JSON.stringify({
              token,
              timestamp: Date.now(),
              fullName: storedFullName,
              email: storedEmail
            }));
          } catch (error) {
            console.error('Error updating session timestamp:', error);
          }
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [isAuthenticated, accessToken, slug]);

  const checkBoardAccess = async () => {
    if (!slug) return;

    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('public_boards')
        .select('*')
        .eq('slug', slug)
        .eq('is_active', true)
        .maybeSingle();

      if (error) {
        console.error('Database error checking board access:', error);
        toast({
          title: t("common.error"),
          description: "Error accessing board. Please try again.",
          variant: "destructive",
        });
        navigate("/");
        return;
      }

      if (!data) {
        console.error('Board not found or not active for slug:', slug);
        toast({
          title: t("common.error"),
          description: "Board not found or not accessible",
          variant: "destructive",
        });
        navigate("/");
        return;
      }

      console.log('Board found:', data);
      setBoardData(data);
    } catch (error) {
      console.error('Error checking board access:', error);
      toast({
        title: t("common.error"), 
        description: "Error accessing board. Please try again.",
        variant: "destructive",
      });
      navigate("/");
    } finally {
      setIsLoading(false);
    }
  };

  const verifyExistingAccess = async (token: string, storedEmail?: string, storedFullName?: string) => {
    try {
      // Use SECURITY DEFINER RPC to validate token without requiring SELECT privileges
      const { data: tokenData, error: tokenError } = await supabase.rpc('get_public_board_by_token', {
        access_token_param: token,
      });

      const tokenInfo = (tokenData && tokenData[0]) || null;

      if (!tokenError && tokenInfo && tokenInfo.is_active && tokenInfo.board_id === boardData?.id) {
        // Prefer stored email and name from local storage
        const normalizedEmail = (storedEmail || '').trim().toLowerCase();
        let displayName = storedFullName || tokenInfo.external_user_name || normalizedEmail;

        if (normalizedEmail) {
          // Verify sub user still exists using SECURITY DEFINER RPC (bypasses RLS)
          const { data: subData, error: subErr } = await supabase.rpc('get_sub_user_auth', {
            p_owner_id: tokenInfo.user_id,
            p_email: normalizedEmail,
          });
          const subUser = (subData && subData[0]) || null;
          if (!subUser || subErr) {
            // Token is invalid because sub user was removed – clear and force re-auth
            localStorage.removeItem(`public-board-access-${slug}`);
            setIsAuthenticated(false);
            setAccessToken(null);
            setFullName("");
            setEmail("");
            setMagicWord("");
            return;
          }

          // Sync display name and last login
          if (subUser.fullname) displayName = subUser.fullname;
          const currentTime = new Date().toISOString();
          const { error: updateLoginError } = await supabase
            .from('sub_users')
            .update({ last_login_at: currentTime, updated_at: currentTime })
            .eq('id', subUser.id);
          if (updateLoginError) {
            console.error('Error updating login time during token validation:', updateLoginError);
          } else {
            await new Promise(resolve => setTimeout(resolve, 200));
          }

          // Ensure access record has the latest display name and timestamp (UPDATE allowed publicly)
          await supabase
            .from('public_board_access')
            .update({ external_user_name: displayName, last_accessed_at: new Date().toISOString() })
            .eq('board_id', tokenInfo.board_id)
            .eq('access_token', token);
        }

        // Apply session state with normalized email and synced name
        setAccessToken(token);
        setIsAuthenticated(true);
        setFullName(displayName);
        setEmail(normalizedEmail);

        // Persist refreshed info
        localStorage.setItem(`public-board-access-${slug}`, JSON.stringify({
          token,
          timestamp: Date.now(),
          fullName: displayName,
          email: normalizedEmail,
        }));
      } else {
        // Invalid or expired token - clear storage and show auth form
        localStorage.removeItem(`public-board-access-${slug}`);
        setIsAuthenticated(false);
        setAccessToken(null);
        setFullName("");
        setEmail("");
        setMagicWord("");
      }
    } catch (error) {
      console.error('Error verifying access:', error);
      // Clear storage and show auth form on any error
      localStorage.removeItem(`public-board-access-${slug}`);
      setIsAuthenticated(false);
      setAccessToken(null);
      setFullName("");
      setEmail("");
      setMagicWord("");
    }
  };

const handleLogin = async () => {
    if (!email.trim() || !password.trim() || !boardData) {
      let description = "";
      if (!email.trim()) description = t("publicBoard.emailAddress");
      else description = "Please enter your password";
      toast({
        title: t("common.error"),
        description,
        variant: "destructive",
      });
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      toast({
        title: t("common.error"),
        description: t("publicBoard.emailAddress"),
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const normalizedEmail = email.trim().toLowerCase();

      // Find sub user for this board
      const { data: authData, error: findError } = await supabase.rpc('get_sub_user_auth', {
        p_owner_id: boardData.user_id,
        p_email: normalizedEmail,
      });
      const subUser = authData && authData[0];

      if (findError || !subUser) {
        toast({ title: t('common.error'), description: 'This account is not registered for this board.', variant: 'destructive' });
        setIsSubmitting(false);
        return;
      }

      // Verify password against stored hash
      if (!subUser.password_hash || !subUser.password_salt) {
        toast({ title: t('common.error'), description: 'Password not set. Please register again.', variant: 'destructive' });
        setIsSubmitting(false);
        return;
      }
      const isValid = await verifyPasswordHash(password, subUser.password_salt, subUser.password_hash);
      if (!isValid) {
        toast({ title: t('common.error'), description: 'Invalid email or password', variant: 'destructive' });
        setIsSubmitting(false);
        return;
      }

      // Update last login for sub user
      const currentTime = new Date().toISOString();
      await supabase
        .from('sub_users')
        .update({ last_login_at: currentTime, updated_at: currentTime })
        .eq('id', subUser.id);

      const actualFullName = subUser.fullname || email.trim();

      // Generate access token for public board session
      const token = `${boardData.id}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      const { error } = await supabase
        .from('public_board_access')
        .insert({
          board_id: boardData.id,
          access_token: token,
          external_user_name: actualFullName,
          external_user_email: normalizedEmail,
        });
      if (error) throw error;

      // Persist session locally for the public board
      localStorage.setItem(`public-board-access-${slug}`, JSON.stringify({
        token,
        timestamp: Date.now(),
        fullName: actualFullName,
        email: normalizedEmail,
      }));

      setAccessToken(token);
      setIsAuthenticated(true);
      setFullName(actualFullName);
      setEmail(normalizedEmail);

      toast({ title: t('common.success'), description: t('publicBoard.welcomeToBoard') });
    } catch (error: any) {
      console.error('Error logging in:', error);
      toast({ title: t('common.error'), description: error?.message || 'Invalid email or password', variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

const handleRegister = async () => {
    if (!fullName.trim() || !email.trim() || !magicWord.trim() || !boardData) {
      let description = "";
      if (!fullName.trim()) description = t("publicBoard.enterFullName");
      else if (!email.trim()) description = "Please enter your email address";
      else description = t("publicBoard.enterMagicWordForAccess");
      
      toast({
        title: t("common.error"),
        description,
        variant: "destructive",
      });
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      toast({
        title: t("common.error"),
        description: "Please enter a valid email address",
        variant: "destructive",
      });
      return;
    }

    // Validate magic word (case-sensitive exact match)
    if (magicWord.trim() !== boardData.magic_word) {
      toast({
        title: t("common.error"),
        description: t("publicBoard.invalidAccess"),
        variant: "destructive",
      });
      return;
    }

    // Validate password
    if (!password.trim() || !confirmPassword.trim()) {
      toast({ title: t("common.error"), description: "Please enter and confirm your password", variant: "destructive" });
      return;
    }
    if (password !== confirmPassword) {
      toast({ title: t("common.error"), description: "Passwords do not match", variant: "destructive" });
      return;
    }
    const pwdError = validatePassword(password);
    if (pwdError) {
      toast({ title: t("common.error"), description: pwdError, variant: "destructive" });
      return;
    }

    setIsSubmitting(true);
    try {
      const normalizedEmail = email.trim().toLowerCase();

      // Hash password client-side (PBKDF2)
      const { hash, salt } = await createPasswordHash(password);

      // Respect max sub users limit
      const { data: existingSubUsers, error: countError } = await supabase
        .from('sub_users')
        .select('id')
        .eq('board_owner_id', boardData.user_id);
      if (countError) throw countError;
      if (existingSubUsers && existingSubUsers.length >= 10) {
        toast({ title: t('common.error'), description: 'Maximum number of sub users (10) reached for this board', variant: 'destructive' });
        return;
      }

      // Upsert-like behavior: update name if email exists, otherwise insert
      const { data: existing, error: findExistingError } = await supabase
        .from('sub_users')
        .select('id')
        .eq('board_owner_id', boardData.user_id)
        .ilike('email', normalizedEmail)
        .maybeSingle();
      if (findExistingError) throw findExistingError;

      const now = new Date().toISOString();
      if (existing) {
        await supabase
          .from('sub_users')
          .update({ fullname: fullName.trim(), password_hash: hash, password_salt: salt, last_login_at: now, updated_at: now })
          .eq('id', existing.id);
      } else {
        await supabase
          .from('sub_users')
          .insert({
            board_owner_id: boardData.user_id,
            fullname: fullName.trim(),
            email: normalizedEmail,
            password_hash: hash,
            password_salt: salt,
            last_login_at: now,
          });
      }

      // Create access token for immediate board access
      const token = `${boardData.id}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const { error } = await supabase
        .from('public_board_access')
        .insert({
          board_id: boardData.id,
          access_token: token,
          external_user_name: fullName.trim(),
          external_user_email: normalizedEmail,
        });
      if (error) throw error;

      localStorage.setItem(`public-board-access-${slug}`, JSON.stringify({
        token,
        timestamp: Date.now(),
        fullName: fullName.trim(),
        email: normalizedEmail,
      }));
      setAccessToken(token);
      setIsAuthenticated(true);
      setEmail(normalizedEmail);

      // Clear sensitive fields
      setPassword("");
      setConfirmPassword("");

      toast({ title: t("common.success"), description: "Successfully registered and logged in to the board!" });
    } catch (error: any) {
      console.error('Error registering:', error);
      toast({ title: t("common.error"), description: error?.message || "Failed to register. Please try again.", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLogout = () => {
    try {
      if (slug) localStorage.removeItem(`public-board-access-${slug}`);
      setIsAuthenticated(false);
      setAccessToken(null);
      setFullName("");
      setEmail("");
      setMagicWord("");
      toast({ title: t("common.success"), description: "You have been logged out." });
    } catch (e) {
      console.error('Logout error:', e);
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
                <img 
                  src={theme === 'dark' 
                    ? "/lovable-uploads/cfb84d8d-bdf9-4515-9179-f707416ece03.png"
                    : "/lovable-uploads/d1ee79b8-2af0-490e-969d-9101627c9e52.png"
                  }
                  alt="SmartBookly Logo" 
                  className="h-8 w-auto"
                />
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
                  {isRegisterMode ? t("publicBoard.registerForBoard") : t("publicBoard.accessBoard")}
                </CardTitle>
                <p className="text-muted-foreground">
                  {isRegisterMode 
                    ? t("publicBoard.createAccountToAccess")
                    : "Enter your email and password to access the board"
                  }
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                {isRegisterMode && (
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
                )}
                
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-sm font-medium">
                    {t("publicBoard.emailAddress")} *
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={t("publicBoard.emailAddress")}
                    className="w-full"
                  />
                </div>
                
                {isRegisterMode && (
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
                      onKeyPress={(e) => e.key === 'Enter' && handleRegister()}
                    />
                  </div>
                )}

                {/* Password fields */}
                <div className="space-y-2">
                  <Label htmlFor="password" className="text-sm font-medium">
                    {t("publicBoard.password")} *
                  </Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={t("publicBoard.enterPassword")}
                    className="w-full"
                    onKeyPress={(e) => e.key === 'Enter' && (isRegisterMode ? handleRegister() : handleLogin())}
                  />
                </div>

                {isRegisterMode && (
                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword" className="text-sm font-medium">
                    {t("publicBoard.confirmPassword")} *
                  </Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder={t("publicBoard.repeatPassword")}
                    className="w-full"
                    onKeyPress={(e) => e.key === 'Enter' && handleRegister()}
                  />
                  </div>
                )}

                <div className="space-y-3">
                  <Button
                    onClick={isRegisterMode ? handleRegister : handleLogin}
                    disabled={
                      isSubmitting ||
                      (isRegisterMode
                        ? (!fullName.trim() || !email.trim() || !magicWord.trim() || !password.trim() || !confirmPassword.trim() || password !== confirmPassword)
                        : (!email.trim() || !password.trim())
                      )
                    }
                    className="w-full bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70"
                  >
                    {isSubmitting ? (
                      <div className="flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        {t("common.loading")}
                      </div>
                    ) : (
                      isRegisterMode ? t("publicBoard.register") : t("publicBoard.login")
                    )}
                  </Button>

                  <div className="text-center">
                    <Button
                      variant="ghost"
                      onClick={() => setIsRegisterMode(!isRegisterMode)}
                      className="text-sm text-muted-foreground hover:text-foreground"
                    >
                      {isRegisterMode 
                        ? t("publicBoard.alreadyHaveAccess")
                        : t("publicBoard.needToRegister")
                      }
                    </Button>
                  </div>
                </div>
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
              <img 
                src={theme === 'dark' 
                  ? "/lovable-uploads/cfb84d8d-bdf9-4515-9179-f707416ece03.png"
                  : "/lovable-uploads/d1ee79b8-2af0-490e-969d-9101627c9e52.png"
                }
                alt="SmartBookly Logo" 
                className="h-8 w-auto"
              />
            </div>
            <div className="flex items-center gap-3">
              <span className="hidden sm:inline text-sm text-muted-foreground">
                Hello, <span className="font-semibold">{fullName}</span>
              </span>
              <LanguageSwitcher />
              <Button variant="ghost" size="icon" onClick={handleLogout} title="Log out" aria-label="Log out">
                <LogOut className="h-4 w-4" />
              </Button>
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
            externalUserEmail={email}
            onlineUsers={onlineUsers}
          />
        )}
      </div>
    </div>
  );
};