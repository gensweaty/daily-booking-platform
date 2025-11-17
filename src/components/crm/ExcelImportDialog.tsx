import React, { useState, useCallback } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { useLanguage } from '@/contexts/LanguageContext';
import { Upload, FileSpreadsheet, CheckCircle2, AlertCircle, Loader2, XCircle, CheckCircle } from 'lucide-react';
import { useExcelImport, ImportRow } from '@/hooks/useExcelImport';
import { supabase } from '@/lib/supabase';
import { format } from 'date-fns';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';

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

  const handleFileSelect = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setParsedData(null);
    }
  }, []);

  const handleParseFile = useCallback(async () => {
    if (!selectedFile) return;

    const result = await parseExcelFile(selectedFile);
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
  }, []);

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
