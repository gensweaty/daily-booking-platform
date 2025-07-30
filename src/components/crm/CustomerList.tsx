
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { SearchCommand } from "./SearchCommand";
import { CustomerDialog } from "./CustomerDialog";
import { useOptimizedCRMData } from "@/hooks/useOptimizedCRMData";
import { Loader2, Plus, Users, UserPlus, Calendar, FileText } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { LanguageText } from "@/components/shared/LanguageText";
import { GeorgianAuthText } from "@/components/shared/GeorgianAuthText";
import { startOfMonth, endOfMonth } from "date-fns";
import { motion } from "framer-motion";

// Define Customer type locally since it's not exported from lib/types
interface Customer {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  bookings_count: number;
  status: string;
}

export const CustomerList = () => {
  const { t, language } = useLanguage();
  const isGeorgian = language === 'ka';
  
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filteredData, setFilteredData] = useState<any[]>([]);

  const { 
    combinedData: customers = [], 
    isLoading 
  } = useOptimizedCRMData(searchTerm, { 
    start: startOfMonth(new Date()), 
    end: endOfMonth(new Date()) 
  });

  const handleCustomerClick = (customer: Customer) => {
    setSelectedCustomer(customer);
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setSelectedCustomer(null);
  };

  const handleNewCustomer = () => {
    setSelectedCustomer(null);
    setIsDialogOpen(true);
  };

  // Use filtered data if available, otherwise use customers
  const displayCustomers = filteredData.length > 0 ? filteredData : customers;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <motion.h1 
          className={`text-2xl font-bold bg-gradient-to-r from-foreground via-foreground/90 to-foreground/70 bg-clip-text text-transparent hover:from-primary hover:via-primary/90 hover:to-primary/70 transition-all duration-300 cursor-default ${isGeorgian ? 'font-georgian' : ''}`}
          whileHover={{ scale: 1.02 }}
          transition={{ duration: 0.2 }}
        >
          {isGeorgian ? (
            <GeorgianAuthText fontWeight="bold">მომხმარებლების მართვა</GeorgianAuthText>
          ) : (
            <LanguageText>{t("dashboard.crm")}</LanguageText>
          )}
        </motion.h1>
        
        <div className="flex items-center gap-2">
          <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
            <Button
              variant="outline"
              size="icon"
              className="hover:bg-accent/50 hover:border-accent transition-all duration-200 hover:shadow-sm"
            >
              <FileText className="h-4 w-4" />
            </Button>
          </motion.div>
          
          <motion.div 
            whileHover={{ scale: 1.05 }} 
            whileTap={{ scale: 0.95 }}
            transition={{ duration: 0.1 }}
          >
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button 
                  onClick={handleNewCustomer}
                  className="bg-primary hover:bg-primary/90 shadow-md hover:shadow-lg transition-all duration-200"
                >
                  <motion.div
                    whileHover={{ rotate: 90 }}
                    transition={{ duration: 0.2 }}
                  >
                    <UserPlus className="w-4 h-4 mr-2" />
                  </motion.div>
                  {isGeorgian ? (
                    <GeorgianAuthText fontWeight="bold">მომხმარებლის დამატება</GeorgianAuthText>
                  ) : (
                    <LanguageText>{t("crm.addCustomer")}</LanguageText>
                  )}
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
                <CustomerDialog
                  customerId={selectedCustomer?.id}
                  onClose={handleCloseDialog}
                />
              </DialogContent>
            </Dialog>
          </motion.div>
        </div>
      </div>

      <div className="flex flex-col md:flex-row items-center justify-between gap-4">
        <SearchCommand 
          data={customers}
          setFilteredData={setFilteredData}
          isLoading={isLoading}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>
            {isGeorgian ? (
              <GeorgianAuthText fontWeight="bold">მომხმარებელთა სია</GeorgianAuthText>
            ) : (
              <LanguageText>{t("crm.customerList")}</LanguageText>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4 text-center">
              <Loader2 className="w-6 h-6 animate-spin mx-auto" />
              <p className="mt-2">Loading customers...</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-border">
                <thead>
                  <tr className="bg-muted/50">
                    <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      {isGeorgian ? (
                        <GeorgianAuthText fontWeight="bold">სახელი</GeorgianAuthText>
                      ) : (
                        <LanguageText>{t("crm.name")}</LanguageText>
                      )}
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      {isGeorgian ? (
                        <GeorgianAuthText fontWeight="bold">ელ. ფოსტა</GeorgianAuthText>
                      ) : (
                        <LanguageText>{t("crm.email")}</LanguageText>
                      )}
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      {isGeorgian ? (
                        <GeorgianAuthText fontWeight="bold">ტელეფონი</GeorgianAuthText>
                      ) : (
                        <LanguageText>{t("crm.phone")}</LanguageText>
                      )}
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      {isGeorgian ? (
                        <GeorgianAuthText fontWeight="bold">ჯავშნები</GeorgianAuthText>
                      ) : (
                        <LanguageText>{t("crm.bookings")}</LanguageText>
                      )}
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      {isGeorgian ? (
                        <GeorgianAuthText fontWeight="bold">სტატუსი</GeorgianAuthText>
                      ) : (
                        <LanguageText>{t("crm.status")}</LanguageText>
                      )}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {displayCustomers.map((customer) => (
                    <tr key={customer.id} onClick={() => handleCustomerClick(customer)} className="hover:bg-accent/50 cursor-pointer transition-colors duration-200">
                      <td className="px-4 py-2 whitespace-nowrap">
                        <div className="text-sm font-medium text-foreground">{customer.first_name || customer.title} {customer.last_name || customer.user_surname}</div>
                      </td>
                      <td className="px-4 py-2 whitespace-nowrap">
                        <div className="text-sm text-muted-foreground">{customer.email || customer.social_network_link}</div>
                      </td>
                      <td className="px-4 py-2 whitespace-nowrap">
                        <div className="text-sm text-muted-foreground">{customer.phone || customer.user_number}</div>
                      </td>
                      <td className="px-4 py-2 whitespace-nowrap">
                        <div className="text-sm text-muted-foreground">{customer.bookings_count || 0}</div>
                      </td>
                      <td className="px-4 py-2 whitespace-nowrap">
                        {customer.status === 'active' ? (
                          <Badge variant="outline">{customer.status}</Badge>
                        ) : (
                          <Badge>{customer.status || 'active'}</Badge>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {displayCustomers.length === 0 && !isLoading && (
                <div className="p-4 text-center">
                  <Users className="w-6 h-6 mx-auto text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground">
                    {isGeorgian ? (
                      <GeorgianAuthText>მომხმარებლები ვერ მოიძებნა</GeorgianAuthText>
                    ) : (
                      <LanguageText>{t("crm.noCustomers")}</LanguageText>
                    )}
                  </p>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
