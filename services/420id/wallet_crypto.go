package account

import (
 "bytes"
 "encoding/hex"
 "fmt"
 "math/big"
 "strings"
)

// EVM EOA verification uses legacy Keccak-256 and canonical low-s secp256k1
// recovery. This is proof of control for a specific challenge, not a wallet
// signature endorsement for spending or 420Identity controller status.
var (
 curveP = hexBig("fffffffffffffffffffffffffffffffffffffffffffffffffffffffefffffc2f")
 curveN = hexBig("fffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141")
 curveHalfN = new(big.Int).Rsh(new(big.Int).Set(curveN),1)
 generatorX = hexBig("79be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798")
 generatorY = hexBig("483ada7726a3c4655da4fbfc0e1108a8fd17b448a68554199c47d08ffb10d4b8")
)
func hexBig(s string)*big.Int{v,ok:=new(big.Int).SetString(s,16);if !ok{panic("invalid curve constant")};return v}
type curvePoint struct{x,y *big.Int;infinity bool}
func curveCopy(p curvePoint)curvePoint{if p.infinity{return curvePoint{infinity:true}};return curvePoint{x:new(big.Int).Set(p.x),y:new(big.Int).Set(p.y)}}
func curveAdd(a,b curvePoint)curvePoint{
 if a.infinity{return curveCopy(b)};if b.infinity{return curveCopy(a)}
 var num,den *big.Int
 if a.x.Cmp(b.x)==0{
  sum:=new(big.Int).Add(a.y,b.y);sum.Mod(sum,curveP);if sum.Sign()==0{return curvePoint{infinity:true}}
  num=new(big.Int).Mul(a.x,a.x);num.Mul(num,big.NewInt(3));num.Mod(num,curveP)
  den=new(big.Int).Mul(a.y,big.NewInt(2));den.Mod(den,curveP)
 }else{num=new(big.Int).Sub(b.y,a.y);num.Mod(num,curveP);den=new(big.Int).Sub(b.x,a.x);den.Mod(den,curveP)}
 inv:=new(big.Int).ModInverse(den,curveP);if inv==nil{return curvePoint{infinity:true}}
 slope:=new(big.Int).Mul(num,inv);slope.Mod(slope,curveP)
 x:=new(big.Int).Mul(slope,slope);x.Sub(x,a.x);x.Sub(x,b.x);x.Mod(x,curveP)
 y:=new(big.Int).Sub(a.x,x);y.Mul(y,slope);y.Sub(y,a.y);y.Mod(y,curveP)
 return curvePoint{x:x,y:y}
}
func curveMult(p curvePoint,k *big.Int)curvePoint{
 if p.infinity||k==nil||k.Sign()==0{return curvePoint{infinity:true}}
 var sum=curvePoint{infinity:true};add:=curveCopy(p);n:=new(big.Int).Set(k)
 for n.Sign()>0{if n.Bit(0)==1{sum=curveAdd(sum,add)};add=curveAdd(add,add);n.Rsh(n,1)}
 return sum
}
func curveValid(p curvePoint)bool{
 if p.infinity||p.x==nil||p.y==nil||p.x.Sign()<0||p.x.Cmp(curveP)>=0||p.y.Sign()<0||p.y.Cmp(curveP)>=0{return false}
 y:=new(big.Int).Mul(p.y,p.y);y.Mod(y,curveP)
 x:=new(big.Int).Exp(p.x,big.NewInt(3),curveP);x.Add(x,big.NewInt(7));x.Mod(x,curveP)
 return x.Cmp(y)==0
}
func publicAddress(p curvePoint)string{
 raw:=make([]byte,64);xb,yb:=p.x.Bytes(),p.y.Bytes();copy(raw[32-len(xb):32],xb);copy(raw[64-len(yb):],yb)
 digest:=walletKeccak(raw)
 return "0x"+hex.EncodeToString(digest[12:])
}
func walletMessageDigest(message string)[32]byte{
 text:=[]byte(message)
 prefix:=[]byte(fmt.Sprintf("\x19Ethereum Signed Message:\n%d",len(text)))
 return walletKeccak(append(prefix,text...))
}
func walletRecoverEOA(message,sigHex string)(string,error){
 if len(sigHex)!=132||!strings.HasPrefix(sigHex,"0x"){return "",ErrAuthentication}
 sig,e:=hex.DecodeString(sigHex[2:]);if e!=nil||len(sig)!=65{return "",ErrAuthentication}
 parity:=sig[64];if parity==27||parity==28{parity-=27};if parity>1{return "",ErrAuthentication}
 r:=new(big.Int).SetBytes(sig[:32]);s:=new(big.Int).SetBytes(sig[32:64])
 if r.Sign()==0||r.Cmp(curveN)>=0||s.Sign()==0||s.Cmp(curveHalfN)>0{return "",ErrAuthentication}
 // Ethereum ecrecover v 27/28 uses x=r; the rare recovery IDs 2/3
 // are unsupported and no ambiguous compressed/public keys are accepted.
 x:=new(big.Int).Set(r)
 y2:=new(big.Int).Exp(x,big.NewInt(3),curveP);y2.Add(y2,big.NewInt(7));y2.Mod(y2,curveP)
 exp:=new(big.Int).Add(curveP,big.NewInt(1));exp.Rsh(exp,2)
 y:=new(big.Int).Exp(y2,exp,curveP)
 if new(big.Int).Exp(y,big.NewInt(2),curveP).Cmp(y2)!=0{return "",ErrAuthentication}
 if y.Bit(0)!=uint(parity){y.Sub(curveP,y)}
 R:=curvePoint{x:x,y:y};if !curveValid(R){return "",ErrAuthentication}
 // Q=(s*R - z*G)/r (mod n), with the recovered public key checked
 // by Ethereum-address derivation; reject infinity or invalid curve points.
 z:=walletMessageDigest(message)
 zInt:=new(big.Int).SetBytes(z[:]);zInt.Mod(zInt,curveN)
 minusZ:=new(big.Int).Neg(zInt);minusZ.Mod(minusZ,curveN)
 inv:=new(big.Int).ModInverse(r,curveN);if inv==nil{return "",ErrAuthentication}
 point:=curveAdd(curveMult(R,s),curveMult(curvePoint{x:generatorX,y:generatorY},minusZ))
 pub:=curveMult(point,inv)
 if !curveValid(pub){return "",ErrAuthentication}
 // Sanity check recovered ECDSA pair independently.
 si:=new(big.Int).ModInverse(s,curveN);if si==nil{return "",ErrAuthentication}
 u:=new(big.Int).Mul(zInt,si);u.Mod(u,curveN)
 v:=new(big.Int).Mul(r,si);v.Mod(v,curveN)
 check:=curveAdd(curveMult(curvePoint{x:generatorX,y:generatorY},u),curveMult(pub,v))
 if check.infinity||new(big.Int).Mod(check.x,curveN).Cmp(r)!=0{return "",ErrAuthentication}
 return publicAddress(pub),nil
}
func verifyEOAWallet(message,address,signature string)bool{
 recovered,e:=walletRecoverEOA(message,signature)
 return e==nil&&bytes.Equal([]byte(recovered),[]byte(address))
}

