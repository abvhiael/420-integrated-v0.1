import { securityPanelAvailability420, securityIdentityLabel420 } from './core/security-centre.js';
// Presentation-only observer. All authorization and signing remain in existing Wallet Core.
const centre = document.getElementById('security-centre');
if (centre) {
  const set = (id,value) => { const node=document.getElementById(id); if(node && node.textContent!==value) node.textContent=value; };
  const features = [['capability-panel','security-capabilities-status'],['session-panel','security-sessions-status'],['passkey-panel','security-passkeys-status'],['recovery-panel','security-recovery-status']];
  function render() {
    set('security-controller',securityIdentityLabel420(document.getElementById('account')?.textContent,'Not connected'));
    set('security-account',securityIdentityLabel420(document.getElementById('smart-account')?.textContent,'Not discovered'));
    const account=document.getElementById('dashboard-account-state')?.textContent;
    set('security-authority-status',account && account!=='Not connected' ? account+' · network verification separate' : 'Not verified');
    for(const [panelId,statusId] of features) {
      const panel=document.getElementById(panelId),badge=document.getElementById(statusId);
      if(!badge) continue;
      const result=securityPanelAvailability420(Boolean(panel),panel?.hidden!==false);
      if(badge.textContent!==result.label) badge.textContent=result.label;
      if(badge.dataset.state!==result.state) badge.dataset.state=result.state;
    }
  }
  new MutationObserver(render).observe(document.querySelector('.shell'),{subtree:true,childList:true,attributes:true,attributeFilter:['hidden']});
  render();
}
