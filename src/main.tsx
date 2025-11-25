import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'

// Polyfill for mobile drag and drop support
import { polyfill } from 'mobile-drag-drop';

// Initialize mobile drag-drop polyfill with performance-optimized settings
polyfill({
  holdToDrag: 150, // Balanced response time
  dragImageCenterOnTouch: true,
  // Disable default drag image for better performance
  dragImageTranslateOverride: () => ({ x: 0, y: 0 })
});

createRoot(document.getElementById("root")!).render(<App />);
