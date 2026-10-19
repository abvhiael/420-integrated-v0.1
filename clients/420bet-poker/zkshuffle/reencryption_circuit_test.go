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
func coordinates(p *native.PointAffine)(interface{},interface{}){
 var x,y big.Int;p.X.BigInt(&x);p.Y.BigInt(&y);return &x,&y
}
func cipherOf(m,r int64,base,pub *native.PointAffine)(native.PointAffine,native.PointAffine){
 mg:=new(native.PointAffine).ScalarMultiplication(base,big.NewInt(m))
 rG:=new(native.PointAffine).ScalarMultiplication(base,big.NewInt(r))
 rK:=new(native.PointAffine).ScalarMultiplication(pub,big.NewInt(r))
 c2:=new(native.PointAffine).Add(mg,rK)
 return *rG,*c2
}
func reencryptInput(c1,c2 native.PointAffine)ElGamalCipher{
 x1,y1:=coordinates(&c1);x2,y2:=coordinates(&c2)
 return ElGamalCipher{C1X:x1,C1Y:y1,C2X:x2,C2Y:y2}
}
func buildTwoCardWitness() *Reencrypt2 {
 curve:=native.GetEdwardsCurve()
 base:=curve.Base
 pub:=new(native.PointAffine).ScalarMultiplication(&base,big.NewInt(13))
 pkx,pky:=coordinates(pub)
 v:=&Reencrypt2{HandScope:777,PublicKeyX:pkx,PublicKeyY:pky}
 for i:=0;i<2;i++{
  c1,c2:=cipherOf(int64(i+3),int64(i+17),&base,pub)
  v.Input[i]=reencryptInput(c1,c2)
 }
 for i:=0;i<2;i++ {
  pos:=1-i
  c1,c2:=cipherOf(int64(pos+3),int64(pos+17),&base,pub)
  r:=int64(i+7)
  plusG:=new(native.PointAffine).ScalarMultiplication(&base,big.NewInt(r))
  plusK:=new(native.PointAffine).ScalarMultiplication(pub,big.NewInt(r))
  outC1:=new(native.PointAffine).Add(&c1,plusG)
  outC2:=new(native.PointAffine).Add(&c2,plusK)
  v.Output[i]=reencryptInput(*outC1,*outC2)
  v.Indices[i]=pos
  v.Nonces[i]=r
 }
 return v
}
func TestRealEncryptedReencryptionGroth16(t *testing.T){
 cs,err:=frontend.Compile(ecc.BN254.ScalarField(),r1cs.NewBuilder,&Reencrypt2{})
 if err!=nil{t.Fatal(err)}
 provingKey,verifyingKey,err:=groth16.Setup(cs);if err!=nil{t.Fatal(err)}
 valid:=buildTwoCardWitness()
 witness,err:=frontend.NewWitness(valid,ecc.BN254.ScalarField());if err!=nil{t.Fatal(err)}
 proof,err:=groth16.Prove(cs,provingKey,witness);if err!=nil{t.Fatalf("genuine valid encrypted-shuffle proof: %v",err)}
 public,err:=witness.Public();if err!=nil{t.Fatal(err)}
 if err:=groth16.Verify(proof,verifyingKey,public);err!=nil{t.Fatalf("valid proof rejected: %v",err)}
 bad:=buildTwoCardWitness()
 bad.Output[0].C1X=big.NewInt(42)
 altered,err:=frontend.NewWitness(bad,ecc.BN254.ScalarField());if err!=nil{t.Fatal(err)}
 alteredPublic,err:=altered.Public();if err!=nil{t.Fatal(err)}
 if err:=groth16.Verify(proof,verifyingKey,alteredPublic);err==nil{t.Fatal("tampered ciphertext wrongly accepted")}
 alteredScope:=buildTwoCardWitness()
 alteredScope.HandScope=888
 wrongScope,err:=frontend.NewWitness(alteredScope,ecc.BN254.ScalarField());if err!=nil{t.Fatal(err)}
 wrongScopePublic,err:=wrongScope.Public();if err!=nil{t.Fatal(err)}
 if err:=groth16.Verify(proof,verifyingKey,wrongScopePublic);err==nil{t.Fatal("reused proof accepted for different hand scope")}
 duplicate:=buildTwoCardWitness()
 duplicate.Indices[1]=duplicate.Indices[0]
 badWitness,err:=frontend.NewWitness(duplicate,ecc.BN254.ScalarField());if err!=nil{t.Fatal(err)}
 if _,err:=groth16.Prove(cs,provingKey,badWitness);err==nil{t.Fatal("duplicated encrypted-card index wrongly accepted")}
}
func TestCompileFull52EncryptedDeckRelation(t *testing.T){
 cs,err:=frontend.Compile(ecc.BN254.ScalarField(),r1cs.NewBuilder,&Reencrypt52{})
 if err!=nil{t.Fatal(err)}
 if cs.GetNbConstraints()==0{t.Fatal("unenforced relation")}
}
