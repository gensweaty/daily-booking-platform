
import { useState, useEffect, useCallback } from "react"
import { useAuth } from "@/contexts/AuthContext"
import { supabase } from "@/lib/supabase"
import { useToast } from "@/hooks/use-toast"
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
  const [isLoading, setIsLoading] = useState(true)
  const { user } = useAuth()
  const { toast } = useToast()

  useSubscriptionRedirect()

  const checkSubscription = useCallback(async () => {
    if (!user) {
      setIsLoading(false)
      setShowTrialExpired(false)
      return
    }

    try {
      console.log('Checking subscription for user:', user.id)
      
      // First check for any active subscription
      const { data: subscriptionData, error: subError } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      console.log('Latest subscription data:', subscriptionData)

      if (subError) {
        console.error('Subscription check error:', subError)
        toast({
          title: "Error",
          description: "Failed to check subscription status",
          variant: "destructive"
        })
        return
      }

      // Check if subscription is active and not expired
      const isActive = subscriptionData && 
                      subscriptionData.status === 'active' &&
                      (!subscriptionData.current_period_end || 
                       new Date(subscriptionData.current_period_end) > new Date())

      console.log('Subscription active status:', isActive)
      setShowTrialExpired(!isActive)

      // Only fetch username if needed
      if (!username && user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('username')
          .eq('id', user.id)
          .single()

        if (profile?.username) {
          setUsername(profile.username)
        }
      }
    } catch (error) {
      console.error('Error in subscription check:', error)
    } finally {
      setIsLoading(false)
    }
  }, [user, username, toast])

  // Check subscription on mount and when user changes
  useEffect(() => {
    checkSubscription()
  }, [checkSubscription])

  // Check subscription every minute
  useEffect(() => {
    const interval = setInterval(() => {
      checkSubscription()
    }, 60000)

    return () => clearInterval(interval)
  }, [checkSubscription])

  if (!user) {
    return (
      <>
        <CursorFollower />
        <AuthUI />
      </>
    )
  }

  return (
    <motion.div 
      className="min-h-screen bg-background p-4"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {!isLoading && showTrialExpired && (
        <TrialExpiredDialog open={true} />
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
  )
}

export default Index
