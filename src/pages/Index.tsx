
import { useState, useEffect, useCallback } from "react"
import { useAuth } from "@/contexts/AuthContext"
import { supabase } from "@/lib/supabase"
import { useToast } from "@/hooks/use-toast"
import { useSearchParams, useNavigate } from "react-router-dom"
import { AuthUI } from "@/components/AuthUI"
import { DashboardHeader } from "@/components/DashboardHeader"
import { TrialExpiredDialog } from "@/components/TrialExpiredDialog"
import { DashboardContent } from "@/components/dashboard/DashboardContent"
import { useSubscriptionRedirect } from "@/hooks/useSubscriptionRedirect"
import { motion } from "framer-motion"
import { CursorFollower } from "@/components/landing/CursorFollower"
import { verifyStripeSubscription } from "@/utils/stripeUtils"

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      duration: 0.5,
      staggerChildren: 0.1
    }
  }
}

const childVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.3 }
  }
}

const Index = () => {
  const [isTaskDialogOpen, setIsTaskDialogOpen] = useState(false)
  const [username, setUsername] = useState("")
  const [processingCode, setProcessingCode] = useState(false)
  const [processingStripe, setProcessingStripe] = useState(false)
  const [manuallyHideDialog, setManuallyHideDialog] = useState(false)
  const { user } = useAuth()
  const { toast } = useToast()
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  
  const { showTrialExpired, setForceRefresh, checkSubscriptionStatus } = useSubscriptionRedirect()

  // Track if payment verification is in progress to avoid showing dialog during verification
  const [paymentVerificationInProgress, setPaymentVerificationInProgress] = useState(false);

  // Function to handle successful subscription verification
  const handleVerificationSuccess = useCallback(() => {
    console.log("Verification success handler called");
    // Force an immediate check of the subscription status
    checkSubscriptionStatus();
    // Hide the dialog manually
    setManuallyHideDialog(true);
  }, [checkSubscriptionStatus]);

  // Handle stripe session ID directly
  useEffect(() => {
    const sessionId = searchParams.get('session_id');
    
    if (sessionId && !processingStripe && user) {
      console.log("Found session_id in URL, starting verification process");
      setPaymentVerificationInProgress(true);
      setProcessingStripe(true);
      
      const verifySession = async () => {
        try {
          console.log("Verifying Stripe session from Index page:", sessionId);
          const result = await verifyStripeSubscription(sessionId);
          
          if (result?.success) {
            console.log("Verification successful!", result);
            toast({
              title: "Success",
              description: "Your subscription has been activated!",
            });
            
            // Force immediate subscription status check
            await checkSubscriptionStatus();
            
            // Manually hide the dialog
            setManuallyHideDialog(true);
            
            // Remove session_id from URL to prevent repeated verification
            setSearchParams(prev => {
              const newParams = new URLSearchParams(prev.toString());
              newParams.delete('session_id');
              return newParams;
            }, { replace: true });
            
            // Force refresh subscription status one more time after a small delay
            setTimeout(() => {
              setForceRefresh(prev => !prev);
            }, 1000);
          } else {
            console.error("Subscription verification failed:", result);
            toast({
              title: "Error",
              description: "Failed to verify subscription. Please contact support.",
              variant: "destructive",
            });
          }
        } catch (error) {
          console.error('Error verifying Stripe session:', error);
          toast({
            title: "Error",
            description: "Failed to verify subscription. Please try again.",
            variant: "destructive",
          });
        } finally {
          setProcessingStripe(false);
          setPaymentVerificationInProgress(false);
        }
      };
      
      verifySession();
    }
  }, [searchParams, user, processingStripe, toast, navigate, setForceRefresh, checkSubscriptionStatus, setSearchParams]);

  // Handle email confirmation codes
  useEffect(() => {
    // Check for both code and token parameters (Supabase uses both in different contexts)
    const code = searchParams.get('code');
    const token = searchParams.get('token');
    
    if ((code || token) && !processingCode) {
      setProcessingCode(true);
      console.log('Index: Email confirmation detected, processing...', { code, token });
      
      (async () => {
        try {
          if (code) {
            console.log('Exchanging code for session...');
            const { data, error } = await supabase.auth.exchangeCodeForSession(code);
            
            if (error) {
              console.error('Error exchanging confirmation code:', error);
              toast({
                title: "Confirmation Error",
                description: "Could not confirm your email. Please contact support.",
                variant: "destructive",
              });
            } else {
              console.log('Email confirmation successful:', data.session ? 'Session created' : 'No session');
              if (data.session) {
                toast({
                  title: "Email Confirmed",
                  description: "Your email has been successfully confirmed!",
                });
                
                // Always navigate to dashboard after successful confirmation
                navigate('/dashboard', { replace: true });
              }
            }
          } else if (token) {
            // Handle token-based verification
            console.log('Verifying token...');
            const { data, error } = await supabase.auth.verifyOtp({
              token_hash: token,
              type: 'signup'
            });
            
            if (error) {
              console.error('Error verifying token:', error);
              toast({
                title: "Confirmation Error",
                description: "Could not confirm your email. Please contact support.",
                variant: "destructive",
              });
            } else {
              console.log('Email confirmation successful with token:', data);
              toast({
                title: "Email Confirmed",
                description: "Your email has been successfully confirmed!",
              });
              
              // Navigate to dashboard
              navigate('/dashboard', { replace: true });
            }
          }
        } catch (err) {
          console.error('Exception during verification in Index:', err);
          toast({
            title: "System Error",
            description: "An unexpected error occurred. Please try again later.",
            variant: "destructive",
          });
        } finally {
          setProcessingCode(false);
        }
      })();
    }
  }, [searchParams, navigate, toast, processingCode]);

  // Fetch user profile
  useEffect(() => {
    const getProfile = async () => {
      if (user) {
        try {
          const { data, error } = await supabase
            .from('profiles')
            .select('username')
            .eq('id', user.id)
            .maybeSingle()
          
          if (error) {
            console.error('Error fetching profile:', error)
            return
          }
          
          if (data) {
            setUsername(data.username)
          }
        } catch (error: any) {
          console.error('Profile fetch error:', error)
        }
      }
    }

    getProfile()
  }, [user])

  // Display loading state when processing
  if (processingCode || processingStripe) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary mx-auto mb-4"></div>
          <h2 className="text-xl font-semibold">
            {processingCode ? "Confirming your email..." : "Processing your subscription..."}
          </h2>
          <p className="text-muted-foreground">Please wait while we complete this process.</p>
        </div>
      </div>
    );
  }

  // Determine if trial expired dialog should be shown
  const shouldShowTrialExpiredDialog = user && showTrialExpired && !manuallyHideDialog && !paymentVerificationInProgress;

  return (
    <>
      {user ? (
        <motion.div 
          className="min-h-screen bg-background p-4"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          {shouldShowTrialExpiredDialog && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
            >
              <TrialExpiredDialog onVerificationSuccess={handleVerificationSuccess} />
            </motion.div>
          )}
          <motion.div variants={childVariants}>
            <DashboardHeader username={username} />
          </motion.div>
          <motion.div variants={childVariants}>
            <DashboardContent 
              isTaskDialogOpen={isTaskDialogOpen}
              setIsTaskDialogOpen={setIsTaskDialogOpen}
            />
          </motion.div>
        </motion.div>
      ) : (
        <>
          <CursorFollower />
          <AuthUI />
        </>
      )}
    </>
  );
}

export default Index;
