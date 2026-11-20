// Presentation only: a symbol is not an asset identifier or execution authority.
// Never derive a network URL or filesystem path from untrusted metadata.
const ICONS=Object.freeze({
  '420':'420.png',USD:'usd.png',ETH:'eth.png',EBTC:'ebtc.png',EBOB:'ebob.png',
  EARRR:'earrr.png',EPOT:'epot.png',ECURE:'ecure.png',ELTC:'eltc.png',
  EDOGE:'edoge.png',EXRP:'exrp.png',ETRX:'etrx.png',EBNB:'ebnb.png',
});
export const TOKEN_ICON_FILES=Object.freeze(Object.values(ICONS).map(file=>'assets/tokens/'+file));
export function tokenIconPath(symbol){
  if(typeof symbol!=='string')return null;
  const key=symbol.trim().toUpperCase();
  return Object.hasOwn(ICONS,key)?'./assets/tokens/'+ICONS[key]:null;
}
export function createTokenIcon(documentRef,symbol){
  const icon=documentRef.createElement('span');
  icon.className='token-icon';icon.setAttribute('aria-hidden','true');
  const fallback=documentRef.createElement('span');fallback.className='token-icon-fallback';
  fallback.textContent=typeof symbol==='string'&&symbol.trim()?symbol.trim().slice(0,5):'—';
  icon.append(fallback);
  const src=tokenIconPath(symbol);
  if(src){
    const img=documentRef.createElement('img');
    img.alt='';img.width=40;img.height=40;img.decoding='async';
    img.addEventListener('error',()=>{img.hidden=true;fallback.hidden=false;},{once:true});
    fallback.hidden=true;icon.append(img);img.src=src;
  }
  return icon;
}
export function createTokenPairIcons(documentRef,base,quote){
  const group=documentRef.createElement('span');
  group.className='token-pair-icons';group.setAttribute('aria-hidden','true');
  if(typeof base==='string'&&base.trim())group.append(createTokenIcon(documentRef,base));
  if(typeof quote==='string'&&quote.trim())group.append(createTokenIcon(documentRef,quote));
  return group;
}
