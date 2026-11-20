// ERC20 wizard: exact quantities, canonical drafts and read-only verification.
import {TOKEN_TEMPLATES_420,encodeTokenCreation420,tokenWord420} from './token-sdk.js';
import {createTokenCreationWizard420,generateTokenCreationSalt420,validateTokenWizardMetadata420 as metadata} from './token-creation-wizard.js';
const UNIT=10n**18n;
const fields=['name','symbol','supply','cap','userSalt'];
const profiles=new Map(TOKEN_TEMPLATES_420.filter(p=>p.standard==='ERC20').map(p=>[p.key,p]));
const check=(ok,message)=>{if(!ok)throw Error(message);};
export function parseERC20Units420(value){
  check(typeof value==='string'&&value.length<=80&&/^[0-9]+(?:\.[0-9]{1,18})?$/.test(value),
    'Enter a nonnegative decimal amount with at most 18 fractional digits (no exponents or separators).');
  const [whole,fraction='']=value.split('.');
  const amount=BigInt(whole)*UNIT+BigInt(fraction.padEnd(18,'0'));
  tokenWord420(amount);return amount.toString();
}
export function formatERC20Units420(value){
  const amount=BigInt('0x'+tokenWord420(value));
  const fraction=(amount%UNIT).toString().padStart(18,'0').replace(/0+$/,'');
  return (amount/UNIT).toString()+(fraction?'.'+fraction:'');
}
export function validateERC20WizardFields420(key,input){
  const profile=profiles.get(key);
  check(profile,'Select a frozen ERC20 template.');
  check(input&&typeof input==='object'&&!Array.isArray(input)&&Object.keys(input).every(k=>fields.includes(k)),
    'Unexpected ERC20 wizard field.');
  const supply=parseERC20Units420(input.supply);
  const cap=profile.capped?parseERC20Units420(input.cap):'0';
  check(profile.capped||input.cap===''||input.cap==='0'||input.cap===undefined,'Only the capped template accepts a supply cap.');
  const result=encodeTokenCreation420({template:key,name:metadata(input.name,'Token name'),
    symbol:metadata(input.symbol,'Token symbol'),initialSupply:supply,cap,userSalt:input.userSalt});
  return Object.freeze({...result,displaySupply:formatERC20Units420(supply),displayCap:profile.capped?formatERC20Units420(cap):null,
    warnings:Object.freeze(supply==='0'?[profile.mintable?'Initial supply is zero; the owner can mint later.':
      'Initial supply is zero and this template cannot mint later.']:[])});
}
export const generateERC20Salt420=generateTokenCreationSalt420;
export function createERC20Wizard420(catalogue,session,{salt=generateERC20Salt420}={}){
  return createTokenCreationWizard420(catalogue,session,{profiles,fields,validate:validateERC20WizardFields420,
    allowField:(profile,field)=>field!=='cap'||profile.capped,salt});
}
