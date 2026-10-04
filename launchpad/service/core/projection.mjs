import fs from 'node:fs';
export class ProjectionStore{
  constructor(path,expectedChainId=null){this.path=path;this.expectedChainId=expectedChainId;}
  read(){if(!this.path)throw new Error('projection source unresolved');const d=JSON.parse(fs.readFileSync(this.path,'utf8'));if(d.schema!=='420-launchpad-projection-v1'||d.canonical!==true)throw new Error('invalid Launchpad projection');if(!d.source?.chainId||!/^0x[0-9a-fA-F]{64}$/.test(d.source?.blockHash||''))throw new Error('projection provenance incomplete');if(this.expectedChainId&&d.source.chainId.toLowerCase()!==this.expectedChainId.toLowerCase())throw new Error('projection chain mismatch');return d;}
  campaigns(){return this.read();}
  campaign(saleId){const d=this.read(),campaign=(d.items||[]).find(x=>x.saleId===saleId);if(!campaign)throw Object.assign(new Error('campaign not found'),{statusCode:404});return {...d,items:undefined,campaign};}
}
