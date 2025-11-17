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
    exact: ['full_name', 'full name', 'company_name', 'company name', 'business_name', 'business name', 
            'customer_name', 'customer name', 'client_name', 'client name', 'organization', 'org_name', 
            'company', 'business', 'customer', 'client', 'nombre completo', 'სახელი და გვარი'],
    partial: ['name', 'nombre', 'სახელი', 'კლიენტი'],
    patterns: [/company/i, /business/i, /customer/i, /client/i, /organization/i]
  },
  phoneNumber: {
    exact: ['phone_number', 'phone number', 'phone', 'mobile', 'mobile_number', 'mobile number', 'tel', 'telephone',
            'número de teléfono', 'ტელეფონის ნომერი'],
    partial: ['contact', 'número', 'ტელეფონი', 'cell'],
    patterns: [/phone/i, /mobile/i, /tel/i, /contact.*number/i, /\d{9,15}/]
  },
  socialLink: {
    exact: ['primary_email', 'primary email', 'email', 'e_mail', 'e-mail', 'email_address', 'email address',
            'social link/email', 'enlace social/correo', 'სოციალური ბმული/ელფოსტა'],
    partial: ['mail', 'correo', 'ელფოსტა'],
    patterns: [/@/, /email/i, /mail/i]
  },
  paymentStatus: {
    exact: ['payment status', 'estado de pago', 'გადახდის სტატუსი', 'payment_status'],
    partial: ['payment', 'status', 'paid', 'pago', 'estado', 'გადახდა'],
    patterns: []
  },
  paymentAmount: {
    exact: ['payment amount', 'monto de pago', 'გადახდის თანხა', 'estimated_deal_value', 'revenue_estimate', 'payment_amount'],
    partial: ['amount', 'price', 'cost', 'monto', 'precio', 'თანხა', 'value', 'revenue', 'deal', 'estimate'],
    patterns: [/[\d.,]+/]
  },
  eventDate: {
    exact: ['event date', 'fecha del evento', 'ღონისძიების თარიღი', 'event_date'],
    partial: ['date', 'fecha', 'თარიღი', 'when', 'time'],
    patterns: [/\d{1,2}[./-]\d{1,2}[./-]\d{2,4}/]
  },
  comment: {
    exact: ['comment', 'comments', 'notes', 'note', 'description', 'remarks', 'linkedin_profile', 'linkedin profile',
            'linkedin_url', 'linkedin url', 'profile_url', 'profile url', 'comentario', 'კომენტარი'],
    partial: ['linkedin', 'profile', 'segment', 'location', 'address', 'city', 'region', 'country', 'state',
              'size', 'industry', 'sector', 'job', 'title', 'role', 'position', 'primary_contact', 'contact',
              'additional', 'extra', 'misc', 'other', 'nota', 'შენიშვნა', 'education', 'experience'],
    patterns: [/linkedin\.com/i, /http/i, /www\./i, /profile/i, /url/i]
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
    
    // Exact match: +100 points (higher priority for exact matches)
    // Also handle underscores and spaces variations
    const normalizedHeader = lowerHeader.replace(/[_\s]/g, '');
    if (keywords.exact.some(k => {
      const normalizedKeyword = k.toLowerCase().replace(/[_\s]/g, '');
      return lowerHeader === k.toLowerCase() || normalizedHeader === normalizedKeyword;
    })) {
      score += 100;
    } 
    // Partial match: +30 points
    else if (keywords.partial.some(k => lowerHeader.includes(k.toLowerCase()))) {
      score += 30;
    }
    
    // Content pattern analysis: +40 points
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
            matchType: confidence >= 100 ? 'exact' : confidence >= 30 ? 'partial' : 'content',
            suggestedMapping: header
          });
        }
      });
    });
    
    // Sort by confidence (highest first)
    suggestions.sort((a, b) => b.confidence - a.confidence);
    
    const usedColumns = new Set<number>();
    const usedFields = new Set<string>();
    
    // Assign best matches
    suggestions.forEach(match => {
      if (!usedColumns.has(match.columnIndex) && !usedFields.has(match.fieldName)) {
        finalMappings[match.fieldName] = match.columnIndex;
        usedColumns.add(match.columnIndex);
        usedFields.add(match.fieldName);
      }
    });
    
    console.log('Final mappings:', finalMappings);
    console.log('Selected suggestions:', suggestions.filter(s => finalMappings[s.fieldName] === s.columnIndex));
    
    return { mappings: finalMappings, suggestions: suggestions.filter(s => finalMappings[s.fieldName] === s.columnIndex) };
  }, [scoreColumnMatch]);

  const parseExcelFile = useCallback(async (file: File): Promise<ParsedData> => {
    console.log('parseExcelFile called with:', file.name);
    setIsProcessing(true);
    try {
      const arrayBuffer = await file.arrayBuffer();
      console.log('File read, size:', arrayBuffer.byteLength);
      const workbook = XLSX.read(arrayBuffer);
      console.log('Workbook parsed, sheets:', workbook.SheetNames);
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
      console.log('Data extracted, rows:', jsonData.length);
      
      if (jsonData.length === 0) throw new Error(t('crm.emptyFile'));
      
      const headers = jsonData[0].map((h: any) => String(h || '').trim());
      console.log('Headers:', headers);
      const dataRows = jsonData.slice(1);
      const { mappings: columnMap, suggestions } = detectColumnsWithConfidence(headers, dataRows);
      console.log('Column mappings:', columnMap);
      console.log('Suggestions:', suggestions);
      
      if (!columnMap.fullName) {
        console.error('No fullName mapping found');
        throw new Error(t('crm.missingFullNameColumn'));
      }
      
      const validRows: ImportRow[] = [];
      const errors: ValidationError[] = [];
      
      // Identify unmapped columns that might be useful for comments
      const mappedIndices = new Set(Object.values(columnMap));
      const unmappedColumns = headers
        .map((header, index) => ({ header, index }))
        .filter(col => !mappedIndices.has(col.index));
      
      dataRows.forEach((row, index) => {
        const rowNumber = index + 2;
        const fullName = row[columnMap.fullName]?.toString().trim();
        if (!fullName) {
          errors.push({ row: rowNumber, field: 'fullName', message: t('crm.missingRequired', { field: t('crm.fullName') }) });
          return;
        }
        
        // Build comprehensive comment from mapped comment + unmapped useful columns
        const commentParts: string[] = [];
        
        // Add primary comment if exists
        if (columnMap.comment !== undefined && row[columnMap.comment]) {
          commentParts.push(row[columnMap.comment]?.toString().trim());
        }
        
        // Add other potentially useful unmapped columns
        unmappedColumns.forEach(({ header, index: colIndex }) => {
          const value = row[colIndex]?.toString().trim();
          if (value && value.length > 0) {
            // Filter out obviously non-useful data
            const lowerHeader = header.toLowerCase();
            const lowerValue = value.toLowerCase();
            
            // Include if it looks like useful information
            if (
              lowerHeader.includes('linkedin') ||
              lowerHeader.includes('profile') ||
              lowerHeader.includes('segment') ||
              lowerHeader.includes('location') ||
              lowerHeader.includes('job') ||
              lowerHeader.includes('title') ||
              lowerHeader.includes('contact') ||
              lowerHeader.includes('size') ||
              lowerValue.includes('linkedin.com') ||
              lowerValue.includes('http')
            ) {
              commentParts.push(`${header}: ${value}`);
            }
          }
        });
        
        const finalComment = commentParts.length > 0 ? commentParts.join(' | ') : undefined;
        
        validRows.push({
          fullName,
          phoneNumber: columnMap.phoneNumber !== undefined ? row[columnMap.phoneNumber]?.toString().trim() : undefined,
          socialLink: columnMap.socialLink !== undefined ? row[columnMap.socialLink]?.toString().trim() : undefined,
          paymentStatus: columnMap.paymentStatus !== undefined ? mapPaymentStatus(row[columnMap.paymentStatus]?.toString()) : undefined,
          paymentAmount: columnMap.paymentAmount !== undefined ? parsePaymentAmount(row[columnMap.paymentAmount]) : undefined,
          eventDate: columnMap.eventDate !== undefined ? parseDateRange(row[columnMap.eventDate]?.toString()) : undefined,
          comment: finalComment,
        });
      });
      
      console.log('Valid rows:', validRows.length, 'Errors:', errors.length);
      return { validRows, errors, totalRows: dataRows.length, mappingSuggestions: suggestions };
    } catch (error) {
      console.error('Parse error:', error);
      throw new Error(error instanceof Error ? error.message : t('crm.parseError'));
    } finally {
      setIsProcessing(false);
    }
  }, [t, mapPaymentStatus, parseDateRange, parsePaymentAmount, detectColumnsWithConfidence]);

  return { parseExcelFile, isProcessing };
};
