(() => {
  const notice = document.getElementById('systemNotice');
  const text = document.getElementById('systemNoticeText');
  const retry = document.getElementById('systemNoticeRetry');
  const close = document.getElementById('systemNoticeClose');
  if (!notice || !text) return;

  const show = (message) => {
    text.textContent = message;
    notice.hidden = false;
  };

  retry?.addEventListener('click', () => window.location.reload());
  close?.addEventListener('click', () => { notice.hidden = true; });

  window.addEventListener('error', (event) => {
    // Ignore resource-load errors: optional remote analytics/Three.js can fail
    // without taking down the rest of the portfolio.
    if (event.target && event.target !== window) return;
    console.error('Portfolio runtime error:', event.message || 'Unknown script error');
    show('A page feature encountered a problem. The rest of the portfolio is still available. Refresh to retry.');
  });

  window.addEventListener('unhandledrejection', (event) => {
    console.error('Portfolio async error:', event.reason || 'Unknown async error');
    show('A background feature could not finish loading. Your project links and resume remain available.');
  });

  window.addEventListener('offline', () => {
    show('You are offline. Previously cached pages and files remain available; the contact form needs a connection.');
  });
})();
