import { useState } from "react";
import { Button } from "@/components/ui/button";
import { PlusCircle, Trash2, Pencil, Search, X, FileDown, AlertCircle } from "lucide-react";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { CustomerDialog } from "./CustomerDialog";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useCRMData } from "@/hooks/useCRMData";
import { Customer } from "@/lib/types";
import { useLanguage } from "@/contexts/LanguageContext";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "../ui/alert-dialog";
import { LanguageText } from "../shared/LanguageText";
import { supabase } from "@/lib/supabase";

// Helper function for Excel export
const exportToExcel = (data: any[], filename: string) => {
  const XLSX = require('xlsx');
  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Data");
  XLSX.writeFile(workbook, `${filename}.xlsx`);
};

export const CustomerList = () => {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const { toast } = useToast();
  const { t, language } = useLanguage();
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [customerToDelete, setCustomerToDelete] = useState<string | null>(null);
  
  const today = new Date();
  const oneMonthAgo = new Date(today);
  oneMonthAgo.setMonth(today.getMonth() - 1);
  
  const { customers, isLoading } = useCRMData(undefined, { start: oneMonthAgo, end: today });
  
  const deleteCustomer = async (id: string) => {
    try {
      const { error } = await supabase
        .from('customers')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', id);
        
      if (error) throw error;
      return true;
    } catch (error) {
      console.error("Error deleting customer:", error);
      throw error;
    }
  };
  
  const refetch = async () => {
    // This will be handled by React Query's invalidation
  };

  const onDialogClose = () => {
    setIsDialogOpen(false);
    setEditingCustomer(null);
    refetch();
  };

  const handleEditClick = (customer: Customer) => {
    setEditingCustomer(customer);
    setIsDialogOpen(true);
  };

  const handleDeleteClick = (id: string) => {
    setCustomerToDelete(id);
    setIsDeleteConfirmOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (customerToDelete) {
      try {
        await deleteCustomer(customerToDelete);
        toast({ 
          title: t("common.success"), 
          description: t("common.deleteSuccess") 
        });
        refetch();
      } catch (error) {
        toast({ 
          title: t("common.error"), 
          description: t("common.deleteError"),
          variant: "destructive"
        });
      }
      setIsDeleteConfirmOpen(false);
      setCustomerToDelete(null);
    }
  };

  // Map customer fields correctly
  const mapCustomerForDisplay = (customer: any): Customer => {
    return {
      id: customer.id,
      fullName: customer.user_surname || customer.title,
      phoneNumber: customer.user_number,
      socialLink: customer.social_network_link,
      paymentStatus: customer.payment_status,
      paymentAmount: customer.payment_amount,
      comments: customer.event_notes,
      createdAt: customer.created_at,
      // Keep original fields too
      user_surname: customer.user_surname,
      user_number: customer.user_number,
      social_network_link: customer.social_network_link,
      payment_status: customer.payment_status,
      payment_amount: customer.payment_amount,
      event_notes: customer.event_notes,
      created_at: customer.created_at,
      customer_files_new: customer.customer_files_new,
    };
  };

  const filteredCustomers = customers?.filter(customer => 
    (customer.user_surname || customer.title || '')?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (customer.user_number || '')?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (customer.social_network_link || '')?.toLowerCase().includes(searchTerm.toLowerCase())
  ).map(mapCustomerForDisplay) || [];

  const handleExportToExcel = () => {
    if (!filteredCustomers.length) {
      toast({
        title: t("common.error"),
        description: t("crm.noDataToExport"),
        variant: "destructive",
      });
      return;
    }
    
    const data = filteredCustomers.map(c => ({
      [t("crm.fullNameRequired")]: c.fullName,
      [t("crm.phoneNumber")]: c.phoneNumber,
      [t("crm.socialLinkEmail")]: c.socialLink,
      [t("crm.paymentStatus")]: c.paymentStatus ? 
        c.paymentStatus === "not_paid" ? t("crm.notPaid") :
        c.paymentStatus === "paid_partly" ? t("crm.paidPartly") :
        t("crm.paidFully") : "",
      [t("crm.paymentAmount")]: c.paymentAmount || "",
      [t("crm.comment")]: c.comments || "",
      [t("crm.dates")]: c.createdAt ? new Date(c.createdAt).toLocaleDateString() : "",
    }));
    
    exportToExcel(data, 'Customers');
    
    toast({
      title: t("dashboard.exportSuccessful"),
      description: t("dashboard.exportSuccessMessage"),
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row justify-between gap-4 items-center">
        <div className="relative w-full sm:w-auto">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full sm:w-[300px] pl-8 pr-8 rounded-md"
          />
          {searchTerm && (
            <X 
              className="absolute right-2.5 top-2.5 h-4 w-4 text-muted-foreground cursor-pointer"
              onClick={() => setSearchTerm("")}
            />
          )}
        </div>
        
        <div className="flex gap-2 w-full sm:w-auto">
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="default" className="flex gap-1 items-center w-full sm:w-auto">
                <PlusCircle className="h-4 w-4" />
                <span>{t("crm.addCustomer")}</span>
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[550px]">
              <CustomerDialog 
                customer={editingCustomer}
                onClose={onDialogClose}
              />
            </DialogContent>
          </Dialog>
          
          <Button 
            variant="outline" 
            className="flex gap-1 items-center w-full sm:w-auto"
            onClick={handleExportToExcel}
          >
            <FileDown className="h-4 w-4" />
            <span>Excel</span>
          </Button>
        </div>
      </div>
      
      <div className="border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-muted">
                <th className="px-4 py-2 text-left font-medium text-foreground">{t("crm.fullNameRequired")}</th>
                <th className="px-4 py-2 text-left font-medium text-foreground">{t("crm.phoneNumber")}</th>
                <th className="px-4 py-2 text-left font-medium text-foreground">{t("crm.socialLinkEmail")}</th>
                <th className="px-4 py-2 text-left font-medium text-foreground">{t("crm.paymentStatus")}</th>
                <th className="px-4 py-2 text-left font-medium text-foreground">{t("crm.actions")}</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-16 text-center text-muted-foreground">
                    {t("common.loading")}...
                  </td>
                </tr>
              ) : filteredCustomers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-16 text-center text-muted-foreground">
                    <div className="flex flex-col items-center gap-2">
                      <p className="font-semibold text-lg">{t("crm.noCustomers")}</p>
                      <p className="text-sm text-gray-500">{t("crm.noCustomersDescription")}</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredCustomers.map((customer) => (
                  <tr key={customer.id} className="border-t hover:bg-muted/50">
                    <td className="px-4 py-2">{customer.fullName}</td>
                    <td className="px-4 py-2">{customer.phoneNumber || '-'}</td>
                    <td className="px-4 py-2">{customer.socialLink || '-'}</td>
                    <td className="px-4 py-2">
                      {customer.paymentStatus === 'not_paid' && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300">
                          {t("crm.notPaid")}
                        </span>
                      )}
                      {customer.paymentStatus === 'paid_partly' && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300">
                          {t("crm.paidPartly")}
                        </span>
                      )}
                      {customer.paymentStatus === 'paid_fully' && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">
                          {t("crm.paidFully")}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex gap-2">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          onClick={() => handleEditClick(customer)}
                          title={t("crm.editCustomer")}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          onClick={() => handleDeleteClick(customer.id)}
                          title={t("common.delete")}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      
      <AlertDialog open={isDeleteConfirmOpen} onOpenChange={setIsDeleteConfirmOpen}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-destructive" />
              <LanguageText>Delete Customer</LanguageText>
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("common.deleteConfirmMessage")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {t("common.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
