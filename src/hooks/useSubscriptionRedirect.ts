
import { useEffect } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/components/ui/use-toast'

export const useSubscriptionRedirect = () => {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { toast } = useToast()

  useEffect(() => {
    const handleSubscriptionRedirect = async () => {
      const subscriptionType = searchParams.get('subscription')
      
      if (!subscriptionType || !user) return

      try {
        console.log('Processing subscription redirect:', { subscriptionType, userId: user.id })

        // First get the plan ID for the subscription type
        const { data: planData, error: planError } = await supabase
          .from('subscription_plans')
          .select('id')
          .eq('type', subscriptionType)
          .single()

        if (planError) {
          console.error('Error fetching plan:', planError)
          throw planError
        }

        // Create or update the subscription
        const { error: subscriptionError } = await supabase
          .from('subscriptions')
          .upsert({
            user_id: user.id,
            plan_id: planData.id,
            plan_type: subscriptionType,
            status: 'active',
            current_period_start: new Date().toISOString(),
            current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days from now
          })

        if (subscriptionError) {
          console.error('Error updating subscription:', subscriptionError)
          throw subscriptionError
        }

        console.log('Subscription activated successfully')
        toast({
          title: 'Success',
          description: 'Your subscription has been activated!'
        })

        // Remove subscription parameter from URL and refresh the page
        navigate('/dashboard', { replace: true })
      } catch (error) {
        console.error('Error handling subscription redirect:', error)
        toast({
          title: 'Error',
          description: 'An error occurred activating your subscription. Please try again.',
          variant: 'destructive'
        })
      }
    }

    handleSubscriptionRedirect()
  }, [searchParams, user, navigate, toast])
}
