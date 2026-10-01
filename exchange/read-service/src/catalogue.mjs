import fs from 'node:fs';

const HEX32=/^0x[0-9a-fA-F]{64}$/;
const STATES=new Set(['DISPLAY_ONLY_UNQUALIFIED','DISPLAY_ONLY_QUALIFIED_METADATA','DISABLED']);
function req(v,label){if(typeof v!=='string'||!v)throw new Error('missing '+label);return v;}
export function validateCatalogue(input){
  if(!input||input.schema!=='420-exchange-catalogue-v1'||!Number.isSafeInteger(input.version)||input.version<1||!Array.isArray(input.markets))throw new Error('invalid Exchange catalogue');
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
  return Object.freeze({schema:input.schema,version:input.version,markets:Object.freeze(markets)});
}
export function loadCatalogue(file){return validateCatalogue(JSON.parse(fs.readFileSync(file,'utf8')));}
