import React, { useState, useCallback } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { useLanguage } from '@/contexts/LanguageContext';
import { Upload, FileSpreadsheet, CheckCircle2, AlertCircle, Loader2, XCircle, CheckCircle, Download, ChevronDown, Info } from 'lucide-react';
import { useExcelImport, ImportRow } from '@/hooks/useExcelImport';
import { supabase } from '@/lib/supabase';
import { format } from 'date-fns';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import * as XLSX from 'xlsx';

interface ExcelImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  createdByType: string;
  createdByName: string;
  onImportComplete: () => void;
}

export const ExcelImportDialog = ({
  open,
  onOpenChange,
  userId,
  createdByType,
  createdByName,
  onImportComplete,
}: ExcelImportDialogProps) => {
  const { t } = useLanguage();
  const { toast } = useToast();
  const { parseExcelFile, isProcessing } = useExcelImport();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<{ validRows: ImportRow[]; errors: any[]; totalRows: number; mappingSuggestions: any[] } | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [showInstructions, setShowInstructions] = useState(true);

  const handleFileSelect = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    console.log('File selected:', file);
    if (file) {
      setSelectedFile(file);
      setParsedData(null);
      console.log('File set to state:', file.name);
    }
  }, []);

  const handleParseFile = useCallback(async () => {
    console.log('handleParseFile called, selectedFile:', selectedFile);
    if (!selectedFile) {
      console.log('No file selected, returning');
      return;
    }

    console.log('Starting file parsing...');
    try {
      const result = await parseExcelFile(selectedFile);
      console.log('Parse result:', result);
      setParsedData(result);

      if (result.errors.length > 0 && result.validRows.length === 0) {
        toast({
          variant: "destructive",
          title: t('crm.importFailed'),
          description: t('crm.noValidRows'),
        });
      } else if (result.validRows.length > 0) {
        toast({
          title: t('crm.fileValidated'),
          description: t('crm.readyToImport', { count: result.validRows.length }),
        });
      }
    } catch (error) {
      console.error('Error parsing file:', error);
      toast({
        variant: "destructive",
        title: t('crm.importFailed'),
        description: error instanceof Error ? error.message : t('crm.parseError'),
      });
      setParsedData(null);
    }
  }, [selectedFile, parseExcelFile, toast, t]);

  const handleImport = useCallback(async () => {
    if (!parsedData || parsedData.validRows.length === 0) return;

    setIsImporting(true);
    setImportProgress(0);

    try {
      const batchSize = 10;
      const batches = [];
      for (let i = 0; i < parsedData.validRows.length; i += batchSize) {
        batches.push(parsedData.validRows.slice(i, i + batchSize));
      }

      let importedCount = 0;

      for (const batch of batches) {
        const customersToInsert = batch.map(row => {
          // Split full name into title and user_surname
          const nameParts = row.fullName.split(' ');
          const title = nameParts[0] || row.fullName;
          const user_surname = nameParts.slice(1).join(' ') || '';

          return {
            user_id: userId,
            title,
            user_surname: user_surname || null,
            user_number: row.phoneNumber || null,
            social_network_link: row.socialLink || null,
            payment_status: row.paymentStatus || 'not_paid',
            payment_amount: row.paymentAmount || null,
            start_date: row.eventDate ? row.eventDate.start.toISOString() : null,
            end_date: row.eventDate ? row.eventDate.end.toISOString() : null,
            event_notes: row.comment || null,
            type: 'customer',
            created_by_type: createdByType,
            created_by_name: createdByName,
            created_at: new Date().toISOString(),
          };
        });

        const { error } = await supabase
          .from('customers')
          .insert(customersToInsert);

        if (error) throw error;

        importedCount += batch.length;
        setImportProgress((importedCount / parsedData.validRows.length) * 100);
      }

      toast({
        title: t('crm.importSuccess', { count: importedCount }),
        description: t('crm.customersAdded'),
      });

      onImportComplete();
      onOpenChange(false);
      
      // Reset state
      setSelectedFile(null);
      setParsedData(null);
      setImportProgress(0);
    } catch (error) {
      console.error('Error importing customers:', error);
      toast({
        variant: "destructive",
        title: t('crm.importFailed'),
        description: error.message || t('crm.importError'),
      });
    } finally {
      setIsImporting(false);
    }
  }, [parsedData, userId, createdByType, createdByName, toast, t, onImportComplete, onOpenChange]);

  const handleDrop = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const file = event.dataTransfer.files?.[0];
    if (file && (file.name.endsWith('.xlsx') || file.name.endsWith('.xls'))) {
      setSelectedFile(file);
      setParsedData(null);
    } else {
      toast({
        variant: "destructive",
        title: t('crm.invalidFileType'),
        description: t('crm.excelFilesOnly'),
      });
    }
  }, [toast, t]);

  const handleDragOver = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
  }, []);

  const handleReset = useCallback(() => {
    setSelectedFile(null);
    setParsedData(null);
    setImportProgress(0);
    setShowInstructions(true);
  }, []);

  const handleDownloadTemplate = useCallback(() => {
    const templateData = [
      {
        'Company_Name': 'Example Business LLC',
        'Phone_Number': '+1234567890',
        'Primary_Email': 'contact@example.com',
        'Payment_Status': 'Not Paid',
        'Payment_Amount': 1000,
        'Event_Date': '01.12.2024 - 02.12.2024',
        'Comment': 'LinkedIn: linkedin.com/company/example | Location: New York'
      }
    ];

    const ws = XLSX.utils.json_to_sheet(templateData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Customer Template');
    
    // Set column widths
    ws['!cols'] = [
      { wch: 25 }, // Company_Name
      { wch: 15 }, // Phone_Number
      { wch: 25 }, // Primary_Email
      { wch: 15 }, // Payment_Status
      { wch: 15 }, // Payment_Amount
      { wch: 25 }, // Event_Date
      { wch: 50 }  // Comment
    ];

    XLSX.writeFile(wb, 'customer_import_template.xlsx');
    toast({
      title: t('crm.templateDownloaded'),
    });
  }, [t, toast]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            {t('crm.importExcel')}
          </DialogTitle>
          <DialogDescription>
            {t('crm.uploadExcelFile')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Field Requirements Instructions */}
          {!parsedData && (
            <Collapsible open={showInstructions} onOpenChange={setShowInstructions}>
              <div className="border rounded-lg bg-muted/30">
                <CollapsibleTrigger className="w-full p-4 flex items-center justify-between hover:bg-muted/50 transition-colors">
                  <div className="flex items-center gap-2">
                    <Info className="h-4 w-4 text-primary" />
                    <span className="font-medium text-sm">{t('crm.fieldRequirements')}</span>
                  </div>
                  <ChevronDown className={`h-4 w-4 transition-transform ${showInstructions ? 'rotate-180' : ''}`} />
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="px-4 pb-4 space-y-3 text-sm">
                    <div>
                      <p className="font-medium mb-1">{t('crm.requiredFields')}:</p>
                      <ul className="list-disc list-inside text-muted-foreground space-y-1">
                        <li>{t('crm.companyNameRequired')}</li>
                      </ul>
                    </div>
                    <div>
                      <p className="font-medium mb-1">{t('crm.optionalFields')}:</p>
                      <ul className="list-disc list-inside text-muted-foreground space-y-1">
                        <li>{t('crm.phoneNumberOptional')}</li>
                        <li>{t('crm.emailOptional')}</li>
                        <li>{t('crm.paymentStatusOptional')}</li>
                        <li>{t('crm.paymentAmountOptional')}</li>
                        <li>{t('crm.eventDateOptional')}</li>
                        <li>{t('crm.commentOptional')}</li>
                      </ul>
                    </div>
                    <div>
                      <p className="font-medium mb-1">{t('crm.acceptedColumnNames')}:</p>
                      <p className="text-muted-foreground">"Company_Name", "Business Name", "Customer Name", "Full Name"</p>
                    </div>
                    <div>
                      <p className="font-medium mb-1">{t('crm.formatExamples')}:</p>
                      <ul className="list-disc list-inside text-muted-foreground space-y-1">
                        <li>{t('crm.dateFormatExample')}: 01.12.2024 - 02.12.2024</li>
                        <li>{t('crm.paymentStatusValues')}: Not Paid, Partly Paid, Fully Paid</li>
                      </ul>
                    </div>
                    <Alert className="bg-primary/5 border-primary/20">
                      <Info className="h-4 w-4 text-primary" />
                      <AlertDescription className="text-xs">{t('crm.tipDownloadTemplate')}</AlertDescription>
                    </Alert>
                  </div>
                </CollapsibleContent>
              </div>
            </Collapsible>
          )}

          {/* Download Template Button */}
          {!parsedData && (
            <Button onClick={handleDownloadTemplate} variant="outline" className="w-full" type="button">
              <Download className="h-4 w-4 mr-2" />
              {t('crm.downloadTemplate')}
            </Button>
          )}

          {!parsedData && (
            <div
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              className="border-2 border-dashed border-border rounded-lg p-8 text-center hover:border-primary/50 transition-colors"
            >
              <FileSpreadsheet className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-sm text-muted-foreground mb-2">{t('crm.dragDropHere')}</p>
              <p className="text-xs text-muted-foreground mb-4">{t('crm.orClickToSelect')}</p>
              <input
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileSelect}
                className="hidden"
                id="excel-upload"
              />
              <label htmlFor="excel-upload">
                <Button variant="outline" asChild>
                  <span>{t('crm.selectFile')}</span>
                </Button>
              </label>
              {selectedFile && (
                <p className="mt-4 text-sm font-medium">{selectedFile.name}</p>
              )}
            </div>
          )}

          {selectedFile && !parsedData && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{t('crm.validFormat')}</AlertDescription>
            </Alert>
          )}

          {parsedData && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="border rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle className="h-5 w-5 text-green-500" />
                    <span className="font-medium">{t('crm.validRows')}</span>
                  </div>
                  <p className="text-2xl font-bold">{parsedData.validRows.length}</p>
                </div>
                <div className="border rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertCircle className="h-5 w-5 text-destructive" />
                    <span className="font-medium">{t('crm.errors')}</span>
                  </div>
                  <p className="text-2xl font-bold">{parsedData.errors.length}</p>
                </div>
              </div>

              {parsedData.errors.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium mb-2">{t('crm.validationErrors')}</h4>
                  <ScrollArea className="h-32 border rounded-lg p-2">
                    {parsedData.errors.map((error, index) => (
                      <p key={index} className="text-sm text-destructive mb-1">
                        {t('crm.rowError', { row: error.row, error: error.message })}
                      </p>
                    ))}
                  </ScrollArea>
                </div>
              )}

              {parsedData.validRows.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium mb-2">{t('crm.previewData')}</h4>
                  <ScrollArea className="h-48 border rounded-lg">
                    <div className="p-2">
                      {parsedData.validRows.slice(0, 5).map((row, index) => (
                        <div key={index} className="text-sm mb-2 pb-2 border-b last:border-0">
                          <p className="font-medium">{row.fullName}</p>
                          {row.phoneNumber && <p className="text-muted-foreground">{row.phoneNumber}</p>}
                          {row.paymentAmount && <p className="text-muted-foreground">{row.paymentAmount}</p>}
                        </div>
                      ))}
                      {parsedData.validRows.length > 5 && (
                        <p className="text-xs text-muted-foreground text-center">
                          {t('crm.andMore', { count: parsedData.validRows.length - 5 })}
                        </p>
                      )}
                    </div>
                  </ScrollArea>
                </div>
              )}
            </div>
          )}

          {isImporting && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>{t('crm.importing')}</span>
                <span>{Math.round(importProgress)}%</span>
              </div>
              <Progress value={importProgress} />
            </div>
          )}
        </div>

        <DialogFooter>
          {!parsedData && (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                {t('common.cancel')}
              </Button>
              <Button
                onClick={handleParseFile}
                disabled={!selectedFile || isProcessing}
              >
                {isProcessing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {t('crm.validateFile')}
              </Button>
            </>
          )}
          {parsedData && (
            <>
              <Button variant="outline" onClick={handleReset}>
                {t('crm.chooseAnother')}
              </Button>
              <Button
                onClick={handleImport}
                disabled={parsedData.validRows.length === 0 || isImporting}
              >
                {isImporting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {t('crm.import')} ({parsedData.validRows.length})
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
