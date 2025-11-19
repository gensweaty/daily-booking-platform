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
    keywords: ['fullname', 'full_name', 'full name', 'customer', 'client', 'contact', 'name',
               'nombre completo', 'სრული სახელი', 'კლიენტი', 'contacto'],
    priority: 10,
    patterns: [] as RegExp[]
  },
  firstName: {
    keywords: ['firstname', 'first_name', 'first name', 'first', 'given', 'nombre', 'სახელი'],
    priority: 12, // Higher priority than fullName to prefer combination
    patterns: [] as RegExp[]
  },
  lastName: {
    keywords: ['lastname', 'last_name', 'last name', 'last', 'surname', 'family', 'apellido', 'გვარი'],
    priority: 12, // Higher priority than fullName to prefer combination
    patterns: [] as RegExp[]
  },
  companyName: {
    keywords: ['companyname', 'company_name', 'company name', 'company', 'businessname', 
               'business_name', 'business name', 'business', 'organization', 'კომპანია'],
    priority: 8, // Lower than firstName/lastName, used as fallback
    patterns: [] as RegExp[]
  },
  phoneNumber: {
    keywords: ['phone', 'mobile', 'tel', 'contact', 'número', 'ტელეფონი'],
    priority: 8,
    patterns: [/\+?\d[\d\s\-()]{8,}/]
  },
  socialLink: {
    keywords: ['email', 'mail', 'correo', 'ელფოსტა', 'social'],
    priority: 7,
    patterns: [/@/]
  },
  paymentStatus: {
    keywords: ['payment', 'status', 'paid', 'pago', 'გადახდა'],
    priority: 6,
    patterns: [] as RegExp[]
  },
  paymentAmount: {
    keywords: ['amount', 'price', 'cost', 'value', 'monto', 'თანხა'],
    priority: 6,
    patterns: [/^\d+[\d.,]*$/]
  },
  eventDate: {
    keywords: ['date', 'event', 'fecha', 'თარიღი'],
    priority: 5,
    patterns: [/\d{1,2}[./-]\d{1,2}/]
  },
  comment: {
    keywords: ['comment', 'note', 'description', 'linkedin', 'profile', 'location', 'job', 'title', 'role'],
    priority: 3,
    patterns: [] as RegExp[]
  }
};

