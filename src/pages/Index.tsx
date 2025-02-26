
import { useState, useEffect, useCallback } from "react"
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

  const checkSubscription = useCallback(async () => {
    if (!user) {
      setIsLoading(false)
      setShowTrialExpired(false)
      return
    }

    try {
      const { data: activeSubscription } = await supabase
        .from('subscriptions')
        .select('status')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .maybeSingle()

      console.log('Subscription check result:', { activeSubscription })

      setShowTrialExpired(!activeSubscription)

      // Only fetch username if we need it
      if (!username) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('username')
          .eq('id', user.id)
          .maybeSingle()

        if (profile?.username) {
          setUsername(profile.username)
        }
      }
    } catch (error) {
      console.error('Error checking subscription:', error)
      setShowTrialExpired(false)
    } finally {
      setIsLoading(false)
    }
  }, [user, username])

  useEffect(() => {
    checkSubscription()
  }, [checkSubscription])

  const content = user ? (
    <motion.div 
      className="min-h-screen bg-background p-4"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {!isLoading && showTrialExpired ? (
        <TrialExpiredDialog 
          key="subscription-dialog"
          open={true}
        />
      ) : null}
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
