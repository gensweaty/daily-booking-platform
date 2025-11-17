import { useState, useCallback } from 'react';
import * as XLSX from 'xlsx';
import { format, parse } from 'date-fns';
import { useLanguage } from '@/contexts/LanguageContext';

export interface ImportRow {
  fullName: string;
  phoneNumber?: string;
  socialLink?: string;
  paymentStatus?: string;
  paymentAmount?: number;
  eventDate?: { start: Date; end: Date };
  comment?: string;
}

export interface ValidationError {
  row: number;
  field: string;
  message: string;
}

export interface ParsedData {
  validRows: ImportRow[];
  errors: ValidationError[];
  totalRows: number;
}

export const useExcelImport = () => {
  const { t, language } = useLanguage();
  const [isProcessing, setIsProcessing] = useState(false);

  // Map payment status translations back to database values
  const mapPaymentStatus = useCallback((value: string | undefined): string => {
    if (!value) return 'not_paid';
    
    const lowerValue = value.toLowerCase().trim();
    
    // English
    if (lowerValue.includes('not paid')) return 'not_paid';
    if (lowerValue.includes('partly') || lowerValue.includes('partial')) return 'partly_paid';
    if (lowerValue.includes('fully') || lowerValue.includes('paid')) return 'fully_paid';
    
    // Spanish
    if (lowerValue.includes('no pagado')) return 'not_paid';
    if (lowerValue.includes('parcialmente')) return 'partly_paid';
    if (lowerValue.includes('totalmente')) return 'fully_paid';
    
    // Georgian
    if (lowerValue.includes('არ არის გადახდილი')) return 'not_paid';
    if (lowerValue.includes('ნაწილობრივ')) return 'partly_paid';
    if (lowerValue.includes('სრულად')) return 'fully_paid';
    
    return 'not_paid';
  }, []);

  // Parse date range from format "dd.MM.yyyy - dd.MM.yyyy"
  const parseDateRange = useCallback((dateStr: string | undefined): { start: Date; end: Date } | undefined => {
    if (!dateStr) return undefined;
    
    try {
      const parts = dateStr.split('-').map(s => s.trim());
      if (parts.length !== 2) return undefined;
      
      const start = parse(parts[0], 'dd.MM.yyyy', new Date());
      const end = parse(parts[1], 'dd.MM.yyyy', new Date());
      
      if (isNaN(start.getTime()) || isNaN(end.getTime())) return undefined;
      
      return { start, end };
    } catch (error) {
      return undefined;
    }
  }, []);

  // Parse payment amount - remove currency symbols and convert to number
  const parsePaymentAmount = useCallback((value: any): number | undefined => {
    if (value === null || value === undefined || value === '') return undefined;
    
    const strValue = String(value).replace(/[₾€$,]/g, '').trim();
    const numValue = parseFloat(strValue);
    
    return isNaN(numValue) ? undefined : numValue;
  }, []);

  // Detect column headers based on translations
  const detectColumns = useCallback((headers: string[]): Record<string, number> => {
    const columnMap: Record<string, number> = {};
    
    headers.forEach((header, index) => {
      const lowerHeader = header.toLowerCase().trim();
      
      // Full Name
      if (lowerHeader.includes('full name') || lowerHeader.includes('nombre completo') || 
          lowerHeader.includes('სახელი და გვარი') || lowerHeader.includes('სახელი გვარი')) {
        columnMap.fullName = index;
      }
      // Phone Number
      else if (lowerHeader.includes('phone') || lowerHeader.includes('número') || 
               lowerHeader.includes('телефон') || lowerHeader.includes('ტელეფონი')) {
        columnMap.phoneNumber = index;
      }
      // Social Link/Email
      else if (lowerHeader.includes('social') || lowerHeader.includes('email') || 
               lowerHeader.includes('correo') || lowerHeader.includes('ელფოსტა') || 
               lowerHeader.includes('სოციალური')) {
        columnMap.socialLink = index;
      }
      // Payment Status
      else if (lowerHeader.includes('payment status') || lowerHeader.includes('estado de pago') || 
               lowerHeader.includes('გადახდის სტატუსი')) {
        columnMap.paymentStatus = index;
      }
      // Payment Amount
      else if (lowerHeader.includes('payment amount') || lowerHeader.includes('monto') || 
               lowerHeader.includes('cantidad') || lowerHeader.includes('გადახდის თანხა')) {
        columnMap.paymentAmount = index;
      }
      // Event Date
      else if (lowerHeader.includes('event date') || lowerHeader.includes('fecha') || 
               lowerHeader.includes('ივენთის თარიღი')) {
        columnMap.eventDate = index;
      }
      // Comment
      else if (lowerHeader.includes('comment') || lowerHeader.includes('comentario') || 
               lowerHeader.includes('კომენტარი')) {
        columnMap.comment = index;
      }
    });
    
    return columnMap;
  }, []);

  const parseExcelFile = useCallback(async (file: File): Promise<ParsedData> => {
    setIsProcessing(true);
    
    return new Promise((resolve) => {
      const reader = new FileReader();
      
      reader.onload = (e) => {
        try {
          const data = e.target?.result;
          const workbook = XLSX.read(data, { type: 'binary' });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
          
          if (jsonData.length < 2) {
            setIsProcessing(false);
            resolve({ validRows: [], errors: [{ row: 0, field: 'file', message: t('crm.emptyFile') }], totalRows: 0 });
            return;
          }
          
          const headers = jsonData[0].map(h => String(h || ''));
          const columnMap = detectColumns(headers);
          
          if (columnMap.fullName === undefined) {
            setIsProcessing(false);
            resolve({ validRows: [], errors: [{ row: 0, field: 'file', message: t('crm.missingFullNameColumn') }], totalRows: 0 });
            return;
          }
          
          const validRows: ImportRow[] = [];
          const errors: ValidationError[] = [];
          
          // Process data rows (skip header)
          for (let i = 1; i < jsonData.length; i++) {
            const row = jsonData[i];
            const rowNumber = i + 1;
            
            // Skip empty rows
            if (!row || row.every(cell => !cell)) continue;
            
            const fullName = row[columnMap.fullName]?.toString().trim();
            
            if (!fullName) {
              errors.push({ row: rowNumber, field: 'fullName', message: t('crm.missingRequired', { field: t('crm.fullName') }) });
              continue;
            }
            
            const importRow: ImportRow = {
              fullName,
              phoneNumber: columnMap.phoneNumber !== undefined ? row[columnMap.phoneNumber]?.toString().trim() : undefined,
              socialLink: columnMap.socialLink !== undefined ? row[columnMap.socialLink]?.toString().trim() : undefined,
              paymentStatus: columnMap.paymentStatus !== undefined ? mapPaymentStatus(row[columnMap.paymentStatus]?.toString()) : 'not_paid',
              paymentAmount: columnMap.paymentAmount !== undefined ? parsePaymentAmount(row[columnMap.paymentAmount]) : undefined,
              comment: columnMap.comment !== undefined ? row[columnMap.comment]?.toString().trim() : undefined,
            };
            
            // Parse event date if provided
            if (columnMap.eventDate !== undefined) {
              const dateStr = row[columnMap.eventDate]?.toString();
              if (dateStr) {
                const dateRange = parseDateRange(dateStr);
                if (dateRange) {
                  importRow.eventDate = dateRange;
                } else {
                  errors.push({ row: rowNumber, field: 'eventDate', message: t('crm.invalidDateFormat') });
                  continue;
                }
              }
            }
            
            validRows.push(importRow);
          }
          
          setIsProcessing(false);
          resolve({ validRows, errors, totalRows: jsonData.length - 1 });
        } catch (error) {
          console.error('Error parsing Excel file:', error);
          setIsProcessing(false);
          resolve({ validRows: [], errors: [{ row: 0, field: 'file', message: t('crm.parseError') }], totalRows: 0 });
        }
      };
      
      reader.onerror = () => {
        setIsProcessing(false);
        resolve({ validRows: [], errors: [{ row: 0, field: 'file', message: t('crm.fileReadError') }], totalRows: 0 });
      };
      
      reader.readAsBinaryString(file);
    });
  }, [t, detectColumns, mapPaymentStatus, parseDateRange, parsePaymentAmount]);

  return {
    parseExcelFile,
    isProcessing,
  };
};
