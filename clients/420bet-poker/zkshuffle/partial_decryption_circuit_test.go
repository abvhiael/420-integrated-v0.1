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
 sk:=big.NewInt(887)
 pk:=new(native.PointAffine).ScalarMultiplication(&base,sk)
 var cards [52]ElGamalCipher
 for i:=0;i<52;i++{
  c1,c2:=cipherOf(int64(i+1),int64(i+400),&base,pk)
  cards[i]=reencryptInput(c1,c2)
 }
 root,path:=nativeCipherRootAndPath(420,cards[:],7)
 c1:=new(native.PointAffine).ScalarMultiplication(&base,big.NewInt(407))
 decryption:=new(native.PointAffine).ScalarMultiplication(c1,sk)
 c1x,c1y:=coordinates(c1)
 pkx,pky:=coordinates(pk)
 dx,dy:=coordinates(decryption)
 assignment:=&PartialDecryptCircuit{HandScope:420,DeckRoot:root,Position:7,Street:1,ProviderIndex:0,
  CipherC1X:c1x,CipherC1Y:c1y,
  CipherC2X:cards[7].C2X,CipherC2Y:cards[7].C2Y,
  ProviderPKX:pkx,ProviderPKY:pky,
  ShareDX:dx,ShareDY:dy,SecretShare:sk}
 for i:=0;i<6;i++{assignment.MerklePath[i]=path[i]}
 return assignment
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
 badRoot:=*assignment
 badRoot.DeckRoot=big.NewInt(1234)
 rootWitness,err:=frontend.NewWitness(&badRoot,ecc.BN254.ScalarField());if err!=nil{t.Fatal(err)}
 rootPublic,err:=rootWitness.Public();if err!=nil{t.Fatal(err)}
 if err:=groth16.Verify(proof,vk,rootPublic);err==nil{t.Fatal("unbound ciphertext root accepted")}
 changedShare:=*assignment
 changedShare.ShareDX=big.NewInt(42)
 wrongWitness,err:=frontend.NewWitness(&changedShare,ecc.BN254.ScalarField());if err!=nil{t.Fatal(err)}
 if _,err:=groth16.Prove(cs,pk,wrongWitness);err==nil{t.Fatal("invalid partial decryption share proved")}
}
