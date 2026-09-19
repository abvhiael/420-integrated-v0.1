const SENSITIVE=/pass(word|key)?|secret|token|authorization|cookie|private|mnemonic|seed|cipher|plaintext|message(body|content)?|sessionkey|wallet|address|account|email|phone|url|href|body|payload|signature|error|stack|reason/i;
const REDACTED='[REDACTED]';

// Free-form strings (including errors and URLs) can embed private message text,
// session material or query-string tokens even when their field names appear safe.
export function redactTelemetry(value,depth=0){
  if(depth>6)return REDACTED;
  if(Array.isArray(value))return value.slice(0,20).map(item=>redactTelemetry(item,depth+1));
  if(value&&typeof value==='object'){
    const out={};
    for(const [key,item] of Object.entries(value).slice(0,30)){
      if(SENSITIVE.test(key))out[key]=REDACTED;
      else out[key]=redactTelemetry(item,depth+1);
    }
    return out;
  }
  if(typeof value==='string')return REDACTED;
  if(typeof value==='number')return Number.isFinite(value)?value:null;
  if(typeof value==='boolean'||value===null)return value;
  return REDACTED;
}

export function createTelemetrySink({emit=()=>{}}={}){
  return Object.freeze({
    event(name,fields={}){
      // Only a bounded event label is retained; no untrusted error text in names.
      const label=typeof name==='string'&&/^[a-z][a-z0-9_]{0,63}$/.test(name)?name:'redacted_event';
      emit(Object.freeze({
        schema:'bg-web-telemetry-v1',
        name:label,
        fields:Object.freeze(redactTelemetry(fields)),
        authoritative:false
      }));
    }
  });
}
