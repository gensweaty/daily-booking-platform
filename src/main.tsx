import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'

// Polyfill for mobile drag and drop support
import { polyfill } from 'mobile-drag-drop';
import { scrollBehaviourDragImageTranslateOverride } from 'mobile-drag-drop/scroll-behaviour';

// Initialize mobile drag-drop polyfill with optimized settings
polyfill({
  dragImageTranslateOverride: scrollBehaviourDragImageTranslateOverride,
  holdToDrag: 150, // Reduced from 200ms for faster response
  iterationInterval: 50, // Increased update frequency for smoother dragging
  dragImageCenterOnTouch: true, // Center drag image on touch point
});

// Fix for iOS Safari >= 10 to prevent default touch behavior
try {
  window.addEventListener('touchmove', () => {}, { passive: false });
} catch (e) {
  console.warn('Touch event listener not supported');
}

createRoot(document.getElementById("root")!).render(<App />);
