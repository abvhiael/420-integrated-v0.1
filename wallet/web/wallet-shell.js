/** Presentation-only sidebar state. Dynamic wallet panels can register new nav controls. */
const nav=document.querySelector('.sidebar nav');
function canNavigate(button) {
  const selector=button?.dataset?.scrollTarget;
  if (!selector || !/^#[A-Za-z][\w:-]*$/.test(selector)) return false;
  const target=document.querySelector(selector);
  return Boolean(target && !target.hidden && !target.closest('[hidden]'));
}
function syncNavigation() {
  if(!nav) return;
  for (const button of nav.querySelectorAll('[data-scroll-target]')) {
    const allowed=canNavigate(button);
    button.disabled=!allowed;
    if(!allowed) {
      button.classList.remove('active');
      button.removeAttribute('aria-current');
    }
  }
}
if(nav){
  nav.addEventListener('click',event=>{
    const button=event.target.closest('[data-scroll-target]');
    if(!button || !nav.contains(button) || !canNavigate(button))return;
    for(const peer of nav.querySelectorAll('[data-scroll-target]')){
      const selected=peer===button;
      peer.classList.toggle('active',selected);
      if(selected)peer.setAttribute('aria-current','location');
      else peer.removeAttribute('aria-current');
    }
  });
  const root=document.querySelector('.shell');
  if(root){
    new MutationObserver(syncNavigation).observe(root,{attributes:true,attributeFilter:['hidden'],subtree:true,childList:true});
  }
  new MutationObserver(syncNavigation).observe(nav,{childList:true,subtree:true});
  syncNavigation();
}
