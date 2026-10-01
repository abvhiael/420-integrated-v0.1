const SENSITIVE=/authorization|cookie|token|secret|password|private.?key|mnemonic|seed|signature/i;
export function redact(value,depth=0){
  if(depth>6)return '[DEPTH_LIMIT]';
  if(Array.isArray(value))return value.slice(0,32).map(v=>redact(v,depth+1));
  if(value&&typeof value==='object'){
    const out={};
    for(const [key,item] of Object.entries(value).slice(0,64))out[key]=SENSITIVE.test(key)?'[REDACTED]':redact(item,depth+1);
    return out;
  }
  if(typeof value==='string'&&value.length>512)return value.slice(0,128)+'…[TRUNCATED]';
  return value;
}
export function createRedactedLogger(sink=()=>{}){
  return Object.freeze({
    info:(event,data={})=>sink({level:'info',event,data:redact(data)}),
    warn:(event,data={})=>sink({level:'warn',event,data:redact(data)}),
    error:(event,data={})=>sink({level:'error',event,data:redact(data)}),
  });
}
