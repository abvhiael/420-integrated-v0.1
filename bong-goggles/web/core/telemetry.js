const SENSITIVE=/pass(word|key)?|secret|token|authorization|cookie|private|mnemonic|seed|cipher|plaintext|message(body|content)?|sessionkey/i;

export function redactTelemetry(value){
  if(Array.isArray(value)) return value.map(redactTelemetry);
  if(value&&typeof value==='object'){
    const out={};
    for(const [key,item] of Object.entries(value)){
      out[key]=SENSITIVE.test(key)?'[REDACTED]':redactTelemetry(item);
    }
    return out;
  }
  return value;
}

export function createTelemetrySink({emit=()=>{}}={}){
  return Object.freeze({
    event(name,fields={}){
      emit(Object.freeze({
        schema:'bg-web-telemetry-v1',
        name:String(name),
        fields:Object.freeze(redactTelemetry(fields)),
        authoritative:false,
      }));
    }
  });
}
