import {dedupeAndValidate,historyPage,mapIndexerEventToHistory,marketSnapshot} from './projection.mjs';

export class ExchangeReadService{
  constructor({indexer,rpc,store,catalogue,nowSeconds=()=>Math.floor(Date.now()/1000)}={}){
    if(!indexer||!rpc||!store||!catalogue)throw new Error('indexer/rpc/store/catalogue composition required');
    this.indexer=indexer;this.rpc=rpc;this.store=store;this.catalogue=catalogue;this.nowSeconds=nowSeconds;this.started=false;this.lastRefreshAt=null;
  }
  async dependencies(){
    const [readiness,status,rpc]=await Promise.all([this.indexer.readiness(),this.indexer.status(),this.rpc.health()]);
    return {readiness,status,rpc,storage:this.store.health()};
  }
  async refresh(){
    const status=await this.indexer.status();let cursor='',all=[];
    do{const page=await this.indexer.protocolEvents({protocol:'420Exchange',cursor});all.push(...(page.items??[]));cursor=page.nextCursor??'';}while(cursor);
    // Bridge gateway events are part of the Exchange history surface but originate in 420Bridge.
    cursor='';
    do{const page=await this.indexer.protocolEvents({protocol:'420Bridge',cursor});all.push(...(page.items??[]));cursor=page.nextCursor??'';}while(cursor);
    const observedAt=Number(status.indexedHeadTimestamp??this.nowSeconds());
    const freshness=status?.runtime?.stale===true?'stale':'canonical';
    const safeHead=status?.finality?.safeHead===null||status?.finality?.safeHead===undefined?null:BigInt(status.finality.safeHead);
    const mapped=dedupeAndValidate(all.map(e=>{
      const finality=safeHead!==null&&BigInt(e.blockNumber)<=safeHead?'safe':(status.finality?.mode??'indexed');
      return mapIndexerEventToHistory(e,{observedAt,finality,freshness});
    }).filter(Boolean));
    this.store.reconcile(mapped,{observationKey:'exchange-history'});this.lastRefreshAt=this.nowSeconds();return {status,events:all,records:this.store.values()};
  }
  async readiness(){
    try{
      const dep=await this.dependencies();
      return {ready:dep.readiness?.ready===true&&dep.rpc?.ok===true&&dep.storage?.ok===true&&this.catalogue.markets.length>0,indexer:dep.readiness,rpc:dep.rpc,storage:dep.storage,lastRefreshAt:this.lastRefreshAt};
    }catch(error){return {ready:false,error:String(error?.message??error),lastRefreshAt:this.lastRefreshAt};}
  }
  health(){return {status:'ok',service:'420Exchange Read API',apiMajor:13,apiMinor:6};}
  async snapshot(subjectId){
    const entry=this.catalogue.markets.find(m=>m.marketSubjectId===subjectId);if(!entry)throw Object.assign(new Error('market not found'),{code:'NOT_FOUND'});
    const {status,events}=await this.refresh();
    return marketSnapshot({catalogueEntry:{...entry,catalogueVersion:this.catalogue.version},status,events,nowSeconds:this.nowSeconds()});
  }
  async history(query){await this.refresh();return historyPage(this.store.values(),query);}
}
