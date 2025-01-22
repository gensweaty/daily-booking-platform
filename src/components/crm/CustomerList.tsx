import { useState, useEffect } from "react"
import { useAuth } from "@/contexts/AuthContext"
import { supabase } from "@/lib/supabase"
import { useToast } from "@/components/ui/use-toast"
import { CustomerDialog } from "./CustomerDialog"
import { SearchCommand } from "./SearchCommand"
import { Button } from "@/components/ui/button"
import { PlusCircle, Loader2 } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"

export const CustomerList = () => {
  const [customers, setCustomers] = useState<any[]>([])
  const [filteredCustomers, setFilteredCustomers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null)
  const { user } = useAuth()
  const { toast } = useToast()

  useEffect(() => {
    if (user) {
      fetchCustomers()
    }
  }, [user])

  const fetchCustomers = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from("customers")
        .select("*")
        .eq("user_id", user?.id)
        .order("created_at", { ascending: false })

      if (error) {
        console.error("Error fetching customers:", error)
        toast({
          title: "Error fetching customers",
          description: error.message,
          variant: "destructive",
        })
        return
      }

      setCustomers(data || [])
      setFilteredCustomers(data || [])
    } catch (error: any) {
      console.error("Customer fetch error:", error)
      toast({
        title: "Error",
        description: "Failed to fetch customers",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleCustomerSelect = async (customerId: string) => {
    try {
      const { data, error } = await supabase
        .from("customers")
        .select("*")
        .eq("id", customerId)
        .eq("user_id", user?.id)
        .maybeSingle()

      if (error) {
        console.error("Error fetching customer:", error)
        toast({
          title: "Error fetching customer details",
          description: error.message,
          variant: "destructive",
        })
        return
      }

      setSelectedCustomer(data)
      setIsDialogOpen(true)
    } catch (error: any) {
      console.error("Customer selection error:", error)
      toast({
        title: "Error",
        description: "Failed to load customer details",
        variant: "destructive",
      })
    }
  }

  const handleCustomerUpdate = async (updatedCustomer: any) => {
    return new Promise<void>((resolve) => {
      setCustomers(prevCustomers =>
        prevCustomers.map(customer =>
          customer.id === updatedCustomer.id ? updatedCustomer : customer
        )
      )
      setFilteredCustomers(prevCustomers =>
        prevCustomers.map(customer =>
          customer.id === updatedCustomer.id ? updatedCustomer : customer
        )
      )
      resolve()
    })
  }

  const handleCustomerDelete = () => {
    if (selectedCustomer?.id) {
      setCustomers(prevCustomers =>
        prevCustomers.filter(customer => customer.id !== selectedCustomer.id)
      )
      setFilteredCustomers(prevCustomers =>
        prevCustomers.filter(customer => customer.id !== selectedCustomer.id)
      )
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
        <SearchCommand 
          data={customers} 
          setFilteredData={setFilteredCustomers}
        />
        <Button
          onClick={() => {
            setSelectedCustomer(null)
            setIsDialogOpen(true)
          }}
          className="w-full sm:w-auto bg-primary hover:bg-primary/90 text-white transition-all duration-300 hover:scale-105 active:scale-95"
        >
          <PlusCircle className="w-4 h-4 mr-2" />
          Add Customer
        </Button>
      </div>

      <AnimatePresence mode="wait">
        {loading ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex justify-center items-center py-8"
          >
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </motion.div>
        ) : filteredCustomers.length > 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
          >
            {filteredCustomers.map(customer => (
              <motion.div
                key={customer.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="cursor-pointer"
                onClick={() => handleCustomerSelect(customer.id)}
              >
                <div className="bg-card border rounded-lg p-4 hover:shadow-md transition-all duration-300">
                  <h3 className="text-lg font-semibold mb-2 text-foreground">
                    {customer.title}
                  </h3>
                  <div className="space-y-1 text-sm text-muted-foreground">
                    {customer.user_surname && (
                      <p>Contact: {customer.user_surname}</p>
                    )}
                    {customer.user_number && (
                      <p>Phone: {customer.user_number}</p>
                    )}
                    {customer.payment_status && (
                      <p>Payment Status: {customer.payment_status}</p>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="text-center py-8 text-muted-foreground"
          >
            No customers found. Add your first customer to get started!
          </motion.div>
        )}
      </AnimatePresence>

      <CustomerDialog
        customer={selectedCustomer}
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        onSubmit={handleCustomerUpdate}
        onDelete={handleCustomerDelete}
      />
    </div>
  )
}