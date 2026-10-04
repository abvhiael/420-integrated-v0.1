const MASK=(1n<<64n)-1n, RATE=136;
const ROT=[0,1,62,28,27,36,44,6,55,20,3,10,43,25,39,41,45,15,21,8,18,2,61,56,14];
const RC=[0x1n,0x8082n,0x800000000000808an,0x8000000080008000n,0x808bn,0x80000001n,0x8000000080008081n,0x8000000000008009n,0x8an,0x88n,0x80008009n,0x8000000an,0x8000808bn,0x800000000000008bn,0x8000000000008089n,0x8000000000008003n,0x8000000000008002n,0x8000000000000080n,0x800an,0x800000008000000an,0x8000000080008081n,0x8000000000008080n,0x80000001n,0x8000000080008008n];
function rot(v,s){const b=BigInt(s);return b===0n?v&MASK:((v<<b)|(v>>(64n-b)))&MASK;}
function permute(a){for(const rc of RC){const c=new Array(5),d=new Array(5);for(let x=0;x<5;x++)c[x]=a[x]^a[x+5]^a[x+10]^a[x+15]^a[x+20];for(let x=0;x<5;x++)d[x]=c[(x+4)%5]^rot(c[(x+1)%5],1);for(let y=0;y<5;y++)for(let x=0;x<5;x++)a[x+5*y]=(a[x+5*y]^d[x])&MASK;const b=new Array(25).fill(0n);for(let y=0;y<5;y++)for(let x=0;x<5;x++){const i=x+5*y;b[y+5*((2*x+3*y)%5)]=rot(a[i],ROT[i]);}for(let y=0;y<5;y++)for(let x=0;x<5;x++)a[x+5*y]=(b[x+5*y]^((~b[((x+1)%5)+5*y])&b[((x+2)%5)+5*y]))&MASK;a[0]=(a[0]^rc)&MASK;}}
function bytes(value){if(value instanceof Uint8Array)return value;if(typeof value!=='string')throw Error('bytes required');if(value.startsWith('0x')){const h=value.slice(2);if(h.length%2||!/^[0-9a-fA-F]*$/.test(h))throw Error('invalid hex');return Uint8Array.from(h.match(/../g)?.map(x=>parseInt(x,16))??[]);}return new TextEncoder().encode(value);}
export function keccak256(value){const input=bytes(value),n=Math.ceil((input.length+1)/RATE)*RATE,p=new Uint8Array(n);p.set(input);p[input.length]^=1;p[n-1]^=128;const st=new Array(25).fill(0n);for(let o=0;o<n;o+=RATE){for(let i=0;i<RATE;i++)st[Math.floor(i/8)]^=BigInt(p[o+i])<<BigInt((i%8)*8);permute(st);}let out='0x';for(let i=0;i<32;i++)out+=Number((st[Math.floor(i/8)]>>BigInt((i%8)*8))&255n).toString(16).padStart(2,'0');return out;}
export function selector(signature){return keccak256(signature).slice(0,10);}
export function bytes32Word(v){if(typeof v!=='string'||!/^0x[0-9a-fA-F]{64}$/.test(v))throw Error('invalid bytes32');return v.slice(2).toLowerCase();}
export function uintWord(v,bits=256){let n;try{n=BigInt(v);}catch{throw Error('invalid uint');}if(n<0n||n>=(1n<<BigInt(bits)))throw Error('uint overflow');return n.toString(16).padStart(64,'0');}
export function encodeCreateRequest420({jobId,modelVersionId,workloadClass,inputCommitment,privacyPolicyId,verificationProfileId,maxSpend,deadline}){
  return selector('createRequest(bytes32,bytes32,bytes32,bytes32,bytes32,bytes32,uint256,uint64)')+
    [jobId,modelVersionId,workloadClass,inputCommitment,privacyPolicyId,verificationProfileId].map(bytes32Word).join('')+
    uintWord(maxSpend)+uintWord(deadline,64);
}
export function encodeCancel420(jobId){return selector('cancel(bytes32)')+bytes32Word(jobId);}
export function encodeOpenDispute420(jobId,disputeRef){return selector('openDispute(bytes32,bytes32)')+bytes32Word(jobId)+bytes32Word(disputeRef);}
export function randomBytes32(cryptoImpl=globalThis.crypto){if(!cryptoImpl?.getRandomValues)throw Error('secure randomness unavailable');const b=new Uint8Array(32);cryptoImpl.getRandomValues(b);return '0x'+[...b].map(x=>x.toString(16).padStart(2,'0')).join('');}
