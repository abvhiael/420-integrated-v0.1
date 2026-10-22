package shuffle

import (
 "math/big"
 "github.com/consensys/gnark-crypto/ecc"
 nativeMiMC "github.com/consensys/gnark-crypto/ecc/bn254/fr/mimc"
)
func nativeMiMCHash(fields ...*big.Int)*big.Int{
 h:=nativeMiMC.NewMiMC()
 modulus:=ecc.BN254.ScalarField()
 for _,n:=range fields{
  x:=new(big.Int).Mod(new(big.Int).Set(n),modulus)
  buf:=x.FillBytes(make([]byte,32))
  if _,err:=h.Write(buf);err!=nil{panic(err)}
 }
 return new(big.Int).SetBytes(h.Sum(nil))
}
func nativeCipherRootAndPath(scope int64,cards []ElGamalCipher,position int)(*big.Int,[6]*big.Int){
 if len(cards)!=52 || position<0||position>51{panic("invalid deck or position")}
 var nodes [64]*big.Int
 for i:=0;i<52;i++{
  c:=cards[i]
  nodes[i]=nativeMiMCHash(
   big.NewInt(cipherLeafDomain),big.NewInt(scope),big.NewInt(int64(i)),
   c.C1X.(*big.Int),c.C1Y.(*big.Int),c.C2X.(*big.Int),c.C2Y.(*big.Int))
 }
 for i:=52;i<64;i++{nodes[i]=big.NewInt(0)}
 var path [6]*big.Int
 width,index:=64,position
 for depth:=0;depth<6;depth++{
  path[depth]=new(big.Int).Set(nodes[index^1])
  for j:=0;j<width/2;j++{
   nodes[j]=nativeMiMCHash(
    big.NewInt(cipherNodeDomain),big.NewInt(int64(depth)),nodes[2*j],nodes[2*j+1])
  }
  width/=2;index/=2
 }
 return nodes[0],path
}
