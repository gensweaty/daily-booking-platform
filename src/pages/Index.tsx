
import { useState, useEffect } from "react"
import { useAuth } from "@/contexts/AuthContext"
import { supabase } from "@/lib/supabase"
import { useToast } from "@/components/ui/use-toast"
import { useSearchParams, useNavigate } from "react-router-dom"
import { AuthUI } from "@/components/AuthUI"
import { DashboardHeader } from "@/components/DashboardHeader"
import { TrialExpiredDialog } from "@/components/TrialExpiredDialog"
import { DashboardContent } from "@/components/dashboard/DashboardContent"
import { useSubscriptionRedirect } from "@/hooks/useSubscriptionRedirect"
import { motion } from "framer-motion"
import { CursorFollower } from "@/components/landing/CursorFollower"

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
  const [showTrialExpired, setShowTrialExpired] = useState(false)
  const [processingCode, setProcessingCode] = useState(false)
  const { user } = useAuth()
  const { toast } = useToast()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  
  useSubscriptionRedirect()

  useEffect(() => {
    const code = searchParams.get('code');
    
    if (code && !processingCode) {
      setProcessingCode(true);
      console.log('Index: Email confirmation code detected, processing...');
      
      (async () => {
        try {
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
        } catch (err) {
          console.error('Exception during code exchange in Index:', err);
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

  if (processingCode) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary mx-auto mb-4"></div>
          <h2 className="text-xl font-semibold">Confirming your email...</h2>
          <p className="text-muted-foreground">Please wait while we complete this process.</p>
        </div>
      </div>
    );
  }

  return (
    <>
      {user ? (
        <motion.div 
          className="min-h-screen bg-background p-4"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          {showTrialExpired && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
            >
              <TrialExpiredDialog />
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
