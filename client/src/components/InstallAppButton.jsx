import { useEffect, useState } from 'react';
import { Download, X } from 'lucide-react';

let deferredPrompt = null;
let installed = typeof window !== 'undefined' && (
  window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true
);
const isAppleMobile = typeof navigator !== 'undefined' && (
  /iPhone|iPad|iPod/i.test(navigator.userAgent)
  || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
);
const subscribers = new Set();

function notifySubscribers() {
  subscribers.forEach((notify) => notify({ canPrompt: Boolean(deferredPrompt), installed }));
}

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferredPrompt = event;
    notifySubscribers();
  });

  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    installed = true;
    notifySubscribers();
  });
}

export default function InstallAppButton({ className = '' }) {
  const [installState, setInstallState] = useState({ canPrompt: Boolean(deferredPrompt), installed });
  const [helpOpen, setHelpOpen] = useState(false);
  const installLabel = installState.canPrompt
    ? 'Install OmniInbox now'
    : isAppleMobile
      ? 'How to install OmniInbox on iPhone or iPad'
      : 'Show how to install OmniInbox';

  useEffect(() => {
    const update = (state) => setInstallState(state);
    subscribers.add(update);
    update({ canPrompt: Boolean(deferredPrompt), installed });
    return () => {
      subscribers.delete(update);
    };
  }, []);

  async function install() {
    if (!deferredPrompt) {
      setHelpOpen((open) => !open);
      return;
    }

    const promptEvent = deferredPrompt;
    deferredPrompt = null;
    notifySubscribers();
    setHelpOpen(false);

    try {
      await promptEvent.prompt();
      const choice = await promptEvent.userChoice;
      if (choice?.outcome === 'dismissed') setHelpOpen(true);
    } catch {
      setHelpOpen(true);
    }
  }

  if (installState.installed) return null;

  return (
    <div className={`install-app-control ${className}`.trim()}>
      <button
        type="button"
        className="icon-button install-app-button"
        aria-label={installLabel}
        title={installState.canPrompt ? 'Install OmniInbox' : 'Install instructions'}
        aria-expanded={helpOpen}
        aria-haspopup="dialog"
        onClick={install}
      >
        <Download size={18} />
      </button>
      {helpOpen && (
        <div className="install-app-popover" role="dialog" aria-label="Install OmniInbox">
          <button className="install-app-close" type="button" aria-label="Close install instructions" onClick={() => setHelpOpen(false)}><X size={15} /></button>
          {isAppleMobile ? <>
            <strong>Add OmniInbox to your Home Screen</strong>
            <ol className="install-app-steps">
              <li>Open this page in Safari. If it opened inside another app, use its menu to open it in Safari.</li>
              <li>Tap Safari’s <b>Share</b> button.</li>
              <li>Scroll down and tap <b>Add to Home Screen</b>.</li>
              <li>Turn on <b>Open as Web App</b>, then tap <b>Add</b>.</li>
            </ol>
            <p>Apple requires these steps; a website can’t open the installation menu for you.</p>
          </> : <>
            <strong>Install OmniInbox</strong>
            <p>Choose <b>Install app</b> or <b>Add to Home Screen</b> from your browser menu.</p>
          </>}
        </div>
      )}
    </div>
  );
}
