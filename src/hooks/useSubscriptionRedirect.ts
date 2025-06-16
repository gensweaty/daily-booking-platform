
import { useEffect } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/components/ui/use-toast'
import { verifySession } from '@/utils/optimizedStripeUtils'

export const useSubscriptionRedirect = () => {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { toast } = useToast()

  useEffect(() => {
    const handleSubscriptionRedirect = async () => {
      const subscriptionType = searchParams.get('subscription')
      const sessionId = searchParams.get('session_id')
      
      if (sessionId && user) {
        try {
          console.log('[SUBSCRIPTION_REDIRECT] Verifying Stripe session:', sessionId)
          
          const response = await verifySession(sessionId)
          
          if (response && response.success) {
            console.log('[SUBSCRIPTION_REDIRECT] Stripe session verified successfully:', response)
            toast({
              title: 'Success',
              description: 'Your subscription has been activated!'
            })
            
            // Force a page reload to refresh subscription data
            setTimeout(() => {
              window.location.reload()
            }, 1500)
          }
        } catch (error) {
          console.error('[SUBSCRIPTION_REDIRECT] Error verifying Stripe session:', error)
          toast({
            title: 'Warning',
            description: 'Your payment was processed but subscription status may take a moment to update.',
            variant: 'destructive'
          })
        }
      }
      
      // Handle legacy subscription redirect (if needed)
      if (subscriptionType && user) {
        try {
          console.log('[SUBSCRIPTION_REDIRECT] Processing subscription redirect:', subscriptionType)
          
          const response = await supabase.functions.invoke('handle-subscription-redirect', {
            body: { subscription: subscriptionType },
            headers: { 'x-user-id': user.id }
          })

          if (response.error) {
            console.error('[SUBSCRIPTION_REDIRECT] Subscription activation error:', response.error)
            toast({
              title: 'Error',
              description: 'Failed to activate subscription. Please try again.',
              variant: 'destructive'
            })
            return
          }

          console.log('[SUBSCRIPTION_REDIRECT] Subscription activated successfully')
          toast({
            title: 'Success',
            description: 'Your subscription has been activated!'
          })

          // Remove subscription parameter from URL
          navigate('/dashboard')
        } catch (error) {
          console.error('[SUBSCRIPTION_REDIRECT] Error handling subscription redirect:', error)
          toast({
            title: 'Error',
            description: 'An error occurred. Please try again.',
            variant: 'destructive'
          })
        }
      }
    }

    handleSubscriptionRedirect()
  }, [searchParams, user, navigate, toast])
}
