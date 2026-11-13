import {normalizeExtensionAddress420,normalizeExtensionChain420} from './extension-wallet-ui.js';
export const EXTENSION_ADDRESS_BOOK_KEY_420='420-wallet-address-book-v1';
export function normalizeExtensionContact420(contact){
  if(!contact||typeof contact!=='object'||Array.isArray(contact))throw new Error('contact required');
  const label=String(contact.label??'').trim();
  if(!label||label.length>48||/[\x00-\x1f\x7f]/.test(label))throw new Error('contact label must be 1–48 printable characters');
  return {label,address:normalizeExtensionAddress420(contact.address),chainId:normalizeExtensionChain420(contact.chainId)};
}
export function normalizeExtensionAddressBook420(value){
  if(!Array.isArray(value))return [];
  const unique=new Map();
  for(const contact of value.slice(0,200)){
    try{
      const c=normalizeExtensionContact420(contact);
      unique.set(c.chainId+':'+c.address,c);
      if(unique.size>=100)break;
    }catch{}
  }
  return [...unique.values()];
}
export function addExtensionContact420(book,contact){
  const c=normalizeExtensionContact420(contact);
  const existing=normalizeExtensionAddressBook420(book);
  const remaining=existing.filter(x=>x.chainId!==c.chainId||x.address!==c.address);
  if(remaining.length>=100)throw new Error('address book is full');
  return [...remaining,c].sort((a,b)=>a.label.localeCompare(b.label));
}
export function removeExtensionContact420(book,{address,chainId}={}){
  const a=normalizeExtensionAddress420(address),chain=normalizeExtensionChain420(chainId);
  return normalizeExtensionAddressBook420(book).filter(x=>x.address!==a||x.chainId!==chain);
}
