import {hashLimitOrder} from './limit-order-identity.js';

export const DEFAULT_ORDER_PUBLICATION_GATE=Object.freeze({enabled:false,mode:'DISABLED'});
const ALLOWED_ORDER_PUBLICATION_MODES=new Set(['PRE07_MOCK','LIVE_TESTNET_QUALIFICATION']);

export class OrderPublicationClientError extends Error{
  constructor(code,message){super(message);this.name='OrderPublicationClientError';this.code=code;}
}
const fail=(code,message)=>{throw new OrderPublicationClientError(code,message);};
const STATES=new Set(['signed','published','accepted','partially-filled','filled','cancel-pending','cancelled','expired','rejected']);
function endpoint(runtime){
  const configured=runtime?.api?.orderPublicationUrl,base=runtime?.api?.baseUrl;
  if(typeof configured!=='string'||typeof base!=='string')fail('ENDPOINT_UNCONFIGURED','order publication endpoint is not configured');
  let url,api;try{url=new URL(configured);api=new URL(base);}catch{fail('ENDPOINT_INVALID','invalid order publication endpoint');}
  if(url.protocol!=='https:'||api.protocol!=='https:'||url.origin!==api.origin||url.username||url.password||url.search||url.hash||!url.pathname.endsWith('/v1/orders'))fail('ENDPOINT_INVALID','order publication URL must be same-origin HTTPS /v1/orders');
  return url;
}
function validateRecord(record,{expectedHash=null}={}){
  if(!record||record.schema!=='420-exchange-order-status-v1'||!STATES.has(record.state))fail('UNQUALIFIED_STATUS','invalid order status record');
  const computed=hashLimitOrder(record.order);
  if(record.orderHash!==computed||(expectedHash&&record.orderHash!==expectedHash))fail('ORDER_HASH_MISMATCH','service order identity differs from canonical order hash');
  const p=record.provenance;
  if(!p||p.schema!=='420-exchange-order-status-provenance-v1'||p.service!=='420/service/exchange-orders/v1'||p.orderHash!==record.orderHash||p.revision!==record.revision||!Number.isSafeInteger(p.observedAt))fail('PROVENANCE_INVALID','order service provenance is incomplete or mismatched');
  return Object.freeze(record);
}
async function readJson(response){
  if(response?.redirected===true)fail('ENDPOINT_CHANGED','order service redirect rejected');
  if(!response?.headers?.get?.('content-type')?.toLowerCase().includes('application/json'))fail('UNQUALIFIED_RESPONSE','order service must return JSON');
  try{return await response.json();}catch{fail('UNQUALIFIED_RESPONSE','invalid order service JSON');}
}
export function assertOrderPublicationGate(publicationGate=DEFAULT_ORDER_PUBLICATION_GATE){
  if(publicationGate?.enabled!==true||!ALLOWED_ORDER_PUBLICATION_MODES.has(publicationGate?.mode))fail('LIVE_ORDER_PUBLICATION_DISABLED','live order publication is disabled by the independent publication gate');
  return publicationGate;
}
export async function publishSignedLimitOrder({runtime,signedOrder,fetchImpl=globalThis.fetch,signal,publicationGate=DEFAULT_ORDER_PUBLICATION_GATE}={}){
  const url=endpoint(runtime);
  if(runtime?.execution?.orderPublication!=='DISABLED_PRETESTNET')fail('RUNTIME_POLICY_INVALID','pre-testnet runtime must keep live order publication disabled');
  assertOrderPublicationGate(publicationGate);
  if(typeof fetchImpl!=='function')fail('FETCH_UNAVAILABLE','order publication transport unavailable');
  const body={
    schema:'420-exchange-order-publication-v1',
    domain:signedOrder?.domain,
    order:signedOrder?.order,
    signature:signedOrder?.signature,
    marketId:signedOrder?.order?.marketId,
  };
  const expectedHash=hashLimitOrder(body.order);
  let response;try{response=await fetchImpl(url.href,{method:'POST',cache:'no-store',credentials:'omit',redirect:'error',headers:{accept:'application/json','content-type':'application/json'},body:JSON.stringify(body),signal});}
  catch{fail('TRANSPORT_ERROR','order publication request failed');}
  if(typeof response?.url==='string'&&response.url&&response.url!==url.href)fail('ENDPOINT_CHANGED','order publication response came from unexpected endpoint');
  const payload=await readJson(response);
  if(!response.ok||payload?.schema!=='420-exchange-order-publication-response-v1')fail(payload?.code??'PUBLICATION_REJECTED',payload?.message??'order publication rejected');
  return Object.freeze({idempotent:payload.idempotent===true,order:validateRecord(payload.order,{expectedHash})});
}
export async function fetchLimitOrderStatus({runtime,orderHash,fetchImpl=globalThis.fetch,signal}={}){
  const base=endpoint(runtime);
  if(typeof orderHash!=='string'||!/^0x[0-9a-fA-F]{64}$/.test(orderHash))fail('ORDER_HASH_INVALID','canonical order hash required');
  const url=new URL(base.href+'/'+orderHash);
  let response;try{response=await fetchImpl(url.href,{method:'GET',cache:'no-store',credentials:'omit',redirect:'error',headers:{accept:'application/json'},signal});}
  catch{fail('TRANSPORT_ERROR','order status request failed');}
  if(typeof response?.url==='string'&&response.url&&response.url!==url.href)fail('ENDPOINT_CHANGED','order status response came from unexpected endpoint');
  const payload=await readJson(response);
  if(!response.ok||payload?.schema!=='420-exchange-order-status-response-v1')fail(payload?.code??'STATUS_REJECTED',payload?.message??'order status unavailable');
  return validateRecord(payload.order,{expectedHash:orderHash.toLowerCase()});
}
