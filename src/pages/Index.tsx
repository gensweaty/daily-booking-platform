
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
  const { user } = useAuth()
  const { toast } = useToast()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  
  useSubscriptionRedirect()

  useEffect(() => {
    // Immediately check if this is our target user
    if (user?.email === 'gensweaty@gmail.com') {
      console.log('Target user detected, showing subscription dialog');
      setShowTrialExpired(true);
    }

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

  const content = user ? (
    <motion.div 
      className="min-h-screen bg-background p-4"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {showTrialExpired && <TrialExpiredDialog />}
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
  );

  return (
    <LanguageProvider>
      {content}
    </LanguageProvider>
  );
}

export default Index;
