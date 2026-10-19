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
func partialWitness() *PartialDecryptCircuit {
 base:=native.GetEdwardsCurve().Base
 c1:=new(native.PointAffine).ScalarMultiplication(&base,big.NewInt(409))
 sk:=big.NewInt(887)
 pk:=new(native.PointAffine).ScalarMultiplication(&base,sk)
 decryption:=new(native.PointAffine).ScalarMultiplication(c1,sk)
 c1x,c1y:=coordinates(c1)
 pkx,pky:=coordinates(pk)
 dx,dy:=coordinates(decryption)
 return &PartialDecryptCircuit{HandScope:420,Position:7,Street:1,ProviderIndex:0,
  CipherC1X:c1x,CipherC1Y:c1y,ProviderPKX:pkx,ProviderPKY:pky,
  ShareDX:dx,ShareDY:dy,SecretShare:sk}
}
func TestRealThresholdShareProofValidTamperedAndReplay(t *testing.T){
 cs,err:=frontend.Compile(ecc.BN254.ScalarField(),r1cs.NewBuilder,&PartialDecryptCircuit{})
 if err!=nil{t.Fatal(err)}
 pk,vk,err:=groth16.Setup(cs);if err!=nil{t.Fatal(err)}
 assignment:=partialWitness()
 witness,err:=frontend.NewWitness(assignment,ecc.BN254.ScalarField());if err!=nil{t.Fatal(err)}
 proof,err:=groth16.Prove(cs,pk,witness);if err!=nil{t.Fatalf("valid share proof: %v",err)}
 public,err:=witness.Public();if err!=nil{t.Fatal(err)}
 if err:=groth16.Verify(proof,vk,public);err!=nil{t.Fatalf("valid share rejected: %v",err)}
 changedHand:=*assignment
 changedHand.HandScope=421
 badWitness,err:=frontend.NewWitness(&changedHand,ecc.BN254.ScalarField());if err!=nil{t.Fatal(err)}
 badPublic,err:=badWitness.Public();if err!=nil{t.Fatal(err)}
 if err:=groth16.Verify(proof,vk,badPublic);err==nil{t.Fatal("cross-hand replay verified")}
 changedStreet:=*assignment
 changedStreet.Street=2
 streetWitness,err:=frontend.NewWitness(&changedStreet,ecc.BN254.ScalarField());if err!=nil{t.Fatal(err)}
 streetPublic,err:=streetWitness.Public();if err!=nil{t.Fatal(err)}
 if err:=groth16.Verify(proof,vk,streetPublic);err==nil{t.Fatal("unauthorized street replay verified")}
 changedShare:=*assignment
 changedShare.ShareDX=big.NewInt(42)
 wrongWitness,err:=frontend.NewWitness(&changedShare,ecc.BN254.ScalarField());if err!=nil{t.Fatal(err)}
 if _,err:=groth16.Prove(cs,pk,wrongWitness);err==nil{t.Fatal("invalid partial decryption share proved")}
}
