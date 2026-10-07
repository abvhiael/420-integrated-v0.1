import {AttentionProjection420} from './reducer.js';
export class AttentionProjectionService420{
  constructor({config,source}){this.config=config;this.upstream=source;this.projection=new AttentionProjection420(config.chainId);this.generation=0;}
  async rebuild(){const events=await this.upstream.rebuildEvents();const next=new AttentionProjection420(this.config.chainId).rebuild(events);this.projection=next;this.generation++;return {events:events.length,generation:this.generation,source:next.latest};}
  source(){const current=this.projection.latest??{chainId:String(this.config.chainId),blockNumber:'0',blockHash:'0x0',transactionHash:'0x0',transactionIndex:0,logIndex:0};return {...current,chainId:'0x'+BigInt(this.config.chainId).toString(16)};}
}
export function projectionEnvelope420(service,data){return {schema:'420-attention-projection-v1',canonical:true,authoritative:false,source:service.source(),...data};}
