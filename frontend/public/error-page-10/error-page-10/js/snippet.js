/*!
 * error-page-10 - Colorlib. No jQuery, no framework.
 * Behaviours: own-script
 */
/* The page's own script, unchanged: it never needed jQuery. */
(() => {
  'use strict';

  const root = document.querySelector('[data-offline-page]');
  if (!root) return;

  
  const initConnection = () => {
    const indicatorText = root.querySelector('[data-indicator-text]');
    const title = root.querySelector('[data-title]');
    const text = root.querySelector('[data-text]');
    const retry = root.querySelector('[data-retry]');
    const retryLabel = root.querySelector('[data-retry-label]');
    const result = root.querySelector('[data-result]');
    if (!indicatorText || !retry) return;

    const copy = {
      offline: {
        indicator: 'Offline',
        title: 'You’re offline',
        text: 'Notewell can’t reach the internet right now. Check your Wi-Fi or mobile data. Anything you write keeps saving on this device and syncs when you reconnect.',
        button: 'Try again',
      },
      online: {
        indicator: 'Back online',
        title: 'You’re back online',
        text: 'Your connection is back and your 3 waiting changes are syncing now. Reload to pick up where you left off.',
        button: 'Reload page',
      },
    };
    let online = root.dataset.demo === 'offline' ? false : navigator.onLine;

    const render = () => {
      const c = online ? copy.online : copy.offline;
      root.classList.toggle('is-online', online);
      indicatorText.textContent = c.indicator;
      title.textContent = c.title;
      text.textContent = c.text;
      retryLabel.textContent = c.button;
    };

    window.addEventListener('online', () => { online = true; result.textContent = ''; render(); });
    window.addEventListener('offline', () => { online = false; result.textContent = 'Connection lost. We will reconnect automatically.'; render(); });

    retry.addEventListener('click', () => {
      if (online) { window.location.reload(); return; }
      if (retry.getAttribute('aria-busy') === 'true') return;
      retry.setAttribute('aria-busy', 'true');
      retryLabel.textContent = 'Checking…';
      result.textContent = '';
      
      window.setTimeout(() => {
        retry.removeAttribute('aria-busy');
        if (navigator.onLine) {
          online = true;
          result.textContent = 'Connected. Reload whenever you are ready.';
        } else {
          result.textContent = 'Still offline. This page will update by itself when you reconnect.';
        }
        render();
      }, 800);
    });

    render();
  };

  initConnection();
})();

