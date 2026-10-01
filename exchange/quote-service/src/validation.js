import {fail} from './errors.js';
const UINT256=1n<<256n;
export const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
export const address=v=>typeof v==='string'&&/^0x[0-9a-f]{40}$/i.test(v)&&!/^0x0{40}$/i.test(v);
export const id32=v=>typeof v==='string'&&/^0x[0-9a-f]{64}$/i.test(v);
export const raw=v=>typeof v==='string'&&/^[1-9][0-9]*$/.test(v)&&BigInt(v)<UINT256;
export const normalizeAddress=v=>v.toLowerCase();
export function normalizeChainId(value){
  if(typeof value!=='string'||!/^0x[0-9a-f]+$/i.test(value)||BigInt(value)<=0n)fail('CHAIN_UNCONFIGURED','valid configured chain ID required',{status:503,retryable:false});
  return '0x'+BigInt(value).toString(16);
}
export function validateRequest(body,{maxBodyBytes=8192}={}){
  let encoded;
  try{encoded=Buffer.byteLength(JSON.stringify(body));}catch{fail('MALFORMED_REQUEST','request must be JSON');}
  if(encoded>maxBodyBytes)fail('REQUEST_TOO_LARGE','quote request exceeds size limit',{status:413});
  if(!object(body)||body.schema!=='420-exchange-swap-quote-request-v1')fail('UNSUPPORTED_SCHEMA','quote request schema is unsupported',{status:406});
  const keys=Object.keys(body).sort(),allowed=['account','amountInRaw','minimumOutputRaw','recipient','schema','tokenIn','tokenOut'].sort();
  if(keys.length!==allowed.length||keys.some((k,i)=>k!==allowed[i]))fail('MALFORMED_REQUEST','unknown or missing quote request fields');
  for(const field of ['account','tokenIn','tokenOut','recipient'])if(!address(body[field]))fail('INVALID_ADDRESS',`${field} must be a non-zero address`);
  if(normalizeAddress(body.tokenIn)===normalizeAddress(body.tokenOut))fail('INVALID_PAIR','input and output token must differ');
  for(const field of ['amountInRaw','minimumOutputRaw'])if(!raw(body[field]))fail('INVALID_RAW_AMOUNT',`${field} must be a positive uint256 decimal string`);
  return Object.freeze({
    schema:body.schema,
    account:normalizeAddress(body.account),tokenIn:normalizeAddress(body.tokenIn),tokenOut:normalizeAddress(body.tokenOut),
    recipient:normalizeAddress(body.recipient),amountInRaw:body.amountInRaw,minimumOutputRaw:body.minimumOutputRaw,
  });
}
