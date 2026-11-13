// W15.6-M11. Only verified on-chain records may influence spendable balances.
// Convenience metadata is never ownership, signer, identity or approval authority.
const ADDRESS=/^0x[0-9a-fA-F]{40}$/;
const CHAIN=/^0x(?:0|[1-9a-fA-F][0-9a-fA-F]*)$/;
function check(b,m){if(!b)throw new Error(m)}
export const CONVENIENCE_KEY420='420-wallet-convenience-v1';
const allowedServiceTypes=new Set(['420Swap','420Stake','420Names','420Identity','420Bridge','420Pay','420Explorer','420Governance','420Market','420Exchange','other']);
const privacyDefaults=Object.freeze({notifications:false,showFiat:true,portfolioAnalytics:true,serviceDiscovery:false,allowDeepLinks:false,contactSync:false,backupSync:false,hideBalances:false});
export function normalizeConvenience420(input={}){
 const p=input?.privacy??{};
 const privacy=Object.fromEntries(Object.entries(privacyDefaults).map(([key,def])=>[key,typeof p[key]==='boolean'?p[key]:def]));
 const labels=Array.isArray(input?.labels)?input.labels.slice(0,160).flatMap(v=>{
   try{return [normalizeAddressLabel420(v)];}catch{return [];}
 }):[];
 const seen=new Set();
 const unique=labels.filter(x=>{const id=x.chainId+':'+x.address;if(seen.has(id))return false;seen.add(id);return true;});
 return {version:1,privacy,labels:unique,backupUpdatedAt:Number.isSafeInteger(input?.backupUpdatedAt)?input.backupUpdatedAt:null};
}
export function normalizeAddressLabel420(entry){
 check(entry&&typeof entry==='object','Contact label required');
 check(typeof entry.address==='string'&&ADDRESS.test(entry.address),'Invalid contact address');
 check(typeof entry.chainId==='string'&&CHAIN.test(entry.chainId)&&BigInt(entry.chainId)>0n,'Invalid contact network');
 const label=String(entry.label??'').normalize('NFC').trim();
 check(label.length>0&&label.length<=64&&!/[\u0000-\u001f\u007f<>]/.test(label),'Invalid contact label');
 return {chainId:'0x'+BigInt(entry.chainId).toString(16),address:entry.address.toLowerCase(),label};
}
export function updateAddressLabel420(config,entry,{remove=false}={}){
 const now=normalizeConvenience420(config),x=normalizeAddressLabel420(entry);
 const labels=now.labels.filter(v=>v.chainId!==x.chainId||v.address!==x.address);
 if(!remove)labels.unshift(x);
 check(labels.length<=160,'Too many address labels');
 return {...now,labels};
}
export function normalizeServiceDirectory420(config,chainId){
 check(typeof chainId==='string'&&CHAIN.test(chainId),'Missing chain ID');
 const list=Array.isArray(config?.ecosystemServices)?config.ecosystemServices:[];
 const seen=new Set();
 return list.slice(0,60).flatMap(entry=>{
   try{
     check(entry?.approved===true&&entry?.chainId===chainId,'Unapproved application');
     const id=String(entry.id??''),name=String(entry.name??''),type=String(entry.type??'');
     check(/^[a-z0-9._:-]{1,64}$/.test(id)&&name.length>=1&&name.length<=80&&allowedServiceTypes.has(type),'Bad app identity');
     const url=new URL(entry.url);
     check(url.protocol==='https:'&&!url.username&&!url.password&&!url.hash&&!url.search&&url.hostname!=='localhost','Untrusted application URL');
     const origin=url.origin;
     check(entry.origin===origin&&url.pathname==='/'||entry.origin===origin&&url.pathname.startsWith('/'), 'Unapproved service origin');
     check(!seen.has(id),'Duplicate app identity');seen.add(id);
     return [{id,name,type,url:url.href,origin,chainId,description:String(entry.description??'').slice(0,250),approved:true}];
   }catch{return [];}
 });
}
export function portfolioAnalytics420(portfolio,activity=[],{enabled=true}={}){
 if(!enabled)return {available:false,reason:'Portfolio analytics disabled in privacy controls'};
 if(portfolio?.status!=='verified'||typeof portfolio.chainId!=='string')
  return {available:false,reason:'On-chain portfolio not verified'};
 const assetList=[...(portfolio.native?[{...portfolio.native,address:'native'}]:[]),...(portfolio.tokens??[])].filter(v=>v&&v.balance?.status==='spendable'&&v.verified!==false&&!v.spam&&!v.hidden);
 const entries=activity.filter(a=>a.chainId===portfolio.chainId&&typeof a.at==='number');
 const statuses={};
 for(const e of entries)statuses[e.status]=(statuses[e.status]||0)+1;
 const assets=assetList.map(a=>({address:a.address,symbol:String(a.symbol||'Asset').slice(0,20),
   raw:String(a.balance?.spendable??a.balance?.raw??a.raw??'0'),decimals:a.decimals,
   fiatValue:a.price?.status==='verified'?a.price.value:null}));
 let totalCents=0n,priced=0;
 for(const a of assets){const x=a.fiatValue;if(typeof x==='string'&&/^(0|[1-9]\d*)(?:\.\d{1,2})?$/.test(x)){
   const [whole,cent='']=x.split('.');totalCents+=BigInt(whole)*100n+BigInt(cent.padEnd(2,'0'));priced++;
 }}
 return {available:true,chainId:portfolio.chainId,blockNumber:portfolio.blockNumber??null,
   checkedAt:portfolio.checkedAt??null,assetCount:assets.length,
   verifiedPricedCount:priced,unpricedCount:assets.length-priced,pricedSubtotalCents:totalCents.toString(),
   currency:portfolio.currency||'CAD',statuses,transactionCount:entries.length,assets,
   partial:priced!==assets.length,performanceReturnUnavailable:true,
   note:'Historical profit/loss, cost basis and realised returns require independent verified historical data; current balances are not earnings.'};
}
export function actionableNotifications420(entries,{account,chainId,after=0,limit=12}={}){
 check(typeof account==='string'&&ADDRESS.test(account)&&typeof chainId==='string'&&CHAIN.test(chainId),'Bound notification scope required');
 return entries.filter(e=>e.controller===account&&e.chainId===chainId&&Number.isSafeInteger(e.at)&&e.at>after)
  .filter(e=>['confirmed','reverted','reorganized','failed','submitted'].includes(e.status))
  .slice(0,limit).map(e=>({id:e.id,at:e.at,status:e.status,
    label:String(e.kind||'Wallet transaction').slice(0,60),
    hash:/^0x[0-9a-fA-F]{64}$/.test(e.hash||'')?e.hash:null}));
}
export function validateMobileInvite420(uri){
 check(typeof uri==='string'&&uri.length<3072,'Pairing URI too large');
 const match=/^wc:([0-9a-f]{64})@2\?(.+)$/.exec(uri);
 check(!!match,'Only WalletConnect v2 pairing URIs are supported');
 const params=new URLSearchParams(match[2]);
 const relay=params.get('relay-protocol'),symmetricKey=params.get('symKey');
 const keys=[...params.keys()];
 check(relay==='irn'&&/^[a-f0-9]{64}$/i.test(symmetricKey??'')&&
   new Set(keys).size===keys.length&&keys.every(k=>['relay-protocol','symKey','relay-data'].includes(k)),
   'Unsupported or invalid WalletConnect v2 relay URI');
 return {topic:match[1],protocol:'irn',uri};
}
const encoder=new TextEncoder(),decoder=new TextDecoder();
const b64=bytes=>Array.from(bytes).map(b=>String.fromCharCode(b)).join('');
const from64=s=>Uint8Array.from(atob(s),x=>x.charCodeAt(0));
export async function encryptConvenienceBackup420(data,passphrase,{cryptoRef=crypto}={}){
 check(typeof passphrase==='string'&&passphrase.length>=12&&passphrase.length<=256,'Backup passphrase must be 12–256 characters');
 const record=normalizeConvenience420(data);
 // Export never includes BIP-39 entropy, vault material, passkeys or signing secrets.
 const salt=cryptoRef.getRandomValues(new Uint8Array(16)),iv=cryptoRef.getRandomValues(new Uint8Array(12));
 const keyMaterial=await cryptoRef.subtle.importKey('raw',encoder.encode(passphrase),'PBKDF2',false,['deriveKey']);
 const key=await cryptoRef.subtle.deriveKey({name:'PBKDF2',salt,iterations:600000,hash:'SHA-256'},keyMaterial,{name:'AES-GCM',length:256},false,['encrypt']);
 const cipher=new Uint8Array(await cryptoRef.subtle.encrypt({name:'AES-GCM',iv,additionalData:encoder.encode('420-wallet-convenience-v1')},key,encoder.encode(JSON.stringify(record))));
 return JSON.stringify({schema:'420-wallet-convenience-encrypted-v1',kdf:'PBKDF2-SHA256',iterations:600000,algorithm:'AES-256-GCM',salt:btoa(b64(salt)),iv:btoa(b64(iv)),ciphertext:btoa(b64(cipher))});
}
export async function decryptConvenienceBackup420(blob,passphrase,{cryptoRef=crypto}={}){
 check(typeof blob==='string'&&blob.length<=200000&&typeof passphrase==='string','Invalid encrypted backup input');
 let packageData;try{packageData=JSON.parse(blob)}catch{throw new Error('Encrypted backup is malformed')}
 check(packageData?.schema==='420-wallet-convenience-encrypted-v1'&&packageData.kdf==='PBKDF2-SHA256'&&
  packageData.iterations===600000&&packageData.algorithm==='AES-256-GCM','Unsupported backup version or encryption');
 const salt=from64(packageData.salt),iv=from64(packageData.iv),ciphertext=from64(packageData.ciphertext);
 check(salt.length===16&&iv.length===12&&ciphertext.length>=16&&ciphertext.length<=150000,'Malformed encrypted backup');
 const source=await cryptoRef.subtle.importKey('raw',encoder.encode(passphrase),'PBKDF2',false,['deriveKey']);
 const key=await cryptoRef.subtle.deriveKey({name:'PBKDF2',salt,iterations:600000,hash:'SHA-256'},source,{name:'AES-GCM',length:256},false,['decrypt']);
 let result;try{result=await cryptoRef.subtle.decrypt({name:'AES-GCM',iv,additionalData:encoder.encode('420-wallet-convenience-v1')},key,ciphertext)}
 catch{throw new Error('Incorrect passphrase or backup integrity failure')}
 const raw=JSON.parse(decoder.decode(result));
 check(raw?.version===1,'Unsupported backup payload');
 return normalizeConvenience420(raw);
}
