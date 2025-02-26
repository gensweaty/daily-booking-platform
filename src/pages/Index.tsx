
import { useState, useEffect } from "react"
import { useAuth } from "@/contexts/AuthContext"
import { supabase } from "@/lib/supabase"
import { useToast } from "@/components/ui/use-toast"
import { AuthUI } from "@/components/AuthUI"
import { DashboardHeader } from "@/components/DashboardHeader"
import { TrialExpiredDialog } from "@/components/TrialExpiredDialog"
import { DashboardContent } from "@/components/dashboard/DashboardContent"
import { useSubscriptionRedirect } from "@/hooks/useSubscriptionRedirect"
import { motion } from "framer-motion"
import { CursorFollower } from "@/components/landing/CursorFollower"
import { LanguageProvider } from "@/contexts/LanguageContext"

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
  const [isLoading, setIsLoading] = useState(true)
  const { user } = useAuth()

  useSubscriptionRedirect()

  useEffect(() => {
    let isMounted = true;

    const checkSubscription = async () => {
      if (!user) {
        if (isMounted) {
          setIsLoading(false);
          setShowTrialExpired(false);
        }
        return;
      }

      try {
        const { data: profileData } = await supabase
          .from('profiles')
          .select('username')
          .eq('id', user.id)
          .maybeSingle()

        if (isMounted && profileData?.username) {
          setUsername(profileData.username);
        }

        const { data: subscription } = await supabase
          .from('subscriptions')
          .select('status, plan_type')
          .eq('user_id', user.id)
          .eq('status', 'active')
          .maybeSingle()

        if (isMounted) {
          setShowTrialExpired(!subscription);
          console.log('Subscription status:', { hasActiveSubscription: !!subscription });
        }
      } catch (error) {
        console.error('Error checking subscription:', error);
        if (isMounted) {
          setShowTrialExpired(false);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    checkSubscription();

    return () => {
      isMounted = false;
    }
  }, [user])

  const content = user ? (
    <motion.div 
      className="min-h-screen bg-background p-4"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {!isLoading && showTrialExpired && (
        <TrialExpiredDialog 
          open={true}
          onOpenChange={setShowTrialExpired}
        />
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
  )

  return (
    <LanguageProvider>
      {content}
    </LanguageProvider>
  )
}

export default Index

