export function strip0x(v){return String(v||'').replace(/^0x/,'');}
export function hexUtf8(v){return '0x'+Buffer.from(String(v),'utf8').toString('hex');}
export function wordHex(v){const s=strip0x(v);if(!/^[0-9a-fA-F]*$/.test(s)||s.length>64)throw new Error('invalid ABI word');return s.padStart(64,'0').toLowerCase();}
export function wordAddress(v){const s=strip0x(v);if(!/^[0-9a-fA-F]{40}$/.test(s))throw new Error('invalid address');return s.padStart(64,'0').toLowerCase();}
export function wordUint(v){const n=BigInt(v);if(n<0n||n>=2n**256n)throw new Error('out of range uint256');return n.toString(16).padStart(64,'0');}
export function encodeStatic(selector,words){if(!/^0x[0-9a-fA-F]{8}$/.test(selector))throw new Error('invalid selector');return selector+words.join('');}
export function decodeAddress(data,index=0){const s=strip0x(data);const word=s.slice(index*64,(index+1)*64);if(!/^[0-9a-fA-F]{64}$/.test(word)||!/^0{24}$/i.test(word.slice(0,24)))throw new Error('invalid ABI address word');return '0x'+word.slice(24).toLowerCase();}
export function decodeUint(data,index=0){const s=strip0x(data);const word=s.slice(index*64,(index+1)*64);if(!/^[0-9a-fA-F]{64}$/.test(word))throw new Error('invalid ABI uint word');return BigInt('0x'+word);}
export function decodeBool(data,index=0){const n=decodeUint(data,index);if(n!==0n&&n!==1n)throw new Error('invalid ABI bool');return n===1n;}
