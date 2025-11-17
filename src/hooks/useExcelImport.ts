import { useState, useCallback } from 'react';
import * as XLSX from 'xlsx';
import { format, parse } from 'date-fns';
import { useLanguage } from '@/contexts/LanguageContext';

export interface ColumnMatch {
  fieldName: string;
  columnIndex: number;
  confidence: number;
  matchType: 'exact' | 'partial' | 'content';
  suggestedMapping: string;
}

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
  mappingSuggestions: ColumnMatch[];
}

const FIELD_KEYWORDS = {
  fullName: {
    exact: ['full name', 'nombre completo', 'სახელი და გვარი', 'business_segment', 'company'],
    partial: ['name', 'nombre', 'სახელი', 'client', 'customer', 'კლიენტი', 'business', 'company', 'segment'],
    patterns: []
  },
  phoneNumber: {
    exact: ['phone number', 'número de teléfono', 'ტელეფონის ნომერი'],
    partial: ['phone', 'tel', 'mobile', 'número', 'ტელეფონი', 'contact', 'contacto'],
    patterns: [/\d{9,15}/]
  },
  socialLink: {
    exact: ['social link/email', 'enlace social/correo', 'სოციალური ბმული/ელფოსტა', 'primary_email'],
    partial: ['email', 'social', 'link', 'correo', 'ელფოსტა', 'primary', 'contact', 'linkedin', 'website'],
    patterns: [/@/, /http/]
  },
  paymentStatus: {
    exact: ['payment status', 'estado de pago', 'გადახდის სტატუსი'],
    partial: ['payment', 'status', 'paid', 'pago', 'estado', 'გადახდა'],
    patterns: []
  },
  paymentAmount: {
    exact: ['payment amount', 'monto de pago', 'გადახდის თანხა', 'estimated_deal_value', 'revenue_estimate'],
    partial: ['amount', 'price', 'cost', 'monto', 'precio', 'თანხა', 'value', 'revenue', 'deal', 'estimate'],
    patterns: [/[\d.,]+/]
  },
  eventDate: {
    exact: ['event date', 'fecha del evento', 'ღონისძიების თარიღი'],
    partial: ['date', 'fecha', 'თარიღი', 'when', 'time'],
    patterns: [/\d{1,2}[./-]\d{1,2}[./-]\d{2,4}/]
  },
  comment: {
    exact: ['comment', 'comentario', 'კომენტარი', 'location'],
    partial: ['note', 'notes', 'observation', 'nota', 'შენიშვნა', 'location', 'address', 'city', 'size'],
    patterns: []
  }
};

