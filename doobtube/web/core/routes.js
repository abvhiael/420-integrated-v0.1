const ROUTES=['home','search','watch','creator','library','upload','live','subscriptions','moderation','data','status'];
export function parseRoute(hash=''){
  const raw=String(hash||'').replace(/^#/,'').replace(/^\//,'');
  const parts=raw.split('/').filter(Boolean).map(decodeURIComponent);
  const name=ROUTES.includes(parts[0])?parts[0]:'home';
  return {name,param:parts[1]||''};
}
export function href(name,param=''){return '#/'+name+(param?'/'+encodeURIComponent(param):'');}
export {ROUTES};
