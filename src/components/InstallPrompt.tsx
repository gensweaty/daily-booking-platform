import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Download, X } from 'lucide-react';
import { isPushSupported } from '@/registerSW';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
      return;
    }

    // Detect iOS
    const iOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    setIsIOS(iOS);

    // Check if user previously dismissed
    const dismissed = localStorage.getItem('pwa-install-dismissed');
    if (dismissed) {
      const dismissedTime = parseInt(dismissed);
      const daysSinceDismissed = (Date.now() - dismissedTime) / (1000 * 60 * 60 * 24);
      if (daysSinceDismissed < 7) {
        return; // Don't show again for 7 days
      }
    }

    // Listen for install prompt (Android/Desktop)
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setShowPrompt(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // On iOS, show manual instructions after a delay
    if (iOS && !dismissed) {
      const timer = setTimeout(() => setShowPrompt(true), 5000);
      return () => clearTimeout(timer);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const choiceResult = await deferredPrompt.userChoice;

    if (choiceResult.outcome === 'accepted') {
      console.log('[Install] User accepted the install prompt');
      setShowPrompt(false);
    }

    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    localStorage.setItem('pwa-install-dismissed', Date.now().toString());
    setShowPrompt(false);
  };

  if (isInstalled || !showPrompt || !isPushSupported()) {
    return null;
  }

  return (
    <Alert className="fixed bottom-4 right-4 max-w-md shadow-lg z-50 border-primary/20">
      <div className="flex items-start gap-3">
        <Download className="h-5 w-5 text-primary mt-0.5" />
        <div className="flex-1 space-y-2">
          <AlertDescription>
            {isIOS ? (
              <>
                <strong>Install Smartbookly</strong>
                <p className="text-sm mt-1">
                  Get mobile notifications! Tap <strong>Share</strong> → <strong>Add to Home Screen</strong>
                </p>
              </>
            ) : (
              <>
                <strong>Install Smartbookly</strong>
                <p className="text-sm mt-1">
                  Install our app for mobile push notifications and offline access
                </p>
              </>
            )}
          </AlertDescription>
          <div className="flex gap-2">
            {!isIOS && deferredPrompt && (
              <Button onClick={handleInstallClick} size="sm" variant="default">
                Install
              </Button>
            )}
            <Button onClick={handleDismiss} size="sm" variant="outline">
              {isIOS ? 'Got it' : 'Later'}
            </Button>
          </div>
        </div>
        <Button
          onClick={handleDismiss}
          size="icon"
          variant="ghost"
          className="h-6 w-6 -mt-1"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </Alert>
  );
}