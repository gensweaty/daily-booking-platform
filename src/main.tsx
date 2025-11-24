import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'

// Polyfill for mobile drag and drop support
import { polyfill } from 'mobile-drag-drop';

// Initialize mobile drag-drop polyfill with simplified settings
polyfill({
  holdToDrag: 100, // Quick response time
  dragImageCenterOnTouch: true, // Center drag image on touch point
});

createRoot(document.getElementById("root")!).render(<App />);
