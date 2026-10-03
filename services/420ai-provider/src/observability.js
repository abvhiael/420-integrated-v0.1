const SECRET_KEY=/(payload|plaintext|prompt|document|dataset|token|secret|credential|privatekey|apikey|authorization|rawoutput|inputbytes|outputbytes)/i;
export function redact420(value) {
  if (value===null || value===undefined || typeof value==="number" || typeof value==="boolean") return value;
  if (typeof value==="string") return value.length>512 ? value.slice(0,512)+"…" : value;
  if (Buffer.isBuffer(value)) return "[REDACTED_BUFFER]";
  if (Array.isArray(value)) return value.map(redact420);
  if (typeof value==="object") {
    const out={};
    for (const [k,v] of Object.entries(value)) out[k]=SECRET_KEY.test(k)?"[REDACTED]":redact420(v);
    return out;
  }
  return String(value);
}
export function createObserver420(sink=()=>{}) {
  return (level,event,detail={})=>sink({level,event,...redact420(detail)});
}
