import fs from 'node:fs';

const HEX32=/^0x[0-9a-fA-F]{64}$/;
const STATES=new Set(['DISPLAY_ONLY_UNQUALIFIED','DISPLAY_ONLY_QUALIFIED_METADATA','DISABLED']);
function req(v,label){if(typeof v!=='string'||!v)throw new Error('missing '+label);return v;}
export function validateCatalogue(input){
  if(!input||input.schema!=='420-exchange-catalogue-v1'||!Number.isSafeInteger(input.version)||input.version<1||!Array.isArray(input.markets)||!Array.isArray(input.assets)||!Array.isArray(input.routes))throw new Error('invalid Exchange catalogue');
  const seen=new Set();
  const markets=input.markets.map(raw=>{
    const marketSubjectId=req(raw.marketSubjectId,'marketSubjectId');
    if(seen.has(marketSubjectId))throw new Error('duplicate marketSubjectId');seen.add(marketSubjectId);
    if(!STATES.has(raw.qualification))throw new Error('invalid display qualification');
    if(raw.canonicalMarketId!==null&&raw.canonicalMarketId!==undefined&&!HEX32.test(raw.canonicalMarketId))throw new Error('invalid canonicalMarketId');
    return Object.freeze({
      marketSubjectId,canonicalMarketId:raw.canonicalMarketId?.toLowerCase()??null,
      marketLabel:req(raw.marketLabel,'marketLabel'),baseSymbol:req(raw.baseSymbol,'baseSymbol'),quoteSymbol:req(raw.quoteSymbol,'quoteSymbol'),
      qualification:raw.qualification,routeHealthy:raw.routeHealthy===true,settlementHealthy:raw.settlementHealthy===true,
      source:req(raw.source,'catalogue source'),
    });
  });
  const assets=input.assets.map(raw=>Object.freeze({
    assetId:req(raw.assetId,'assetId'),symbol:req(raw.symbol,'asset symbol'),qualification:STATES.has(raw.qualification)?raw.qualification:(()=>{throw new Error('invalid display qualification');})(),
    source:req(raw.source,'asset source'),
  }));
  const routes=input.routes.map(raw=>{
    const bridge=raw.bridge===undefined||raw.bridge===null?null:Object.freeze({
      exchangeAssetId:req(raw.bridge.exchangeAssetId,'bridge exchangeAssetId'),
      localToken:req(raw.bridge.localToken,'bridge localToken'),
      canonicalAsset:req(raw.bridge.canonicalAsset,'bridge canonicalAsset'),
      sourceChain:req(raw.bridge.sourceChain,'bridge sourceChain'),
      destinationChain:req(raw.bridge.destinationChain,'bridge destinationChain'),
      sourceAssetId:req(raw.bridge.sourceAssetId,'bridge sourceAssetId'),
      destinationAssetId:req(raw.bridge.destinationAssetId,'bridge destinationAssetId'),
      adapterId:req(raw.bridge.adapterId,'bridge adapterId'),
      adapterAddress:req(raw.bridge.adapterAddress,'bridge adapterAddress'),
      verifierId:req(raw.bridge.verifierId,'bridge verifierId'),
      provenanceHash:req(raw.bridge.provenanceHash,'bridge provenanceHash'),
      verificationHash:req(raw.bridge.verificationHash,'bridge verificationHash'),
      direction:raw.bridge.direction==='OUTBOUND'?'OUTBOUND':'INBOUND',
      qualified:raw.bridge.qualified===true,
      representationActive:raw.bridge.representationActive===true,
      canonicalRepresentation:raw.bridge.canonicalRepresentation===true,
      routeActive:raw.bridge.routeActive===true,
      directionEnabled:raw.bridge.directionEnabled===true,
      adapterLive:raw.bridge.adapterLive===true,
      adapterMatches:raw.bridge.adapterMatches===true,
      verifierConfigured:raw.bridge.verifierConfigured===true,
      settlementHealthy:raw.bridge.settlementHealthy===true,
      paused:raw.bridge.paused===true,
      bridgeFee:Number(raw.bridge.bridgeFee??0),
      routeLimit:raw.bridge.routeLimit??null,
      assetLimit:raw.bridge.assetLimit??null,
    });
    if(bridge&&(!Number.isFinite(bridge.bridgeFee)||bridge.bridgeFee<0))throw new Error('invalid bridge fee');
    return Object.freeze({
      routeId:req(raw.routeId,'routeId'),marketSubjectId:req(raw.marketSubjectId,'route marketSubjectId'),
      qualification:STATES.has(raw.qualification)?raw.qualification:(()=>{throw new Error('invalid display qualification');})(),
      source:req(raw.source,'route source'),bridge,
    });
  });
  return Object.freeze({schema:input.schema,version:input.version,markets:Object.freeze(markets),assets:Object.freeze(assets),routes:Object.freeze(routes)});
}
export function loadCatalogue(file){return validateCatalogue(JSON.parse(fs.readFileSync(file,'utf8')));}
