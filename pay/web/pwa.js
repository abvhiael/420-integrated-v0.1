export function installPayApp() {
  if (window.self !== window.top) return;
  const button = document.getElementById('install-pay');
  let install;
  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault();
    install = event;
    button.hidden = false;
  });
  button.addEventListener('click', async () => {
    const pending = install;
    install = undefined;
    button.hidden = true;
    try { await pending?.prompt(); } catch {}
  });
  window.addEventListener('appinstalled', () => {
    install = undefined;
    button.hidden = true;
  });
  if ('serviceWorker' in navigator && window.isSecureContext) {
    void navigator.serviceWorker.register(new URL('./service-worker.js', location.href), { updateViaCache: 'none' })
      .catch(() => {});
  }
}
