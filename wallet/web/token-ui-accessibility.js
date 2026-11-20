// UI-only focus and status helpers. Never grants Wallet authority or retries.
export function tokenStatus420(node){node.setAttribute('role','status');node.setAttribute('aria-live','polite');node.setAttribute('aria-atomic','true');node.tabIndex=-1;return node;}
export function setTokenStatus420(node,message,state='idle'){
  // Keep error text inert; strip direction/control characters from RPC diagnostics.
  const safe=String(message??'').replace(/[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/gu,' ');
  node.dataset.state=state;if(node.textContent!==safe)node.textContent=safe;
}
export function focusToken420(node){if(node?.isConnected&&!node.closest('[hidden]')&&!node.disabled){node.focus();return document.activeElement===node;}return false;}
export function tokenHidingFocus420(region,fallback){if(region.contains(document.activeElement))focusToken420(fallback);}
export async function runTokenAction420(trigger,status,operation,destination=()=>null){
  // Move keyboard focus before the native button becomes disabled. Do not
  // steal it back if the user moves elsewhere while the request is pending.
  if(document.activeElement===trigger)focusToken420(status);
  try{return await operation();}
  finally{if(document.activeElement===status){const next=destination();if(next)focusToken420(next);}}
}
export function tokenFieldError420(input,status,invalid){
  if(invalid){input.setAttribute('aria-invalid','true');input.setAttribute('aria-errormessage',status.id);}
  else{input.removeAttribute('aria-invalid');input.removeAttribute('aria-errormessage');}
}
