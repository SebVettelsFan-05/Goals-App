import { useEffect, useState } from 'react';

// Drives the "Add to Home Screen" experience.
// - Android/desktop Chrome: captures beforeinstallprompt so we can trigger the
//   native install dialog from our own button.
// - iOS Safari: no such event, so we surface the manual Share-sheet steps.
export function useInstall() {
  const isStandalone =
    (typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(display-mode: standalone)').matches) ||
    window.navigator.standalone === true;

  const [installed, setInstalled] = useState(isStandalone);
  const [promptEvent, setPromptEvent] = useState(null);

  useEffect(() => {
    const onPrompt = (e) => {
      e.preventDefault();
      setPromptEvent(e);
    };
    const onInstalled = () => {
      setInstalled(true);
      setPromptEvent(null);
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const ua = navigator.userAgent || '';
  const isIOS = /iphone|ipad|ipod/i.test(ua) && !window.MSStream;

  const promptInstall = async () => {
    if (!promptEvent) return false;
    promptEvent.prompt();
    const { outcome } = await promptEvent.userChoice;
    setPromptEvent(null);
    return outcome === 'accepted';
  };

  return { installed, canPrompt: !!promptEvent, isIOS, promptInstall };
}
