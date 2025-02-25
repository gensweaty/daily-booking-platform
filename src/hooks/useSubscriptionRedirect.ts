
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
        
        // Update the user's subscription status in the database
        const { error: updateError } = await supabase
          .from('profiles')
          .update({ 
            subscription_type: subscriptionType,
            subscription_status: 'active',
            subscription_start_date: new Date().toISOString(),
            subscription_end_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() // 30 days from now
          })
          .eq('id', user.id)

        if (updateError) {
          console.error('Error updating subscription:', updateError)
          throw updateError
        }

        console.log('Subscription activated successfully')
        toast({
          title: 'Success',
          description: 'Your subscription has been activated!'
        })

        // Remove subscription parameter from URL
        navigate('/dashboard', { replace: true })
      } catch (error) {
        console.error('Error handling subscription redirect:', error)
        toast({
          title: 'Error',
          description: 'An error occurred. Please try again.',
          variant: 'destructive'
        })
      }
    }

    handleSubscriptionRedirect()
  }, [searchParams, user, navigate, toast])
}