export const useExcelImport = () => {
  const { t } = useLanguage();
  const [isProcessing, setIsProcessing] = useState(false);

  const mapPaymentStatus = useCallback((value: string | undefined): string => {
    if (!value) return 'not_paid';
    const lowerValue = value.toLowerCase().trim();
    if (lowerValue.includes('not paid') || lowerValue.includes('no pagado') || lowerValue.includes('არ არის')) return 'not_paid';
    if (lowerValue.includes('partly') || lowerValue.includes('partial') || lowerValue.includes('ნაწილობრივ')) return 'partly_paid';
    if (lowerValue.includes('fully') || lowerValue.includes('totalmente') || lowerValue.includes('სრულად')) return 'fully_paid';
    return 'not_paid';
  }, []);

  const parseDateRange = useCallback((dateStr: string | undefined): { start: Date; end: Date } | undefined => {
    if (!dateStr) return undefined;
    try {
      const parts = dateStr.split('-').map(s => s.trim());
      if (parts.length !== 2) return undefined;
      const start = parse(parts[0], 'dd.MM.yyyy', new Date());
      const end = parse(parts[1], 'dd.MM.yyyy', new Date());
      if (isNaN(start.getTime()) || isNaN(end.getTime())) return undefined;
      return { start, end };
    } catch {
      return undefined;
    }
  }, []);

  const parsePaymentAmount = useCallback((value: any): number | undefined => {
    if (value === null || value === undefined || value === '') return undefined;
    const strValue = String(value).replace(/[₾€$,]/g, '').trim();
    const numValue = parseFloat(strValue);
    return isNaN(numValue) ? undefined : numValue;
  }, []);

  const scoreColumnMatch = useCallback((header: string, sampleData: any[], fieldName: string): number => {
    let score = 0;
    const lowerHeader = header.toLowerCase().trim();
    const keywords = FIELD_KEYWORDS[fieldName as keyof typeof FIELD_KEYWORDS];
    if (!keywords) return 0;
    
    if (keywords.exact.some(k => lowerHeader === k.toLowerCase())) {
      score += 50;
    } else if (keywords.partial.some(k => lowerHeader.includes(k.toLowerCase()))) {
      score += 30;
    }
    
    if (keywords.patterns.length > 0 && sampleData.length > 0) {
      const validSamples = sampleData.filter(val => val !== null && val !== undefined && val !== '');
      if (validSamples.length > 0) {
        const matchingCount = validSamples.filter(val => 
          keywords.patterns.some(pattern => pattern.test(String(val)))
        ).length;
        score += (matchingCount / validSamples.length) * 40;
      }
    }
    return score;
  }, []);

  const detectColumnsWithConfidence = useCallback((headers: string[], rows: any[][]): { mappings: Record<string, number>, suggestions: ColumnMatch[] } => {
    const suggestions: ColumnMatch[] = [];
    const finalMappings: Record<string, number> = {};
    
    headers.forEach((header, colIndex) => {
      const sampleData = rows.slice(0, Math.min(10, rows.length)).map(row => row[colIndex]);
      Object.keys(FIELD_KEYWORDS).forEach(fieldName => {
        const confidence = scoreColumnMatch(header, sampleData, fieldName);
        if (confidence > 20) {
          suggestions.push({
            fieldName,
            columnIndex: colIndex,
            confidence: Math.round(confidence),
            matchType: confidence >= 50 ? 'exact' : confidence >= 30 ? 'partial' : 'content',
            suggestedMapping: header
          });
        }
      });
    });
    
    suggestions.sort((a, b) => b.confidence - a.confidence);
    const usedColumns = new Set<number>();
    const usedFields = new Set<string>();
    suggestions.forEach(match => {
      if (!usedColumns.has(match.columnIndex) && !usedFields.has(match.fieldName)) {
        finalMappings[match.fieldName] = match.columnIndex;
        usedColumns.add(match.columnIndex);
        usedFields.add(match.fieldName);
      }
    });
    
    return { mappings: finalMappings, suggestions: suggestions.filter(s => finalMappings[s.fieldName] === s.columnIndex) };
  }, [scoreColumnMatch]);

  const parseExcelFile = useCallback(async (file: File): Promise<ParsedData> => {
    setIsProcessing(true);
    try {
      const arrayBuffer = await file.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer);
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
      
      if (jsonData.length === 0) throw new Error(t('crm.emptyFile'));
      
      const headers = jsonData[0].map((h: any) => String(h || '').trim());
      const dataRows = jsonData.slice(1);
      const { mappings: columnMap, suggestions } = detectColumnsWithConfidence(headers, dataRows);
      
      if (!columnMap.fullName) throw new Error(t('crm.missingFullNameColumn'));
      
      const validRows: ImportRow[] = [];
      const errors: ValidationError[] = [];
      
      dataRows.forEach((row, index) => {
        const rowNumber = index + 2;
        const fullName = row[columnMap.fullName]?.toString().trim();
        if (!fullName) {
          errors.push({ row: rowNumber, field: 'fullName', message: t('crm.missingRequired', { field: t('crm.fullName') }) });
          return;
        }
        validRows.push({
          fullName,
          phoneNumber: columnMap.phoneNumber !== undefined ? row[columnMap.phoneNumber]?.toString().trim() : undefined,
          socialLink: columnMap.socialLink !== undefined ? row[columnMap.socialLink]?.toString().trim() : undefined,
          paymentStatus: columnMap.paymentStatus !== undefined ? mapPaymentStatus(row[columnMap.paymentStatus]?.toString()) : undefined,
          paymentAmount: columnMap.paymentAmount !== undefined ? parsePaymentAmount(row[columnMap.paymentAmount]) : undefined,
          eventDate: columnMap.eventDate !== undefined ? parseDateRange(row[columnMap.eventDate]?.toString()) : undefined,
          comment: columnMap.comment !== undefined ? row[columnMap.comment]?.toString().trim() : undefined,
        });
      });
      
      return { validRows, errors, totalRows: dataRows.length, mappingSuggestions: suggestions };
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : t('crm.parseError'));
    } finally {
      setIsProcessing(false);
    }
  }, [t, mapPaymentStatus, parseDateRange, parsePaymentAmount, detectColumnsWithConfidence]);

  return { parseExcelFile, isProcessing };
};
