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
               'businessname', 'business_name', 'business name', 'business', // Added business variants
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
    keywords: ['comment', 'note', 'description', 'linkedin', 'profile', 'location'],
    priority: 3,
    patterns: [] as RegExp[]
  }
};

// Job title indicators for negative validation (when NOT in business context)
const JOB_TITLE_INDICATORS = [
  'ceo', 'founder', 'manager', 'director', 'president', 
  'executive', 'chief', 'head of', 'vp', 'producer', 'officer',
  'coordinator', 'specialist', 'analyst', 'consultant', 'associate',
  'assistant', 'lead', 'senior', 'junior', 'staff', 'representative'
];

// Business/Company name indicators
const BUSINESS_NAME_INDICATORS = [
  'gym', 'fitness', 'inc', 'llc', 'ltd', 'corp', 'company', 'group',
  'center', 'studio', 'club', 'enterprise', 'services', 'solutions',
  'consulting', 'training', 'academy', 'institute', 'shop', 'store',
  'cafe', 'restaurant', 'bar', 'hotel', 'resort'
];

/**
 * Analyzes column content to classify data type
 * Returns: personName, jobTitle, email, phone, company, date, number, text, unknown
 */
const classifyColumnContent = (sampleData: any[]): string => {
  const validSamples = sampleData.filter(v => v != null && String(v).trim() !== '');
  if (validSamples.length === 0) return 'unknown';
  
  let personNameScore = 0;
  let companyNameScore = 0;
  let jobTitleScore = 0;
  let emailScore = 0;
  let phoneScore = 0;
  let dateScore = 0;
  let numberScore = 0;
  
  validSamples.forEach(v => {
    const str = String(v).trim();
    const lower = str.toLowerCase();
    
    // Email detection
    if (str.includes('@') && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(str)) {
      emailScore += 10;
      return;
    }
    
    // Phone detection
    if (/^\+?\d[\d\s\-()]{8,}$/.test(str)) {
      phoneScore += 10;
      return;
    }
    
    // Date detection
    if (/\d{1,2}[./-]\d{1,2}[./-]\d{2,4}/.test(str)) {
      dateScore += 10;
      return;
    }
    
    // Number detection
    if (/^\d+[\d.,]*$/.test(str) && !str.includes(' ')) {
      numberScore += 10;
      return;
    }
    
    // Business/Company name detection (before job title check)
    const hasBusinessIndicators = BUSINESS_NAME_INDICATORS.some(indicator => 
      lower.includes(indicator)
    );
    const hasAmpersand = str.includes('&') || lower.includes(' and ');
    const isLongerName = str.length > 15; // Business names tend to be longer
    const words = str.split(/\s+/);
    const hasMultipleWords = words.length >= 2;
    
    if (hasBusinessIndicators || (hasAmpersand && hasMultipleWords && isLongerName)) {
      companyNameScore += 12;
      // Don't penalize person name if it could be a business
      return;
    }
    
    // Job title indicators (only if not a business name)
    const hasJobIndicators = JOB_TITLE_INDICATORS.some(indicator => 
      lower.includes(indicator)
    );
    if (hasJobIndicators) {
      jobTitleScore += 10;
      personNameScore -= 5; // Penalize person name score
      return;
    }
    
    // Person name patterns
    const hasProperCase = /^[A-Z]/.test(str);
    const isReasonableLength = str.length >= 2 && str.length <= 50;
    const wordCount = words.length >= 1 && words.length <= 4;
    const hasNoSpecialChars = !/[&/\\@#$%^*()+=[\]{}|<>]/.test(str);
    const hasNoUrl = !str.includes('http') && !str.includes('www.');
    
    if (hasProperCase && isReasonableLength && wordCount && hasNoSpecialChars && hasNoUrl) {
      personNameScore += 8;
      
      // Bonus for typical 2-3 word names
      if (words.length === 2 || words.length === 3) {
        personNameScore += 2;
      }
    } else if (hasProperCase && isReasonableLength && hasMultipleWords && !hasNoUrl) {
      // Could be company name with special chars
      companyNameScore += 5;
    }
  });
  
  // Determine classification based on highest score
  const scores = {
    email: emailScore,
    phone: phoneScore,
    date: dateScore,
    number: numberScore,
    company: companyNameScore,
    jobTitle: jobTitleScore,
    personName: personNameScore
  };
  
  const maxScore = Math.max(...Object.values(scores));
  if (maxScore === 0) return 'text';
  
  const classification = Object.entries(scores).find(([_, score]) => score === maxScore)?.[0] || 'unknown';
  
  console.log(`🔍 Content classification:`, {
    sampleSize: validSamples.length,
    scores,
    result: classification
  });
  
  return classification;
};

export const useExcelImport = () => {
  const { t } = useLanguage();
  const [isProcessing, setIsProcessing] = useState(false);

  const parseFile = useCallback(async (file: File): Promise<ArrayBuffer | string> => {
    if (file.name.endsWith('.csv')) {
      return await file.text();
    } else if (file.name.endsWith('.pdf')) {
      // PDFs cannot be reliably parsed without specialized libraries
      // Guide users to convert to Excel/CSV for best results
      throw new Error('PDF import is not fully supported yet. Please convert your PDF to Excel or CSV format:\n\n1. Open your PDF\n2. Select and copy the table data\n3. Paste into Excel or Google Sheets\n4. Save as .xlsx or .csv file\n5. Upload the Excel/CSV file here\n\nThis ensures all your data is imported accurately.');
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
    let matchType = 'none';
    
    // Check header keywords with exact and partial matching
    for (const kw of config.keywords) {
      const normalizedKw = kw.toLowerCase().replace(/[_\s\-\.]/g, '');
      if (normalized === normalizedKw) {
        score += 100; // Exact match
        matchType = 'exact';
        break;
      } else if (normalized.includes(normalizedKw) || normalizedKw.includes(normalized)) {
        score += 50; // Partial match
        matchType = 'partial';
      }
    }
    
    // Get content classification for intelligent analysis
    const contentType = classifyColumnContent(sampleData);
    
    // Enhanced content-based analysis for fullName
    if (fieldName === 'fullName') {
      const validSamples = sampleData.filter(v => v != null && String(v).trim() !== '');
      if (validSamples.length > 0) {
        // NEGATIVE VALIDATION: Check for job title indicators
        const jobTitleCount = validSamples.filter(v => {
          const lower = String(v).toLowerCase();
          return JOB_TITLE_INDICATORS.some(indicator => lower.includes(indicator));
        }).length;
        
        const jobTitlePercentage = jobTitleCount / validSamples.length;
        
        // Heavy penalty if 30%+ samples look like job titles
        if (jobTitlePercentage >= 0.3) {
          console.log(`❌ Rejecting "${header}" for fullName: ${(jobTitlePercentage * 100).toFixed(0)}% job titles detected`);
          score -= 200;
          return score * config.priority;
        }
        
        // POSITIVE VALIDATION: Enhanced person name detection
        const personNameCount = validSamples.filter(v => {
          const str = String(v).trim();
          const words = str.split(/\s+/);
          const hasProperCase = /^[A-Z]/.test(str);
          const isReasonableLength = str.length >= 2 && str.length <= 50;
          const isNotUrl = !str.includes('http') && !str.includes('www.');
          const isNotEmail = !str.includes('@');
          const wordCount = words.length >= 1 && words.length <= 4;
          const hasNoSpecialChars = !/[&/\\@#$%^*()+=[\]{}|<>]/.test(str);
          
          // Additional validation: no common job title endings
          const hasJobSuffix = /producer|officer|manager|director|executive|coordinator$/i.test(str);
          
          return hasProperCase && isReasonableLength && isNotUrl && isNotEmail && 
                 wordCount && hasNoSpecialChars && !hasJobSuffix;
        }).length;
        
        const personNamePercentage = personNameCount / validSamples.length;
        
        // Boost score based on person name confidence
        if (personNamePercentage >= 0.7) {
          score += 80; // High confidence
          matchType = 'content-high';
          console.log(`✅ Strong name match for "${header}": ${(personNamePercentage * 100).toFixed(0)}% person names`);
        } else if (personNamePercentage >= 0.5) {
          score += 40; // Medium confidence
          matchType = 'content-medium';
        }
        
        // Use content classifier result
        if (contentType === 'personName') {
          score += 100; // Strong boost from classifier
          console.log(`🎯 Classifier confirms "${header}" as personName`);
        } else if (contentType === 'company') {
          // Company names can be used as fullName, moderate boost
          score += 40;
          console.log(`🏢 Classifier identifies "${header}" as company name, acceptable for fullName`);
        } else if (contentType === 'jobTitle') {
          score -= 200; // Strong penalty from classifier
          console.log(`⚠️ Classifier identifies "${header}" as jobTitle, rejecting for fullName`);
        }
      }
    }
    
    // Enhanced validation for phoneNumber
    if (fieldName === 'phoneNumber') {
      const validSamples = sampleData.filter(v => v != null && String(v).trim() !== '');
      if (validSamples.length > 0) {
        const phonePattern = /^[\+]?[(]?[0-9]{1,4}[)]?[-\s\.]?[(]?[0-9]{1,4}[)]?[-\s\.]?[0-9]{1,5}[-\s\.]?[0-9]{1,5}$/;
        const hasNumbers = validSamples.filter(v => /\d/.test(String(v))).length;
        const matchingPhones = validSamples.filter(v => phonePattern.test(String(v).trim())).length;
        
        // Reject if less than 30% look like phones
        if (hasNumbers < validSamples.length * 0.3 || matchingPhones < validSamples.length * 0.3) {
          score = -1000;
        } else {
          score += (matchingPhones / validSamples.length) * 50;
        }
        
        // Boost if classifier confirms
        if (contentType === 'phone') {
          score += 50;
        }
      }
    }
    
    // Enhanced validation for companyName
    if (fieldName === 'companyName') {
      // Boost score if classified as company
      if (contentType === 'company') {
        score += 100;
        console.log(`🏢 Classifier confirms "${header}" as company name`);
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
    
    const finalScore = score * config.priority;
    console.log(`📊 [Field Detection] ${fieldName} for "${header}":`, {
      headerMatch: matchType,
      contentType,
      rawScore: score,
      priority: config.priority,
      finalScore,
      samples: sampleData.slice(0, 2)
    });
    
    return finalScore;
  }, []);

  const detectColumnsWithConfidence = useCallback((headers: string[], rows: any[][]): { mappings: Record<string, number>, suggestions: ColumnMatch[] } => {
    console.log('\n🔍 === COLUMN DETECTION ANALYSIS ===');
    console.log('Headers:', headers);
    
    const suggestions: ColumnMatch[] = [];
    const finalMappings: Record<string, number> = {};
    const columnAnalysis: any[] = [];
    
    headers.forEach((header, colIndex) => {
      const sampleData = rows.slice(0, Math.min(10, rows.length)).map(row => row[colIndex]);
      const contentType = classifyColumnContent(sampleData);
      
      const fieldScores: Record<string, number> = {};
      Object.keys(FIELD_KEYWORDS).forEach(fieldName => {
        const confidence = scoreColumnMatch(header, sampleData, fieldName);
        fieldScores[fieldName] = confidence;
        
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
      
      columnAnalysis.push({
        index: colIndex,
        header,
        contentType,
        topScores: Object.entries(fieldScores)
          .filter(([_, score]) => score > 0)
          .sort(([_, a], [__, b]) => b - a)
          .slice(0, 3)
          .map(([field, score]) => `${field}(${score})`)
          .join(', ') || 'no matches'
      });
    });
    
    console.log('\n📊 Column Analysis Summary:');
    columnAnalysis.forEach(col => {
      console.log(`  Col ${col.index} "${col.header}": Type=${col.contentType}, Scores=${col.topScores}`);
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
    // But also use companyName or businessName if that's the only name column available
    if (finalMappings.firstName !== undefined && finalMappings.lastName !== undefined) {
      console.log('✅ Detected First Name + Last Name columns - will combine them');
      delete finalMappings.fullName;
      delete finalMappings.companyName;
    } else if (finalMappings.firstName !== undefined) {
      console.log('✅ Detected First Name only');
      delete finalMappings.fullName;
      delete finalMappings.companyName;
    } else if (finalMappings.lastName !== undefined) {
      console.log('✅ Detected Last Name only');
      delete finalMappings.fullName;
      delete finalMappings.companyName;
    } else if (finalMappings.fullName === undefined && finalMappings.companyName !== undefined) {
      // Use companyName as fullName if no fullName detected
      console.log('✅ Using Company/Business Name column as Full Name');
      finalMappings.fullName = finalMappings.companyName;
      delete finalMappings.companyName;
    }
    
    console.log('\n✅ Final Field Mappings:');
    Object.entries(finalMappings).forEach(([field, colIdx]) => {
      console.log(`  ${field} ← Column ${colIdx} "${headers[colIdx]}"`);
    });
    
    // Warning if fullName not detected
    if (finalMappings.fullName === undefined && finalMappings.firstName === undefined) {
      console.warn('\n⚠️ WARNING: Full Name field not detected!');
      console.warn('Available columns:', headers);
      console.warn('Suggestion: Check if column contains person names vs job titles/categories');
    }
    
    console.log('=== END COLUMN DETECTION ===\n');
    
    return { mappings: finalMappings, suggestions: suggestions.filter(s => finalMappings[s.fieldName] === s.columnIndex) };
  }, [scoreColumnMatch]);

  const parsePDFToTable = useCallback(async (file: File): Promise<any[][]> => {
    try {
      const arrayBuffer = await file.arrayBuffer();
      
      // Try to extract text using TextDecoder with multiple strategies
      let text = '';
      
      // Strategy 1: Direct UTF-8 decode (works for simple PDFs)
      try {
        const decoder = new TextDecoder('utf-8');
        text = decoder.decode(arrayBuffer);
      } catch (e) {
        console.warn('UTF-8 decode failed, trying raw extraction');
      }
      
      // Strategy 2: Raw byte extraction (more reliable for various PDF formats)
      if (text.length < 100) {
        const uint8Array = new Uint8Array(arrayBuffer);
        let extracted = '';
        let inTextBlock = false;
        
        for (let i = 0; i < uint8Array.length - 2; i++) {
          const byte = uint8Array[i];
          
          // Detect text blocks: BT (Begin Text) and ET (End Text) markers
          if (byte === 66 && uint8Array[i+1] === 84 && uint8Array[i+2] === 32) { // "BT "
            inTextBlock = true;
            i += 2;
            continue;
          }
          if (byte === 69 && uint8Array[i+1] === 84 && (uint8Array[i+2] === 32 || uint8Array[i+2] === 10)) { // "ET " or "ET\n"
            inTextBlock = false;
            extracted += '\n';
            i += 2;
            continue;
          }
          
          // Extract printable ASCII characters
          if (byte >= 32 && byte <= 126) {
            extracted += String.fromCharCode(byte);
          } else if (byte === 10 || byte === 13) { // newline/carriage return
            extracted += '\n';
          } else if (byte === 9) { // tab
            extracted += '\t';
          }
        }
        
        text = extracted;
      }
      
      console.log('📄 PDF text extraction length:', text.length);
      console.log('📄 Sample extracted text:', text.substring(0, 800));
      
      if (text.length < 50) {
        throw new Error('PDF appears to be empty or contains only images. Please convert to Excel/CSV format.');
      }
      
      // Parse text into lines
      const allLines = text.split(/[\n\r]+/).map(l => l.trim()).filter(l => l.length > 2);
      console.log('📄 Total lines extracted:', allLines.length);
      
      // Find header row with common CRM keywords
      const headerKeywords = ['name', 'phone', 'email', 'business', 'contact', 'address', 'city', 'state', 'website'];
      let headerIndex = -1;
      let maxKeywordMatches = 0;
      
      for (let i = 0; i < Math.min(20, allLines.length); i++) {
        const lowerLine = allLines[i].toLowerCase();
        const matches = headerKeywords.filter(kw => lowerLine.includes(kw)).length;
        if (matches > maxKeywordMatches && matches >= 2) {
          maxKeywordMatches = matches;
          headerIndex = i;
        }
      }
      
      if (headerIndex === -1) {
        console.warn('📄 No clear header found, using first line');
        headerIndex = 0;
      }
      
      console.log('📄 Using header at line', headerIndex, ':', allLines[headerIndex]);
      
      // Parse header
      const headerLine = allLines[headerIndex];
      let headers = headerLine.split(/\t|  {2,}/).map(h => h.trim()).filter(h => h && h.length > 1);
      
      // If splitting by spaces doesn't work well, try other delimiters
      if (headers.length < 2) {
        // Try splitting by common delimiters
        const delimiters = [/\s{3,}/, /\|/, /;/, /,\s+/];
        for (const delimiter of delimiters) {
          const tryHeaders = headerLine.split(delimiter).map(h => h.trim()).filter(h => h && h.length > 1);
          if (tryHeaders.length >= 2) {
            headers = tryHeaders;
            break;
          }
        }
      }
      
      console.log('📄 Parsed', headers.length, 'headers:', headers);
      
      if (headers.length < 2) {
        throw new Error(`Could not detect table columns in PDF. Found only ${headers.length} column(s). PDF tables often lose their structure during text extraction. For reliable import, please:\n\n1. Open the PDF and copy the table\n2. Paste into Excel/Google Sheets\n3. Save as .xlsx or .csv\n4. Upload the Excel/CSV file here`);
      }
      
      // Build table data
      const tableData: string[][] = [headers];
      
      // Parse data rows
      const dataStartIndex = headerIndex + 1;
      for (let i = dataStartIndex; i < allLines.length; i++) {
        const line = allLines[i];
        
        // Skip separator lines or very short lines
        if (/^[=\-_\s|.]+$/.test(line) || line.length < 5) continue;
        
        // Try to split using same approach as headers
        let cells = line.split(/\t|  {2,}/).map(c => c.trim());
        
        // Filter out empty cells but keep the structure
        if (cells.filter(c => c).length < 1) continue;
        
        // Ensure row matches header length (pad or trim)
        while (cells.length < headers.length) cells.push('');
        if (cells.length > headers.length) cells.length = headers.length;
        
        tableData.push(cells);
      }
      
      console.log('📄 Extracted', tableData.length - 1, 'data rows from PDF');
      console.log('📄 First data row:', tableData[1]);
      
      if (tableData.length <= 1) {
        throw new Error('Could not extract data rows from PDF. Please convert to Excel (.xlsx) or CSV (.csv) format.');
      }
      
      return tableData;
      
    } catch (error) {
      console.error('📄 PDF parse error:', error);
      if (error instanceof Error && error.message.includes('Could not')) {
        throw error;
      }
      throw new Error('Failed to parse PDF. For best results, convert your PDF to Excel (.xlsx) or CSV (.csv) format before importing.');
    }
  }, []);

  const parseExcelFile = useCallback(async (file: File): Promise<ParsedData> => {
    console.log('=== EXCEL IMPORT START ===');
    console.log('File:', file.name, 'Size:', file.size);
    setIsProcessing(true);
    try {
      // Excel/CSV handling only
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
