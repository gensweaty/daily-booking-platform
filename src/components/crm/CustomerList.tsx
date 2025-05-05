import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { PlusIcon, RefreshCw } from 'lucide-react';
import { useCRMData } from '@/hooks/useCRMData';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { CustomerDialog } from './CustomerDialog';
import { SearchCommand } from './SearchCommand';
import { LanguageText } from '@/components/shared/LanguageText';
import { GeorgianAuthText } from '@/components/shared/GeorgianAuthText';
import { getGeorgianFontStyle } from '@/lib/font-utils';
import { cn } from '@/lib/utils';

interface CustomerListProps {
  dateRange: { start: Date; end: Date };
}

export const CustomerList = ({ dateRange }: CustomerListProps) => {
  const { user } = useAuth();
  const { t, language } = useLanguage();
  const isGeorgian = language === 'ka';
  const { combinedData, isLoading, isFetching } = useCRMData(user?.id, dateRange);
  
  const [searchValue, setSearchValue] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [initialData, setInitialData] = useState<any>(null);

  // Filter combined data based on search value
  const filteredData = combinedData.filter((item: any) => {
    const searchLower = searchValue.toLowerCase();
    return (
      (item.title || '').toLowerCase().includes(searchLower) ||
      (item.user_number || '').toLowerCase().includes(searchLower) ||
      (item.social_network_link || '').toLowerCase().includes(searchLower)
    );
  });

  const handleRowClick = (customer: any) => {
    setSelectedCustomerId(customer.id);
    setInitialData(customer);
    setDialogOpen(true);
  };

  const handleAddCustomer = () => {
    setSelectedCustomerId(null);
    setInitialData(null);
    setDialogOpen(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-semibold">
          <LanguageText>{t('crm.customersAndEvents')}</LanguageText>
        </h2>
        <div className="flex gap-2">
          <SearchCommand
            searchValue={searchValue}
            setSearchValue={setSearchValue}
            placeholder={t('crm.searchCustomers')}
          />
          <Button onClick={handleAddCustomer} size="sm">
            <PlusIcon className="h-4 w-4 mr-2" />
            <LanguageText>{t('crm.addCustomer')}</LanguageText>
          </Button>
        </div>
      </div>

      <div className="border rounded-md">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className={cn(isGeorgian ? "font-georgian" : "")} style={isGeorgian ? getGeorgianFontStyle() : undefined}>
                {isGeorgian ? <GeorgianAuthText>სრული სახელი</GeorgianAuthText> : <LanguageText>{t('crm.fullName')}</LanguageText>}
              </TableHead>
              <TableHead className={cn(isGeorgian ? "font-georgian" : "")} style={isGeorgian ? getGeorgianFontStyle() : undefined}>
                {isGeorgian ? <GeorgianAuthText>ტელეფონის ნომერი</GeorgianAuthText> : <LanguageText>{t('crm.phoneNumber')}</LanguageText>}
              </TableHead>
              <TableHead>
                <LanguageText>{t('crm.socialLinkEmail')}</LanguageText>
              </TableHead>
              <TableHead>
                <LanguageText>{t('crm.paymentStatus')}</LanguageText>
              </TableHead>
              <TableHead>
                <LanguageText>{t('common.date')}</LanguageText>
              </TableHead>
              <TableHead>
                <LanguageText>{t('common.time')}</LanguageText>
              </TableHead>
              <TableHead>
                <LanguageText>{t('common.files')}</LanguageText>
              </TableHead>
              <TableHead>
                <LanguageText>{t('common.comments')}</LanguageText>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-4">
                  <RefreshCw className="h-5 w-5 animate-spin mx-auto" />
                </TableCell>
              </TableRow>
            ) : filteredData.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-4 text-muted-foreground">
                  <LanguageText>{t('crm.noCustomersFound')}</LanguageText>
                </TableCell>
              </TableRow>
            ) : (
              filteredData.map((customer: any) => (
                <TableRow
                  key={customer.id}
                  className="cursor-pointer hover:bg-accent/50"
                  onClick={() => handleRowClick(customer)}
                >
                  <TableCell>{customer.title}</TableCell>
                  <TableCell>{customer.user_number}</TableCell>
                  <TableCell>{customer.social_network_link}</TableCell>
                  <TableCell>{customer.payment_status}</TableCell>
                  <TableCell>
                    {customer.start_date
                      ? format(new Date(customer.start_date), 'MM/dd/yyyy')
                      : customer.created_at
                      ? format(new Date(customer.created_at), 'MM/dd/yyyy')
                      : 'N/A'}
                  </TableCell>
                  <TableCell>
                    {customer.start_date
                      ? format(new Date(customer.start_date), 'HH:mm')
                      : customer.created_at
                      ? format(new Date(customer.created_at), 'HH:mm')
                      : 'N/A'}
                  </TableCell>
                  <TableCell>{customer.customer_files_new?.length || 0}</TableCell>
                  <TableCell>{customer.event_notes}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <CustomerDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        customerId={selectedCustomerId}
        initialData={initialData}
      />
    </div>
  );
};
