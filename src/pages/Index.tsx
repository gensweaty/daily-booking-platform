import { useState, useEffect } from "react"
import { useAuth } from "@/contexts/AuthContext"
import { AuthUI } from "@/components/AuthUI"
import { DashboardHeader } from "@/components/DashboardHeader"
import { DashboardContent } from "@/components/dashboard/DashboardContent"
import { supabase } from "@/lib/supabase"
import { TrialExpiredDialog } from "@/components/TrialExpiredDialog"

const Index = () => {
  const [isTaskDialogOpen, setIsTaskDialogOpen] = useState(false)
  const [username, setUsername] = useState("")
  const [showTrialExpired, setShowTrialExpired] = useState(false)
  const { user } = useAuth()

  useEffect(() => {
    const checkSubscription = async () => {
      if (user) {
        try {
          const { data: subscription, error } = await supabase
            .from('subscriptions')
            .select('status, current_period_end')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          if (error) {
            console.error('Error fetching subscription:', error);
            return;
          }

          console.log('Subscription status:', subscription?.status);
          console.log('Current period end:', subscription?.current_period_end);

          // Show dialog if subscription is expired or doesn't exist
          setShowTrialExpired(!subscription || subscription.status === 'expired');
        } catch (error) {
          console.error('Subscription check error:', error);
        }
      }
    };

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
    checkSubscription()
  }, [user])

  if (!user) {
    return <AuthUI />
  }

  return (
    <div className="min-h-screen bg-background p-4">
      {showTrialExpired && <TrialExpiredDialog />}
      <DashboardHeader username={username} />
      <DashboardContent 
        isTaskDialogOpen={isTaskDialogOpen}
        setIsTaskDialogOpen={setIsTaskDialogOpen}
      />
    </div>
  )
}

export default Index