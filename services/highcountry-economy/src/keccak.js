// Ethereum Keccak-256 (legacy 0x01 padding, not NIST SHA3). Tested against Ethereum vectors.
const mask=(1n<<64n)-1n;
const rc=[1n,0x8082n,0x800000000000808an,0x8000000080008000n,0x808bn,0x80000001n,0x8000000080008081n,0x8000000000008009n,0x8an,0x88n,0x80008009n,0x8000000an,0x8000808bn,0x800000000000008bn,0x8000000000008089n,0x8000000000008003n,0x8000000000008002n,0x8000000000000080n,0x800an,0x800000008000000an,0x8000000080008081n,0x8000000000008080n,0x80000001n,0x8000000080008008n];
const rotations=[0,1,62,28,27,36,44,6,55,20,3,10,43,25,39,41,45,15,21,8,18,2,61,56,14];
const rot=(x,n)=>n===0?x:((x<<BigInt(n))|(x>>BigInt(64-n)))&mask;
export function keccak256(input){
 const data=Buffer.from(input),rate=136,padded=Buffer.alloc(Math.ceil((data.length+1)/rate)*rate);
 data.copy(padded);padded[data.length]=1;padded[padded.length-1]|=128;
 const a=Array(25).fill(0n);
 for(let off=0;off<padded.length;off+=rate){
  for(let i=0;i<17;i++)a[i]^=padded.readBigUInt64LE(off+i*8);
  for(const r of rc){
   const c=Array(5).fill(0n);for(let x=0;x<5;x++)for(let y=0;y<5;y++)c[x]^=a[x+5*y];
   for(let x=0;x<5;x++){const d=c[(x+4)%5]^rot(c[(x+1)%5],1);for(let y=0;y<5;y++)a[x+5*y]^=d;}
   const b=Array(25).fill(0n);for(let x=0;x<5;x++)for(let y=0;y<5;y++)b[y+5*((2*x+3*y)%5)]=rot(a[x+5*y],rotations[x+5*y]);
   for(let x=0;x<5;x++)for(let y=0;y<5;y++)a[x+5*y]=(b[x+5*y]^((~b[(x+1)%5+5*y])&b[(x+2)%5+5*y]))&mask;
   a[0]^=r;
  }
 }
 const out=Buffer.alloc(32);for(let i=0;i<4;i++)out.writeBigUInt64LE(a[i],i*8);return '0x'+out.toString('hex');
}
export const selector=signature=>keccak256(Buffer.from(signature)).slice(2,10);
