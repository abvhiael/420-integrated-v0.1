import fs from 'node:fs';
const STATES=new Set(['SCHEDULED','ACTIVE','SUCCEEDED','FAILED','CANCELLED']);
const MODES=new Set(['REWARD','DONATION','COMMUNITY_PROJECT','PRODUCT_PREORDER']);
const queryWord=(value,max=80)=>{const s=String(value||'').trim();if(s.length>max||/[\u0000-\u001f]/.test(s))throw Object.assign(new Error('invalid campaign filter'),{statusCode:400});return s;};
export class ProjectionStore{
  constructor(path,expectedChainId=null){this.path=path;this.expectedChainId=expectedChainId;}
  read(){
    if(!this.path)throw new Error('projection source unresolved');
    const d=JSON.parse(fs.readFileSync(this.path,'utf8'));
    if(d.schema!=='420-launchpad-projection-v1'||d.canonical!==true)throw new Error('invalid Launchpad projection');
    if(!d.source?.chainId||!/^0x[0-9a-fA-F]{64}$/.test(d.source?.blockHash||''))throw new Error('projection provenance incomplete');
    if(this.expectedChainId&&d.source.chainId.toLowerCase()!==this.expectedChainId.toLowerCase())throw new Error('projection chain mismatch');
    if(!Array.isArray(d.items)||d.items.length>10000||new Set(d.items.map(x=>x?.saleId)).size!==d.items.length||
      d.items.some(x=>!x||typeof x.saleId!=='string'||typeof x.projectId!=='string'))throw new Error('invalid campaign projection inventory');
    return d;
  }
  campaigns(options={}){
    const d=this.read();
    const search=queryWord(options.search).toLowerCase(),mode=queryWord(options.mode,32).toUpperCase(),
      state=queryWord(options.state,32).toUpperCase();
    if((mode&&!MODES.has(mode))||(state&&!STATES.has(state)))throw Object.assign(new Error('invalid campaign mode/state filter'),{statusCode:400});
    const limit=options.limit===undefined?24:Number(options.limit);
    if(!Number.isSafeInteger(limit)||limit<1||limit>48)throw Object.assign(new Error('invalid campaign page size'),{statusCode:400});
    const filterKey=JSON.stringify([search,mode,state]),items=d.items.filter(x=>
      (!mode||x.mode===mode)&&(!state||x.state===state)&&(!search||[x.title,x.summary,x.saleId,x.projectId].some(v=>
        String(v||'').toLowerCase().includes(search)))).sort((a,b)=>a.saleId.localeCompare(b.saleId));
    let after='';
    if(options.cursor){
      let c;try{c=JSON.parse(Buffer.from(String(options.cursor),'base64url').toString('utf8'));}catch{throw Object.assign(new Error('invalid campaign cursor'),{statusCode:400});}
      if(!Array.isArray(c)||c.length!==3||c[0]!==d.source.blockHash||c[1]!==filterKey||
        typeof c[2]!=='string'||!items.some(x=>x.saleId===c[2]))throw Object.assign(new Error('stale campaign cursor'),{statusCode:409});
      after=c[2];
    }
    const start=after?items.findIndex(x=>x.saleId===after)+1:0,page=items.slice(start,start+limit);
    const nextCursor=start+limit<items.length?Buffer.from(JSON.stringify([d.source.blockHash,filterKey,page.at(-1).saleId])).toString('base64url'):null;
    return {...d,items:page,total:items.length,nextCursor,filters:{search,mode,state}};
  }
  campaign(saleId){
    const d=this.read(),campaign=d.items.find(x=>x.saleId===saleId);
    if(!campaign)throw Object.assign(new Error('campaign not found'),{statusCode:404});
    return {...d,items:undefined,campaign};
  }
}
