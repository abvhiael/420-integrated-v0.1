const PRIVATE=/(raw.?telemetry|behavioral|browsing|location|email|phone|payload|plaintext|targeting.?data|audience.?data|cookie|credential|secret|token|private.?key|mnemonic|password)/i;
export function assertPublicAttentionValue420(value,path='root'){
  if(value===null||value===undefined)return;
  if(Array.isArray(value)){value.forEach((v,i)=>assertPublicAttentionValue420(v,`${path}[${i}]`));return;}
  if(typeof value!=='object')return;
  for(const [key,child] of Object.entries(value)){if(PRIVATE.test(key))throw new Error('Attention private field blocked: '+path+'.'+key);assertPublicAttentionValue420(child,path+'.'+key);}
}
