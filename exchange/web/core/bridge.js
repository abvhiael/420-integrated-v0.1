export const BRIDGE_STATES=Object.freeze(['DRAFT','READY','SUBMITTED','ATTESTING','PROVEN','SETTLING','SETTLED','FAILED']);

function positive(value,label){
  const n=typeof value==='number'?value:Number(value);
  if(!Number.isFinite(n)||n<=0) throw new Error(`invalid ${label}`);
  return n;
}
function id(value,label){
  if(typeof value!=='string'||!value) throw new Error(`missing ${label}`);
  return value;
}

export function normalizeBridgeRoute(route){
  const normalized={
    routeId:id(route.routeId,'routeId'),
    exchangeAssetId:id(route.exchangeAssetId,'exchangeAssetId'),
    localToken:id(route.localToken,'localToken'),
    canonicalAsset:id(route.canonicalAsset,'canonicalAsset'),
    sourceChain:id(route.sourceChain,'sourceChain'),
    destinationChain:id(route.destinationChain,'destinationChain'),
    sourceAssetId:id(route.sourceAssetId,'sourceAssetId'),
    destinationAssetId:id(route.destinationAssetId,'destinationAssetId'),
    adapterId:id(route.adapterId,'adapterId'),
    adapterAddress:id(route.adapterAddress,'adapterAddress'),
    verifierId:id(route.verifierId,'verifierId'),
    provenanceHash:id(route.provenanceHash,'provenanceHash'),
    verificationHash:id(route.verificationHash,'verificationHash'),
    direction:route.direction==='OUTBOUND'?'OUTBOUND':'INBOUND',
    qualified:route.qualified===true,
    representationActive:route.representationActive===true,
    canonicalRepresentation:route.canonicalRepresentation===true,
    routeActive:route.routeActive===true,
    directionEnabled:route.directionEnabled===true,
    adapterLive:route.adapterLive===true,
    adapterMatches:route.adapterMatches===true,
    verifierConfigured:route.verifierConfigured===true,
    settlementHealthy:route.settlementHealthy===true,
    paused:route.paused===true,
    bridgeFee:Number(route.bridgeFee??0),
  };
  if(!Number.isFinite(normalized.bridgeFee)||normalized.bridgeFee<0) throw new Error('invalid bridgeFee');
  return normalized;
}

export function bridgeQualification(route){
  const r=normalizeBridgeRoute(route);
  const checks=[
    ['not-qualified',r.qualified],
    ['representation-inactive',r.representationActive],
    ['not-canonical-representation',r.canonicalRepresentation],
    ['route-inactive',r.routeActive],
    ['direction-disabled',r.directionEnabled],
    ['adapter-missing',r.adapterLive],
    ['adapter-mismatch',r.adapterMatches],
    ['verifier-missing',r.verifierConfigured],
    ['provenance-mismatch',r.provenanceHash===r.verificationHash],
    ['settlement-unhealthy',r.settlementHealthy],
    ['paused',!r.paused],
  ];
  const failed=checks.find(([,ok])=>!ok);
  return failed?{ok:false,reason:failed[0]}:{ok:true,reason:null};
}

export function buildBridgeIntent(route,{amount,recipient}){
  const r=normalizeBridgeRoute(route);
  const gate=bridgeQualification(r);
  if(!gate.ok) throw new Error(`bridge route unavailable: ${gate.reason}`);
  return Object.freeze({
    kind:r.direction==='INBOUND'?'BRIDGE_DEPOSIT':'BRIDGE_WITHDRAWAL',
    routeId:r.routeId,
    exchangeAssetId:r.exchangeAssetId,
    localToken:r.localToken,
    canonicalAsset:r.canonicalAsset,
    sourceChain:r.sourceChain,
    destinationChain:r.destinationChain,
    sourceAssetId:r.sourceAssetId,
    destinationAssetId:r.destinationAssetId,
    adapterId:r.adapterId,
    verifierId:r.verifierId,
    amount:positive(amount,'amount'),
    recipient:id(recipient,'recipient'),
    quotedBridgeFee:r.bridgeFee,
  });
}

export function normalizeSettlement(record){
  const state=String(record.state??'');
  if(!BRIDGE_STATES.includes(state)) throw new Error('invalid bridge state');
  return {
    settlementId:id(record.settlementId,'settlementId'),
    routeId:id(record.routeId,'routeId'),
    state,
    txHash:record.txHash??null,
    attestationId:record.attestationId??null,
    proofId:record.proofId??null,
    retryable:record.retryable===true,
    failureReason:record.failureReason??null,
    active:record.active!==false,
  };
}

export function settlementProgress(record){
  const r=normalizeSettlement(record);
  const order=['DRAFT','READY','SUBMITTED','ATTESTING','PROVEN','SETTLING','SETTLED'];
  if(r.state==='FAILED') return {percent:0,terminal:true};
  const index=order.indexOf(r.state);
  return {percent:Math.round((index/(order.length-1))*100),terminal:r.state==='SETTLED'};
}

export function canSubmitBridge({route,intent,walletReady=false}){
  if(!route||!intent) return {ok:false,reason:'missing-review'};
  const gate=bridgeQualification(route);
  if(!gate.ok) return gate;
  if(!walletReady) return {ok:false,reason:'wallet-unavailable'};
  return {ok:true,reason:null};
}
