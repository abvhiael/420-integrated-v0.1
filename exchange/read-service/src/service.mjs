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
      const finality=safeHead!==null&&BigInt(e.blockNumber)<=safeHead?(status.finality?.mode==='finalized'?'finalized':'safe'):'indexed';
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
  async bridgeSurface(){
    const {status,records}=await this.refresh();
    const rpc=await this.rpc.health();
    if(rpc?.ok!==true)throw new Error('bridge RPC fallback unavailable');
    const observedAt=Number(status.indexedHeadTimestamp??this.nowSeconds());
    const freshness=status?.runtime?.stale===true?'stale':'canonical';
    const finality=status?.finality?.mode??'indexed';
    const routes=this.catalogue.routes.filter(route=>route.bridge).map(route=>Object.freeze({
      routeId:route.routeId,...route.bridge,executionQualified:false,authoritative:false,
      catalogueQualification:route.qualification,
      source:route.source,
      canonicality:freshness==='canonical'?'canonical':'stale',
      freshness,
      finality,
      observedAt,
    }));
    const transfers=new Map();
    const ordered=[...records].sort((a,b)=>BigInt(a.blockNumber)<BigInt(b.blockNumber)?-1:BigInt(a.blockNumber)>BigInt(b.blockNumber)?1:a.transactionIndex-b.transactionIndex||a.logIndex-b.logIndex);
    for(const record of ordered){
      if(!record.transferId)continue;
      let group=transfers.get(record.transferId);
      if(!group){group={transferId:record.transferId,routeId:null,current:null,orphan:null};transfers.set(record.transferId,group);}
      if(record.active===false){group.orphan=record;continue;}
      if(record.routeId)group.routeId=record.routeId;
      if(record.bridgeLifecycleState)group.current=record;
    }
    const settlements=[...transfers.values()].map(group=>{
      const current=group.current,record=current??group.orphan;
      if(!record)return null;
      return Object.freeze({settlementId:group.transferId,transferId:group.transferId,
        routeId:group.routeId??record.routeId,state:current?.bridgeLifecycleState??'UNKNOWN',
        txHash:record.txHash,attestationId:null,proofId:null,retryable:current?.bridgeLifecycleState==='RETRYABLE',
        failureReason:null,active:Boolean(current),finality:record.finality??'indexed',
        freshness:record.freshness??freshness,canonicality:current?'canonical':'reorged',
        observedAt:record.observedAt??observedAt,replacementId:record.replacedBy??null,authoritative:false});
    }).filter(Boolean);
    return Object.freeze({
      routes:Object.freeze(routes),
      settlements:Object.freeze(settlements),
      provenance:Object.freeze({
        source:'420Indexer/v1+ExchangeReadService',
        authoritative:false,
        indexedHead:String(status.indexedHead??''),
        finality,
        freshness,
        rpcFallbackReady:true,
        observedAt,
      }),
    });
  }
}
