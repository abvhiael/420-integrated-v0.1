// ERC721 V1 collection draft. Its contract returns the exact stored baseURI for
// every minted ID; no automatic token-ID suffix, URI resolution or minting.
import {TOKEN_TEMPLATES_420,encodeTokenCreation420} from './token-sdk.js';
import {createTokenCreationWizard420,generateTokenCreationSalt420,validateTokenWizardMetadata420,validateTokenWizardURI420} from './token-creation-wizard.js';
const profile=TOKEN_TEMPLATES_420.find(p=>p.key==='ERC721_COLLECTION');
const profiles=new Map([[profile.key,profile]]);
const fields=['name','symbol','baseURI','userSalt'];
const check=(ok,message)=>{if(!ok)throw Error(message);};
export function validateERC721WizardFields420(key,input){
  check(key===profile.key,'Select the frozen ERC721 collection template.');
  check(input&&typeof input==='object'&&!Array.isArray(input)&&Object.keys(input).every(k=>fields.includes(k)),
    'Unexpected ERC721 wizard field.');
  const name=validateTokenWizardMetadata420(input.name,'Collection name');
  const symbol=validateTokenWizardMetadata420(input.symbol,'Collection symbol');
  const uri=input.baseURI;
  validateTokenWizardURI420(uri);
  const result=encodeTokenCreation420({template:profile.key,name,symbol,baseURI:uri,userSalt:input.userSalt});
  const collection=Object.freeze({initialSupply:'0',ownerMintable:true,holderOrApprovedOperatorBurn:true,
    ownershipTransferable:true,uriMutable:false,uriMode:'EXACT_SHARED_URI'});
  const warnings=Object.freeze([
    'Collection deployment mints no NFTs. The SmartAccount owner may mint unique IDs later.',
    'The frozen V1 contract returns the same exact base URI for every minted ID; it does not append the ID or substitute placeholders. The URI cannot be changed after deployment.',
    ...(uri===''?['Empty base URI: minted NFTs will return an empty metadata URI.']:['Metadata is not fetched or validated. Content at an external URI may change or become unavailable.']),
  ]);
  return Object.freeze({...result,collection,warnings});
}
export function createERC721Wizard420(catalogue,session,{salt=generateTokenCreationSalt420}={}){
  return createTokenCreationWizard420(catalogue,session,{profiles,fields,validate:validateERC721WizardFields420,salt});
}
