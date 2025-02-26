
import { useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/components/ui/use-toast'

export const useSubscriptionRedirect = () => {
  const [searchParams] = useSearchParams()
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

        // Get current subscription status
        const { data: currentSub } = await supabase
          .from('subscriptions')
          .select('status')
          .eq('user_id', user.id)
          .single()

        // Only update if not already active
        if (currentSub?.status !== 'active') {
          const currentDate = new Date()
          const endDate = new Date()
          endDate.setMonth(endDate.getMonth() + (subscriptionType === 'yearly' ? 12 : 1))

          // Create or update the subscription
          const { error: subscriptionError } = await supabase
            .from('subscriptions')
            .upsert({
              user_id: user.id,
              plan_id: planData.id,
              plan_type: subscriptionType,
              status: 'active',
              current_period_start: currentDate.toISOString(),
              current_period_end: endDate.toISOString(),
            })

          if (subscriptionError) {
            throw subscriptionError
          }

          toast({
            title: 'Success',
            description: 'Your subscription has been activated!'
          })

          // Force reload to update UI
          window.location.reload()
        }
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
  }, [searchParams, user, toast])
}
