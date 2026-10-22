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
func initialTwoWitness() *InitialDeck2 {
 base:=native.GetEdwardsCurve().Base
 pub:=new(native.PointAffine).ScalarMultiplication(&base,big.NewInt(17))
 pkx,pky:=coordinates(pub)
  params:=native.GetEdwardsCurve()
  inverse8:=new(big.Int).ModInverse(big.NewInt(8),&params.Order)
  subgroupQ:=new(native.PointAffine).ScalarMultiplication(pub,inverse8)
  qx,qy:=coordinates(subgroupQ)
 assignment:=&InitialDeck2{HandScope:420,PublicKeyX:pkx,PublicKeyY:pky,SubgroupPreimageX:qx,SubgroupPreimageY:qy}
 for i:=0;i<2;i++ {
  c1,c2:=cipherOf(int64(i+1),int64(i+100),&base,pub)
  assignment.Cards[i]=reencryptInput(c1,c2)
  assignment.Randomness[i]=i+100
 }
 return assignment
}
func TestInitialEncryptedDeckRealProofAndTamper(t *testing.T) {
 cs,err:=frontend.Compile(ecc.BN254.ScalarField(),r1cs.NewBuilder,&InitialDeck2{})
 if err!=nil{t.Fatal(err)}
 pk,vk,err:=groth16.Setup(cs);if err!=nil{t.Fatal(err)}
 w:=initialTwoWitness()
 witness,err:=frontend.NewWitness(w,ecc.BN254.ScalarField());if err!=nil{t.Fatal(err)}
 proof,err:=groth16.Prove(cs,pk,witness);if err!=nil{t.Fatalf("valid initial encryption proof: %v",err)}
 public,err:=witness.Public();if err!=nil{t.Fatal(err)}
 if err:=groth16.Verify(proof,vk,public);err!=nil{t.Fatal(err)}
 forged:=*w
 forged.Cards[1]=w.Cards[0]
 invalid,err:=frontend.NewWitness(&forged,ecc.BN254.ScalarField());if err!=nil{t.Fatal(err)}
 if _,err:=groth16.Prove(cs,pk,invalid);err==nil{t.Fatal("duplicated canonical card encryption proved")}
 wrongHand:=*w
 wrongHand.HandScope=421
 changed,err:=frontend.NewWitness(&wrongHand,ecc.BN254.ScalarField());if err!=nil{t.Fatal(err)}
 changedPublic,err:=changed.Public();if err!=nil{t.Fatal(err)}
 if err:=groth16.Verify(proof,vk,changedPublic);err==nil{t.Fatal("initial deck proof replayed across hands")}
}
func TestCompileCanonicalInitialEncrypted52(t *testing.T) {
 cs,err:=frontend.Compile(ecc.BN254.ScalarField(),r1cs.NewBuilder,&InitialDeck52{})
 if err!=nil{t.Fatal(err)}
 if cs.GetNbConstraints()<=0{t.Fatal("no constraints")}
}
