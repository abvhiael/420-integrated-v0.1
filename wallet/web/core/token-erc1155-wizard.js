// Frozen ERC1155 V1 creation: immutable URI and deployment salt.
import {TOKEN_TEMPLATES_420,encodeTokenCreation420,tokenWord420} from './token-sdk.js';
import {createTokenCreationWizard420,generateTokenCreationSalt420,validateTokenWizardURI420} from './token-creation-wizard.js';
const profile=TOKEN_TEMPLATES_420.find(p=>p.key==='ERC1155_MULTI');
const profiles=new Map([[profile.key,profile]]);
const fields=['uri','userSalt'];
const check=(ok,message)=>{if(!ok)throw Error(message);};
// EIP-1155 client-side substitution only, lowercase 64 hexadecimal digits, no 0x.
export function resolveERC1155MetadataURI420(uri,id){
  validateTokenWizardURI420(uri);
  return uri.replaceAll('{id}',tokenWord420(id));
}
export function validateERC1155WizardFields420(key,input){
  check(key===profile.key,'Select the frozen ERC1155 multi-token template.');
  check(input&&typeof input==='object'&&!Array.isArray(input)&&Object.keys(input).every(k=>fields.includes(k)),
    'Unexpected ERC1155 wizard field.');
  const uri=validateTokenWizardURI420(input.uri);
  const result=encodeTokenCreation420({template:profile.key,uri,userSalt:input.userSalt});
  const collection=Object.freeze({initialSupply:'0',ownerMintable:true,holderOrApprovedOperatorBurn:true,
    ownershipTransferable:true,safeBatchTransfers:true,uriMutable:false,uriMode:'CLIENT_ID_SUBSTITUTION',
    hasIdPlaceholder:uri.includes('{id}'),exampleId:'1',exampleURI:resolveERC1155MetadataURI420(uri,'1')});
  const warnings=Object.freeze([
    'Deployment creates an empty multi-token contract. The owner may mint quantities for individual uint256 IDs later. No initial IDs or balances are minted.',
    'The frozen V1 contract returns its exact immutable URI for every ID, including unminted IDs. Clients replace literal {id} with a lowercase, 64-digit hexadecimal token ID without 0x. The contract never performs substitution.',
    ...(uri===''?['Empty URI: every token ID returns an empty metadata URI.']:
      [...(!collection.hasIdPlaceholder?['No {id} placeholder: all IDs use the same metadata URI.']:[]),
      'Metadata is not fetched or validated. External content may change or become unavailable.']),
  ]);
  return Object.freeze({...result,collection,warnings});
}
export function createERC1155Wizard420(catalogue,session,{salt=generateTokenCreationSalt420}={}){
  return createTokenCreationWizard420(catalogue,session,{profiles,fields,validate:validateERC1155WizardFields420,salt});
}
