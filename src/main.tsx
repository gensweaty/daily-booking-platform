import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'

// Polyfill for mobile drag and drop support
import { polyfill } from 'mobile-drag-drop';
import { scrollBehaviourDragImageTranslateOverride } from 'mobile-drag-drop/scroll-behaviour';

// Initialize mobile drag-drop polyfill with scroll behavior
polyfill({
  dragImageTranslateOverride: scrollBehaviourDragImageTranslateOverride,
  // Optional: customize drag image
  holdToDrag: 200, // ms to hold before drag starts
  iterationInterval: 150, // Update frequency during drag
});

// Fix for iOS Safari >= 10 to prevent default touch behavior
try {
  window.addEventListener('touchmove', () => {}, { passive: false });
} catch (e) {
  console.warn('Touch event listener not supported');
}

createRoot(document.getElementById("root")!).render(<App />);
