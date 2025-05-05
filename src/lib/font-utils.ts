
import { CSSProperties } from 'react';

/**
 * Returns consistent Georgian font styling with proper TypeScript typing
 */
export const getGeorgianFontStyle = (): CSSProperties => ({
  fontFamily: "'BPG Glaho WEB Caps', 'DejaVu Sans', 'Arial Unicode MS', sans-serif",
  letterSpacing: '-0.2px',
  WebkitFontSmoothing: 'antialiased',
  MozOsxFontSmoothing: 'grayscale',
  textRendering: 'optimizeLegibility' as const,
  fontWeight: 'normal',  // Explicitly set normal weight to prevent inconsistencies
  fontFeatureSettings: '"case" 0', // Disable case-sensitive forms to fix first letter issues
  fontVariationSettings: '"wght" 400', // Ensure consistent weight
  textTransform: 'none' as const // Type assertion to match CSS property type
});

/**
 * Special version for form fields and buttons to ensure consistent rendering
 */
export const getGeorgianInputStyle = (): CSSProperties => ({
  ...getGeorgianFontStyle(),
  fontFeatureSettings: '"case" 0', // Disable case-sensitive forms
  fontVariationSettings: '"wght" 400', // Ensure consistent weight
  textTransform: 'none' as const // Type assertion to match CSS property type
});
