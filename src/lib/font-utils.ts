
/**
 * Returns standardized Georgian font styling for consistent rendering
 */
export const getGeorgianFontStyle = () => ({
  fontFamily: "'BPG Glaho WEB Caps', 'DejaVu Sans', 'Arial Unicode MS', sans-serif",
  letterSpacing: '-0.2px',
  fontWeight: 'normal',
  WebkitFontSmoothing: 'antialiased',
  MozOsxFontSmoothing: 'grayscale',
  textRendering: 'optimizeLegibility' as const
});

/**
 * Returns enhanced Georgian font styling with additional options
 */
export const getEnhancedGeorgianFontStyle = (options?: { 
  fontWeight?: 'normal' | 'bold' | 'semibold' | 'medium';
  letterSpacing?: string;
}) => {
  const fontWeightValue = 
    options?.fontWeight === 'bold' ? 'bold' : 
    options?.fontWeight === 'semibold' ? '600' :
    options?.fontWeight === 'medium' ? '500' :
    'normal';
    
  return {
    ...getGeorgianFontStyle(),
    fontWeight: fontWeightValue,
    letterSpacing: options?.letterSpacing || '-0.2px'
  };
};