// Adapted from the repository's independently qualified compute/worker/ethereum.go
// legacy Keccak-256 implementation. SHA3-256 is deliberately not substituted.
func walletKeccak(data []byte)[32]byte{
 const rate=136;var state [25]uint64
 absorb:=func(block []byte){for i:=0;i<rate/8;i++{j:=8*i;state[i]^=uint64(block[j])|uint64(block[j+1])<<8|uint64(block[j+2])<<16|uint64(block[j+3])<<24|uint64(block[j+4])<<32|uint64(block[j+5])<<40|uint64(block[j+6])<<48|uint64(block[j+7])<<56};walletKeccakF(&state)}
 for len(data)>=rate{absorb(data[:rate]);data=data[rate:]}
 var block [rate]byte;copy(block[:],data);block[len(data)]=1;block[rate-1]^=0x80;absorb(block[:])
 var out [32]byte;for i:=0;i<4;i++{v:=state[i];for j:=0;j<8;j++{out[8*i+j]=byte(v>>(8*j))}}
 return out
}
func walletKeccakF(a *[25]uint64){
 rc:=[24]uint64{1,0x8082,0x800000000000808a,0x8000000080008000,0x808b,0x80000001,0x8000000080008081,0x8000000000008009,0x8a,0x88,0x80008009,0x8a,0x800000008000000a,0x800000008000808b,0x800000000000008b,0x8000000000008089,0x8000000000008003,0x8000000000008002,0x8000000000000080,0x800a,0x800000008000000a,0x8000000080008081,0x8000000000008080,0x80000001,0x8000000080008008}
 rot:=[25]uint{0,1,62,28,27,36,44,6,55,20,3,10,43,25,39,41,45,15,21,8,18,2,61,56,14}
 left:=func(v uint64,n uint)uint64{if n==0{return v};return v<<n|v>>(64-n)}
 for _,round:=range rc{
  var c,d [5]uint64
  for x:=0;x<5;x++{c[x]=a[x]^a[x+5]^a[x+10]^a[x+15]^a[x+20]}
  for x:=0;x<5;x++{d[x]=c[(x+4)%5]^left(c[(x+1)%5],1)}
  for x:=0;x<5;x++{for y:=0;y<5;y++{a[x+5*y]^=d[x]}}
  var b [25]uint64
  for x:=0;x<5;x++{for y:=0;y<5;y++{idx:=x+5*y;b[y+5*((2*x+3*y)%5)]=left(a[idx],rot[idx])}}
  for x:=0;x<5;x++{for y:=0;y<5;y++{a[x+5*y]=b[x+5*y]^((^b[(x+1)%5+5*y])&b[(x+2)%5+5*y])}}
  a[0]^=round
 }
}
