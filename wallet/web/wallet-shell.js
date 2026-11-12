/** Shell interactions are presentation-only. Authorization remains in Wallet Core. */
const controls = [...document.querySelectorAll('[data-scroll-target]')];
function canNavigate(button) {
  const target = document.querySelector(button.dataset.scrollTarget);
  return Boolean(target && !target.hidden);
}
function syncNavigation() {
  for (const button of controls) {
    const allowed = canNavigate(button);
    button.disabled = !allowed;
    if (!allowed) button.removeAttribute('aria-current');
  }
}
for (const button of controls) {
  button.addEventListener('click', () => {
    if (!canNavigate(button)) return;
    for (const item of document.querySelectorAll('.sidebar .nav-item')) {
      const active = item.dataset.scrollTarget === button.dataset.scrollTarget;
      item.classList.toggle('active', active);
      if (active) item.setAttribute('aria-current', 'page');
      else item.removeAttribute('aria-current');
    }
  });
}
const observer = new MutationObserver(syncNavigation);
observer.observe(document.querySelector('.shell'), { attributes: true, attributeFilter: ['hidden'], subtree: true, childList: true });
syncNavigation();
