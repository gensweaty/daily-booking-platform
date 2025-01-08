import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog"
import { PlusCircle, ListTodo, Calendar as CalendarIcon, BarChart } from "lucide-react"
import { Button } from "@/components/ui/button"
import { TaskList } from "@/components/TaskList"
import { Calendar } from "@/components/Calendar/Calendar"
import { AddTaskForm } from "@/components/AddTaskForm"
import { useState, useEffect } from "react"
import { useAuth } from "@/contexts/AuthContext"
import { supabase } from "@/lib/supabase"
import { useToast } from "@/components/ui/use-toast"
import { useSearchParams, useNavigate } from "react-router-dom"
import { AuthUI } from "@/components/AuthUI"
import { DashboardHeader } from "@/components/DashboardHeader"
import { Statistics } from "@/components/Statistics"
import { TrialExpiredDialog } from "@/components/TrialExpiredDialog"
import { DashboardContent } from "@/components/dashboard/DashboardContent"
import { useSubscriptionRedirect } from "@/hooks/useSubscriptionRedirect"

const Index = () => {
  const [isTaskDialogOpen, setIsTaskDialogOpen] = useState(false)
  const [username, setUsername] = useState("")
  const [showTrialExpired, setShowTrialExpired] = useState(false)
  const { user } = useAuth()
  const { toast } = useToast()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  
  // Handle subscription redirect
  useSubscriptionRedirect()

  useEffect(() => {
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