import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { registerServiceWorker } from './registerSW'

// Register service worker for PWA and push notifications
if ('serviceWorker' in navigator) {
  registerServiceWorker().catch(console.error);
}

createRoot(document.getElementById("root")!).render(<App />);
