
/**
 * Returns standardized Georgian font styling for consistent rendering
 */
export const getGeorgianFontStyle = () => ({
  fontFamily: "'BPG Glaho WEB Caps', 'DejaVu Sans', 'Arial Unicode MS', sans-serif",
  letterSpacing: '-0.2px',
  WebkitFontSmoothing: 'antialiased',
  MozOsxFontSmoothing: 'grayscale',
  textRendering: 'optimizeLegibility' as const
});
