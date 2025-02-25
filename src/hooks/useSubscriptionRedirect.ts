
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
        console.log('Processing subscription redirect:', subscriptionType)
        
        const response = await supabase.functions.invoke('handle-subscription-redirect', {
          body: { subscription: subscriptionType },
          headers: { 'x-user-id': user.id }
        })

        if (response.error) {
          console.error('Subscription activation error:', response.error)
          toast({
            title: 'Error',
            description: 'Failed to activate subscription. Please try again.',
            variant: 'destructive'
          })
          return
        }

        console.log('Subscription activated successfully')
        toast({
          title: 'Success',
          description: 'Your subscription has been activated!'
        })

        // Remove subscription parameter from URL
        navigate('/dashboard')
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
