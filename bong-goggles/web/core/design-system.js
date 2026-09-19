function esc(value){
  return String(value??'')
    .replaceAll('&','&amp;')
    .replaceAll('<','&lt;')
    .replaceAll('>','&gt;')
    .replaceAll('"','&quot;')
    .replaceAll("'",'&#39;');
}

export function button({label,action,variant='primary',disabled=false,type='button'}={}){
  return `<button type="${esc(type)}" class="ui-button ui-button--${esc(variant)}" data-action="${esc(action)}" ${disabled?'disabled':''}>${esc(label)}</button>`;
}

export function linkButton({label,href='#',variant='secondary',attrs=''}={}){
  return `<a class="ui-button ui-button--${esc(variant)}" href="${esc(href)}" ${attrs}>${esc(label)}</a>`;
}

export function card({title,body='',eyebrow='',footer='',className=''}={}){
  return `<section class="ui-card ${esc(className)}">
    ${eyebrow?`<p class="eyebrow">${esc(eyebrow)}</p>`:''}
    ${title?`<h2>${esc(title)}</h2>`:''}
    <div class="ui-card__body">${body}</div>
    ${footer?`<footer class="ui-card__footer">${footer}</footer>`:''}
  </section>`;
}

export function emptyState({title='Nothing here yet',message='',action=''}={}){
  return `<div class="ui-empty" role="status"><strong>${esc(title)}</strong><p>${esc(message)}</p>${action}</div>`;
}

export function errorState({title='Something went wrong',message='',action=''}={}){
  return `<div class="ui-error" role="alert"><strong>${esc(title)}</strong><p>${esc(message)}</p>${action}</div>`;
}

export function skeleton({lines=3}={}){
  const count=Math.max(1,Math.min(8,Number(lines)||3));
  return `<div class="ui-skeleton" aria-label="Loading">${Array.from({length:count},(_,i)=>`<span style="--i:${i}"></span>`).join('')}</div>`;
}

export function tabs(items=[],activeId){
  return `<div class="ui-tabs" role="tablist">${items.map(item=>`<button role="tab" aria-selected="${item.id===activeId}" class="ui-tab" data-tab="${esc(item.id)}">${esc(item.label)}</button>`).join('')}</div>`;
}

export function canonicalHandoffs({walletHref,explorerHref}={}){
  return `<div class="canonical-handoffs" aria-label="Canonical tools">
    ${walletHref?linkButton({label:'Open 420Wallet',href:walletHref,attrs:'rel="noopener noreferrer"'}):''}
    ${explorerHref?linkButton({label:'View in 420Explorer',href:explorerHref,variant:'ghost',attrs:'rel="noopener noreferrer"'}):''}
  </div>`;
}

export function toast({message,tone='info'}={}){
  return `<div class="ui-toast ui-toast--${esc(tone)}" role="status">${esc(message)}</div>`;
}

export {esc as escapeHtml};
