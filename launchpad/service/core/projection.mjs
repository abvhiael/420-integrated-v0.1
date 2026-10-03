import fs from 'node:fs';
export class ProjectionStore{
  constructor(path){this.path=path;}
  read(){if(!this.path)throw new Error('projection source unresolved');const d=JSON.parse(fs.readFileSync(this.path,'utf8'));if(d.schema!=='420-launchpad-projection-v1'||d.canonical!==true)throw new Error('invalid Launchpad projection');if(!d.source?.chainId||!d.source?.blockHash)throw new Error('projection provenance incomplete');return d;}
  campaigns(){return this.read();}
  campaign(saleId){const d=this.read(),campaign=(d.items||[]).find(x=>x.saleId===saleId);if(!campaign)throw Object.assign(new Error('campaign not found'),{statusCode:404});return {...d,items:undefined,campaign};}
}
