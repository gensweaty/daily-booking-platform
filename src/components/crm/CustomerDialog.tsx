import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  createCustomer,
  deleteCustomer as deleteCustomerAPI,
  updateCustomer as updateCustomerAPI,
} from "@/lib/api/customers";
import { Customer } from "@/lib/types";
import { useAuth } from "@/contexts/AuthContext";
import { Trash2, AlertCircle } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { CustomerFiles } from "./CustomerFiles";

interface CustomerDialogProps {
  open: boolean;
  customer?: Customer;
  onOpenChange: (open: boolean) => void;
}

export function CustomerDialog({
  open,
  customer,
  onOpenChange,
}: CustomerDialogProps) {
  const [name, setName] = useState("");
  const [surname, setSurname] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [country, setCountry] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [notes, setNotes] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState("");
  const [displayedFiles, setDisplayedFiles] = useState<any[]>([]);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { t, language } = useLanguage();
  const isGeorgian = language === 'ka';
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);

  useEffect(() => {
    if (customer) {
      setName(customer.name || "");
      setSurname(customer.surname || "");
      setEmail(customer.email || "");
      setPhone(customer.phone || "");
      setAddress(customer.address || "");
      setCity(customer.city || "");
      setCountry(customer.country || "");
      setPostalCode(customer.postal_code || "");
      setNotes(customer.notes || "");
    } else {
      setName("");
      setSurname("");
      setEmail("");
      setPhone("");
      setAddress("");
      setCity("");
      setCountry("");
      setPostalCode("");
      setNotes("");
    }
  }, [customer]);

  // Load files for this customer
  useEffect(() => {
    const loadFiles = async () => {
      if (!customer?.id) {
        setDisplayedFiles([]);
        return;
      }
      
      try {
        console.log("Loading files for customer:", customer.id);
        
        const { data: customerFiles, error: customerFilesError } = await supabase
          .from('customer_files_new')
          .select('*')
          .eq('customer_id', customer.id);
            
        if (customerFilesError) {
          console.error("Error loading customer files:", customerFilesError);
        } else if (customerFiles && customerFiles.length > 0) {
          console.log("Loaded files from customer_files_new:", customerFiles.length);
          setDisplayedFiles(customerFiles);
        } else {
          console.log("No customer files found for customer:", customer.id);
        }
      } catch (err) {
        console.error("Exception loading customer files:", err);
        setDisplayedFiles([]);
      }
    };
    
    if (open) {
      // Reset file state when dialog opens
      setSelectedFile(null);
      setFileError("");
      loadFiles();
    }
  }, [customer, open]);

  const { mutate: updateCustomer } = useMutation(updateCustomerAPI, {
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      onOpenChange(false);
      // Fix incorrect toast properties
      toast({
        title: "Success",
        description: customer ? "Customer updated successfully" : "Customer created successfully"
      });
    },
    onError: (error: any) => {
      console.error("Error updating customer:", error);
      toast({
        title: "Error",
        description: "Failed to update customer"
      });
    },
  });

  const { mutate: createNewCustomer } = useMutation(createCustomer, {
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      onOpenChange(false);
      // Fix incorrect toast properties
      toast({
        title: "Success",
        description: customer ? "Customer updated successfully" : "Customer created successfully"
      });
    },
    onError: (error: any) => {
      console.error("Error creating customer:", error);
      toast({
        title: "Error",
        description: "Failed to create customer"
      });
    },
  });

  const { mutate: deleteCustomer } = useMutation(deleteCustomerAPI, {
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      onOpenChange(false);
      // Fix incorrect toast properties
      toast({
        title: "Success",
        description: "Customer deleted successfully"
      });
    },
    onError: (error: any) => {
      console.error("Error deleting customer:", error);
      // Fix incorrect toast properties
      toast({
        title: "Error",
        description: "Failed to delete customer"
      });
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const customerData = {
      name,
      surname,
      email,
      phone,
      address,
      city,
      country,
      postal_code: postalCode,
      notes,
    };

    if (customer) {
      updateCustomer({ id: customer.id, ...customerData });
    } else {
      createNewCustomer(customerData);
    }
    
    if (selectedFile && user) {
      try {
        const fileExt = selectedFile.name.split('.').pop();
        const filePath = `customers/${customer?.id || 'new'}/${crypto.randomUUID()}.${fileExt}`;
        
        console.log('Uploading file:', filePath);
        
        const { error: uploadError } = await supabase.storage
          .from('customer_attachments')
          .upload(filePath, selectedFile);

        if (uploadError) {
          console.error('Error uploading file:', uploadError);
          throw uploadError;
        }

        // Create record in customer_files_new table
        const fileData = {
          filename: selectedFile.name,
          file_path: filePath,
          content_type: selectedFile.type,
          size: selectedFile.size,
          user_id: user.id,
          customer_id: customer?.id
        };

        const { error: fileRecordError } = await supabase
          .from('customer_files_new')
          .insert(fileData);
          
        if (fileRecordError) {
          console.error('Error creating file record:', fileRecordError);
          throw fileRecordError;
        }

        console.log('File record created successfully in customer_files_new');
      } catch (fileError) {
        console.error("Error handling file upload:", fileError);
      }
    }
  };

  const handleDeleteClick = () => {
    setIsDeleteConfirmOpen(true);
  };

  const handleConfirmDelete = () => {
    if (customer) {
      deleteCustomer(customer.id);
      setIsDeleteConfirmOpen(false);
    }
  };

  const handleFileDeleted = (fileId: string) => {
    setDisplayedFiles(prev => prev.filter(file => file.id !== fileId));
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className={cn("max-w-3xl", isGeorgian ? "font-georgian" : "")}>
          <DialogHeader>
            <DialogTitle>{customer ? t("customers.editCustomer") : t("customers.createCustomer")}</DialogTitle>
            <DialogDescription>
              {customer ? t("customers.editCustomerDetails") : t("customers.addCustomerDetails")}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="grid gap-4 py-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">{t("customers.name")}</Label>
                <Input
                  id="name"
                  placeholder={t("customers.namePlaceholder")}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="surname">{t("customers.surname")}</Label>
                <Input
                  id="surname"
                  placeholder={t("customers.surnamePlaceholder")}
                  value={surname}
                  onChange={(e) => setSurname(e.target.value)}
                />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="email">{t("customers.email")}</Label>
                <Input
                  type="email"
                  id="email"
                  placeholder={t("customers.emailPlaceholder")}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">{t("customers.phone")}</Label>
                <Input
                  id="phone"
                  placeholder={t("customers.phonePlaceholder")}
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="address">{t("customers.address")}</Label>
              <Input
                id="address"
                placeholder={t("customers.addressPlaceholder")}
                value={address}
                onChange={(e) => setAddress(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="city">{t("customers.city")}</Label>
                <Input
                  id="city"
                  placeholder={t("customers.cityPlaceholder")}
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="country">{t("customers.country")}</Label>
                <Input
                  id="country"
                  placeholder={t("customers.countryPlaceholder")}
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="postalCode">{t("customers.postalCode")}</Label>
                <Input
                  id="postalCode"
                  placeholder={t("customers.postalCodePlaceholder")}
                  value={postalCode}
                  onChange={(e) => setPostalCode(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes">{t("customers.notes")}</Label>
              <Input
                id="notes"
                placeholder={t("customers.notesPlaceholder")}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>

            <CustomerFiles
              selectedFile={selectedFile}
              setSelectedFile={setSelectedFile}
              fileError={fileError}
              setFileError={setFileError}
              customerId={customer?.id}
              onFileDeleted={handleFileDeleted}
              displayedFiles={displayedFiles}
            />

            <div className="flex justify-between">
              <Button type="submit">
                {customer ? t("customers.updateCustomer") : t("customers.createCustomer")}
              </Button>
              {customer && (
                <Button
                  type="button"
                  variant="destructive"
                  size="icon"
                  onClick={handleDeleteClick}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={isDeleteConfirmOpen} onOpenChange={setIsDeleteConfirmOpen}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-destructive" />
              {t("common.delete")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("common.deleteConfirmMessage")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {t("common.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
