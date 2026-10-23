package shuffle

import (
 "math/big"
 "testing"

 "github.com/consensys/gnark-crypto/ecc"
 native "github.com/consensys/gnark-crypto/ecc/bn254/twistededwards"
 "github.com/consensys/gnark/backend/groth16"
 "github.com/consensys/gnark/frontend"
 "github.com/consensys/gnark/frontend/cs/r1cs"
)

// The same final 52-position ciphertext Merkle root, physical position,
// two independent provider keys and canonical unmask are proven together.
// This prevents a suite of individually valid but mutually unrelated proofs
// from being mistaken for an authenticated card revelation.
func TestWS4TwoGenuineProviderSharesAndMatchingCanonicalCard(t *testing.T) {
 base:=native.GetEdwardsCurve().Base
 secrets:=[2]*big.Int{big.NewInt(13),big.NewInt(17)}
 providers:=[2]*native.PointAffine{
  new(native.PointAffine).ScalarMultiplication(&base,secrets[0]),
  new(native.PointAffine).ScalarMultiplication(&base,secrets[1]),
 }
 aggregate:=new(native.PointAffine).Add(providers[0],providers[1])
 var cards [52]ElGamalCipher
 for i:=0;i<52;i++{
  a,b:=cipherOf(int64(i+1),int64(400+i),&base,aggregate)
  cards[i]=reencryptInput(a,b)
 }
 position:=5 // first legal board card for two participating players
 root,path:=nativeCipherRootAndPath(420,cards[:],position)
 c1:=new(native.PointAffine).ScalarMultiplication(&base,big.NewInt(int64(400+position)))
 c2point:=new(native.PointAffine).ScalarMultiplication(&base,big.NewInt(int64(position+1)))
 encryption:=new(native.PointAffine).ScalarMultiplication(aggregate,big.NewInt(int64(400+position)))
 c2point.Add(c2point,encryption)
 pkx,pky:=coordinates(aggregate)
 var shares [2]*native.PointAffine
 partialCS,err:=frontend.Compile(ecc.BN254.ScalarField(),r1cs.NewBuilder,&PartialDecryptCircuit{})
 if err!=nil{t.Fatal(err)}
 partialPK,partialVK,err:=groth16.Setup(partialCS);if err!=nil{t.Fatal(err)}
 for provider:=0;provider<2;provider++{
  share:=new(native.PointAffine).ScalarMultiplication(c1,secrets[provider])
  shares[provider]=share
  sx,sy:=coordinates(share)
  providerX,providerY:=coordinates(providers[provider])
  w:=&PartialDecryptCircuit{HandScope:420,DeckRoot:root,
   CipherC2X:cards[position].C2X,CipherC2Y:cards[position].C2Y,
   Position:position,Street:1,ProviderIndex:provider,
   CipherC1X:cards[position].C1X,CipherC1Y:cards[position].C1Y,
   ProviderPKX:providerX,ProviderPKY:providerY,ShareDX:sx,ShareDY:sy,
   SecretShare:secrets[provider]}
  for j:=0;j<6;j++{w.MerklePath[j]=path[j]}
  witness,err:=frontend.NewWitness(w,ecc.BN254.ScalarField());if err!=nil{t.Fatal(err)}
  proof,err:=groth16.Prove(partialCS,partialPK,witness);if err!=nil{t.Fatal(err)}
  pub,err:=witness.Public();if err!=nil{t.Fatal(err)}
  if err:=groth16.Verify(proof,partialVK,pub);err!=nil{t.Fatal(err)}
  name:="WS4JointPartialA"
  if provider==1{name="WS4JointPartialB"}
  exportTestGroth16Solidity(t,name,partialVK,proof,
   w.HandScope,w.DeckRoot,w.CipherC2X,w.CipherC2Y,
   w.Position,w.Street,w.ProviderIndex,w.CipherC1X,w.CipherC1Y,
   w.ProviderPKX,w.ProviderPKY,w.ShareDX,w.ShareDY)
 }
 ax,ay:=coordinates(providers[0]);bx,by:=coordinates(providers[1])
 dax,day:=coordinates(shares[0]);dbx,dby:=coordinates(shares[1])
 c2x,c2y:=coordinates(c2point)
 if c2x.(*big.Int).Cmp(cards[position].C2X.(*big.Int))!=0||
  c2y.(*big.Int).Cmp(cards[position].C2Y.(*big.Int))!=0{t.Fatal("ciphertext mismatch")}
 w:=&CardUnmaskCircuit{HandScope:420,DeckRoot:root,Position:position,
  Street:1,CardIndex:position,CipherC2X:c2x,CipherC2Y:c2y,
  ShareAX:dax,ShareAY:day,ShareBX:dbx,ShareBY:dby,
  ProviderAX:ax,ProviderAY:ay,ProviderBX:bx,ProviderBY:by,
  AggregatePKX:pkx,AggregatePKY:pky}
 unmaskCS,err:=frontend.Compile(ecc.BN254.ScalarField(),r1cs.NewBuilder,&CardUnmaskCircuit{})
 if err!=nil{t.Fatal(err)}
 unmaskPK,unmaskVK,err:=groth16.Setup(unmaskCS);if err!=nil{t.Fatal(err)}
 witness,err:=frontend.NewWitness(w,ecc.BN254.ScalarField());if err!=nil{t.Fatal(err)}
 proof,err:=groth16.Prove(unmaskCS,unmaskPK,witness);if err!=nil{t.Fatal(err)}
 pub,err:=witness.Public();if err!=nil{t.Fatal(err)}
 if err:=groth16.Verify(proof,unmaskVK,pub);err!=nil{t.Fatal(err)}
 exportTestGroth16Solidity(t,"WS4JointUnmask",unmaskVK,proof,
  w.HandScope,w.DeckRoot,w.Position,w.Street,w.CardIndex,
  w.CipherC2X,w.CipherC2Y,w.ShareAX,w.ShareAY,w.ShareBX,w.ShareBY,
  w.ProviderAX,w.ProviderAY,w.ProviderBX,w.ProviderBY,
  w.AggregatePKX,w.AggregatePKY)
 // Shared root, exactly the same encrypted physical card, correct both
 // providers and canonical CardIndex=5 are the accepted relation.
 if root.Sign()==0{t.Fatal("empty final root")}
 for j:=0;j<2;j++{
  alien:=new(native.PointAffine).ScalarMultiplication(c1,secrets[1-j])
  x,_:=coordinates(alien);wanted,_:=coordinates(shares[j])
  if x.(*big.Int).Cmp(wanted.(*big.Int))==0{t.Fatal("provider share substitution")}
 }
}