export const useExcelImport = () => {
  const { t } = useLanguage();
  const [isProcessing, setIsProcessing] = useState(false);

  const parseFile = useCallback(async (file: File): Promise<ArrayBuffer | string> => {
    if (file.name.endsWith('.csv')) {
      return await file.text();
    } else if (file.name.endsWith('.pdf')) {
      throw new Error('PDF files are not yet supported. Please convert to Excel (.xlsx) or CSV (.csv) format.');
    } else {
      return await file.arrayBuffer();
    }
  }, []);

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
    const config = FIELD_KEYWORDS[fieldName as keyof typeof FIELD_KEYWORDS];
    if (!config) return 0;
    
    const normalized = header.toLowerCase().replace(/[_\s\-\.]/g, '');
    let score = 0;
    
    // Check header keywords with exact and partial matching
    for (const kw of config.keywords) {
      const normalizedKw = kw.toLowerCase().replace(/[_\s\-\.]/g, '');
      if (normalized === normalizedKw) {
        score += 100; // Exact match
        break;
      } else if (normalized.includes(normalizedKw) || normalizedKw.includes(normalized)) {
        score += 50; // Partial match
      }
    }
    
    // Content-based analysis for fullName - check if data looks like person names
    if (fieldName === 'fullName') {
      const validSamples = sampleData.filter(v => v != null && String(v).trim() !== '');
      if (validSamples.length > 0) {
        // Analyze if the content looks like person names
        const namePatterns = validSamples.filter(v => {
          const str = String(v).trim();
          // Person names typically: 1-4 words, capitalized, 2-50 chars, no URLs/emails
          const words = str.split(/\s+/);
          const hasProperCase = /^[A-Z]/.test(str);
          const isReasonableLength = str.length >= 2 && str.length <= 50;
          const isNotUrl = !str.includes('http') && !str.includes('www.');
          const isNotEmail = !str.includes('@');
          const wordCount = words.length >= 1 && words.length <= 4;
          
          return hasProperCase && isReasonableLength && isNotUrl && isNotEmail && wordCount;
        }).length;
        
        const namePercentage = namePatterns / validSamples.length;
        // If 60%+ of samples look like person names, boost the score
        if (namePercentage >= 0.6) {
          score += 40;
        }
      }
    }
    
    // Special validation for phoneNumber - must have actual phone patterns
    if (fieldName === 'phoneNumber') {
      const validSamples = sampleData.filter(v => v != null && String(v).trim() !== '');
      if (validSamples.length > 0) {
        const phonePattern = /^[\+]?[(]?[0-9]{1,4}[)]?[-\s\.]?[(]?[0-9]{1,4}[)]?[-\s\.]?[0-9]{1,5}[-\s\.]?[0-9]{1,5}$/;
        const hasNumbers = validSamples.filter(v => /\d/.test(String(v))).length;
        const matchingPhones = validSamples.filter(v => phonePattern.test(String(v).trim())).length;
        
        // If less than 30% of samples look like phone numbers, penalize heavily
        if (hasNumbers < validSamples.length * 0.3 || matchingPhones < validSamples.length * 0.3) {
          score = -1000; // Strong negative score to avoid matching job titles, categories, etc.
        } else {
          score += (matchingPhones / validSamples.length) * 50;
        }
      }
    } else if (config.patterns && sampleData.length > 0) {
      // Check content patterns for other fields
      const validSamples = sampleData.filter(v => v != null && String(v).trim() !== '');
      if (validSamples.length > 0) {
        const matches = validSamples.filter(v => 
          config.patterns!.some(p => p.test(String(v)))
        ).length;
        score += (matches / validSamples.length) * 50;
      }
    }
    
    console.log(`[Field Detection] ${fieldName} score for "${header}":`, score, 'samples:', sampleData.slice(0, 3));
    return score * config.priority;
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
    
    // Smart name handling: prefer firstName+lastName combination over single columns
    if (finalMappings.firstName !== undefined && finalMappings.lastName !== undefined) {
      // We have both first and last name - remove any fullName or companyName mapping
      console.log('✓ Detected First Name + Last Name columns - will combine them');
      delete finalMappings.fullName;
      delete finalMappings.companyName;
    } else if (finalMappings.firstName !== undefined) {
      // Only first name available
      console.log('✓ Detected First Name only');
      delete finalMappings.fullName;
      delete finalMappings.companyName;
    } else if (finalMappings.lastName !== undefined) {
      // Only last name available  
      console.log('✓ Detected Last Name only');
      delete finalMappings.fullName;
      delete finalMappings.companyName;
    } else if (finalMappings.companyName !== undefined && finalMappings.fullName === undefined) {
      // Use company name as fallback for fullName
      console.log('✓ Using Company Name column as Full Name');
      finalMappings.fullName = finalMappings.companyName;
      delete finalMappings.companyName;
    }
    
    console.log('📊 Final field mappings:', finalMappings);
    console.log('📋 Detected columns:', suggestions.filter(s => finalMappings[s.fieldName] === s.columnIndex));
    
    return { mappings: finalMappings, suggestions: suggestions.filter(s => finalMappings[s.fieldName] === s.columnIndex) };
  }, [scoreColumnMatch]);

  const parseExcelFile = useCallback(async (file: File): Promise<ParsedData> => {
    console.log('=== EXCEL IMPORT START ===');
    console.log('File:', file.name, 'Size:', file.size);
    setIsProcessing(true);
    try {
      const arrayBuffer = await file.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer);
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
      
      if (jsonData.length === 0) throw new Error(t('crm.emptyFile'));
      
      const headers = jsonData[0].map((h: any) => String(h || '').trim());
      const dataRows = jsonData.slice(1).filter(row => row.some(cell => cell != null && String(cell).trim() !== ''));
      
      console.log('📋 Detected Headers:', headers);
      console.log('📊 Total data rows:', dataRows.length);
      console.log('🔍 Sample row data:', dataRows[0]);
      
      const { mappings: columnMap } = detectColumnsWithConfidence(headers, dataRows);
      
      console.log('✅ FINAL COLUMN MAPPINGS:', JSON.stringify(columnMap, null, 2));
      
      const validRows: ImportRow[] = [];
      const errors: ValidationError[] = [];
      
      // Identify unmapped columns that might be useful for comments
      const mappedIndices = new Set(Object.values(columnMap));
      const unmappedColumns = headers
        .map((header, index) => ({ header, index }))
        .filter(col => !mappedIndices.has(col.index));
      
      dataRows.forEach((row, index) => {
        const rowNumber = index + 2;
        
        // Smart fullName extraction: combine first_name + last_name if available, or use fullName directly
        let fullName = '';
        
        if (columnMap.fullName !== undefined) {
          // Direct fullName column exists
          fullName = row[columnMap.fullName]?.toString().trim() || '';
          if (index === 0) console.log(`Row ${rowNumber}: Using fullName column [${columnMap.fullName}] = "${fullName}"`);
        } else if (columnMap.firstName !== undefined && columnMap.lastName !== undefined) {
          // Combine first_name and last_name
          const firstName = row[columnMap.firstName]?.toString().trim() || '';
          const lastName = row[columnMap.lastName]?.toString().trim() || '';
          fullName = `${firstName} ${lastName}`.trim();
          if (index === 0) console.log(`Row ${rowNumber}: Combining firstName[${columnMap.firstName}]="${firstName}" + lastName[${columnMap.lastName}]="${lastName}" = "${fullName}"`);
        } else if (columnMap.firstName !== undefined) {
          // Only first name available
          fullName = row[columnMap.firstName]?.toString().trim() || '';
          if (index === 0) console.log(`Row ${rowNumber}: Using firstName only [${columnMap.firstName}] = "${fullName}"`);
        } else if (columnMap.lastName !== undefined) {
          // Only last name available
          fullName = row[columnMap.lastName]?.toString().trim() || '';
          if (index === 0) console.log(`Row ${rowNumber}: Using lastName only [${columnMap.lastName}] = "${fullName}"`);
        } else {
          if (index === 0) console.log(`Row ${rowNumber}: ❌ NO NAME COLUMNS DETECTED! columnMap:`, columnMap);
        }
        
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
      return { validRows, errors, totalRows: dataRows.length, mappingSuggestions: [] };
    } catch (error) {
      console.error('Parse error:', error);
      throw new Error(error instanceof Error ? error.message : t('crm.parseError'));
    } finally {
      setIsProcessing(false);
    }
  }, [t, mapPaymentStatus, parseDateRange, parsePaymentAmount, detectColumnsWithConfidence]);

  return { parseExcelFile, isProcessing };
};
