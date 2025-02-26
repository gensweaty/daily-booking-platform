
import { useState, useEffect } from "react"
import { useAuth } from "@/contexts/AuthContext"
import { supabase } from "@/lib/supabase"
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
  const { user } = useAuth()

  useSubscriptionRedirect()

  useEffect(() => {
    const checkSubscription = async () => {
      if (!user) return

      try {
        const { data: activeSubscription, error: subError } = await supabase
          .from('subscriptions')
          .select('status')
          .eq('user_id', user.id)
          .eq('status', 'active')
          .maybeSingle()

        if (subError) {
          console.error('Error checking subscription:', subError)
          return
        }

        setShowTrialExpired(!activeSubscription)

        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('username')
          .eq('id', user.id)
          .maybeSingle()

        if (profileError) {
          console.error('Error fetching profile:', profileError)
          return
        }

        if (profile?.username) {
          setUsername(profile.username)
        }
      } catch (error) {
        console.error('Error in subscription check:', error)
      }
    }

    checkSubscription()
  }, [user])

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
      {showTrialExpired && <TrialExpiredDialog open={true} />}
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
