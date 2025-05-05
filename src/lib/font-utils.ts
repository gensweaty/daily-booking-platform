
import { CSSProperties } from 'react';

/**
 * Returns consistent Georgian font styling with proper TypeScript typing
 */
export const getGeorgianFontStyle = (): CSSProperties => ({
  fontFamily: "'BPG Glaho WEB Caps', 'DejaVu Sans', 'Arial Unicode MS', sans-serif",
  letterSpacing: '-0.2px',
  WebkitFontSmoothing: 'antialiased',
  MozOsxFontSmoothing: 'grayscale',
  textRendering: 'optimizeLegibility' as const
});

/**
 * Specific function to ensure Georgian button text renders correctly
 * Particularly fixing the first letter font issue
 */
export const getGeorgianButtonStyle = (): CSSProperties => ({
  fontFamily: "'BPG Glaho WEB Caps', 'DejaVu Sans', 'Arial Unicode MS', sans-serif",
  letterSpacing: '-0.2px',
  WebkitFontSmoothing: 'antialiased',
  MozOsxFontSmoothing: 'grayscale',
  textRendering: 'optimizeLegibility' as const,
  fontFeatureSettings: 'normal',
  fontVariant: 'normal'
});
