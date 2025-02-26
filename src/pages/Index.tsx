
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
    const checkSubscription = async () => {
      if (!user) {
        setIsLoading(false)
        return
      }

      try {
        // Get profile data
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('username')
          .eq('id', user.id)
          .single()

        if (profileError) throw profileError
        if (profileData) {
          setUsername(profileData.username)
        }

        // Check subscription status
        const { data: subscription, error: subscriptionError } = await supabase
          .from('subscriptions')
          .select('status, plan_type')
          .eq('user_id', user.id)
          .eq('status', 'active')
          .maybeSingle()

        if (subscriptionError) throw subscriptionError

        // Only show dialog if there's no active subscription
        setShowTrialExpired(!subscription)
        
        console.log('Subscription check:', {
          hasActiveSubscription: !!subscription,
          subscription
        })

      } catch (error) {
        console.error('Error checking subscription status:', error)
        // Don't show the dialog if there's an error checking subscription
        setShowTrialExpired(false)
      } finally {
        setIsLoading(false)
      }
    }

    checkSubscription()
  }, [user])

  const content = user ? (
    <motion.div 
      className="min-h-screen bg-background p-4"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {!isLoading && (
        <TrialExpiredDialog 
          open={showTrialExpired} 
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
