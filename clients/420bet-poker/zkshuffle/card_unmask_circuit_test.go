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
func unmaskWitness()*CardUnmaskCircuit{
 base:=native.GetEdwardsCurve().Base
 a:=new(native.PointAffine).ScalarMultiplication(&base,big.NewInt(13))
 b:=new(native.PointAffine).ScalarMultiplication(&base,big.NewInt(17))
 agg:=new(native.PointAffine).Add(a,b)
 c1,c2:=cipherOf(21,23,&base,agg)
 partialA:=new(native.PointAffine).ScalarMultiplication(&c1,big.NewInt(13))
 partialB:=new(native.PointAffine).ScalarMultiplication(&c1,big.NewInt(17))
 ax,ay:=coordinates(a);bx,by:=coordinates(b);tx,ty:=coordinates(agg)
 x2,y2:=coordinates(&c2);dax,day:=coordinates(partialA);dbx,dby:=coordinates(partialB)
 return &CardUnmaskCircuit{HandScope:420,DeckRoot:1234,Position:20,Street:1,
  CardIndex:20,CipherC2X:x2,CipherC2Y:y2,
  ShareAX:dax,ShareAY:day,ShareBX:dbx,ShareBY:dby,
  ProviderAX:ax,ProviderAY:ay,ProviderBX:bx,ProviderBY:by,
  AggregatePKX:tx,AggregatePKY:ty}
}
func TestRealThresholdUnmaskProofValidInvalidAndReplay(t *testing.T){
 cs,err:=frontend.Compile(ecc.BN254.ScalarField(),r1cs.NewBuilder,&CardUnmaskCircuit{})
 if err!=nil{t.Fatal(err)}
 pk,vk,err:=groth16.Setup(cs);if err!=nil{t.Fatal(err)}
 valid:=unmaskWitness()
 w,err:=frontend.NewWitness(valid,ecc.BN254.ScalarField());if err!=nil{t.Fatal(err)}
 proof,err:=groth16.Prove(cs,pk,w);if err!=nil{t.Fatalf("valid threshold unmask: %v",err)}
 public,err:=w.Public();if err!=nil{t.Fatal(err)}
 if err:=groth16.Verify(proof,vk,public);err!=nil{t.Fatal(err)}
 exportTestGroth16Solidity(t,"CardUnmask",vk,proof,
  valid.HandScope,valid.DeckRoot,valid.Position,valid.Street,valid.CardIndex,
  valid.CipherC2X,valid.CipherC2Y,valid.ShareAX,valid.ShareAY,
  valid.ShareBX,valid.ShareBY,valid.ProviderAX,valid.ProviderAY,
  valid.ProviderBX,valid.ProviderBY,valid.AggregatePKX,valid.AggregatePKY)
 forged:=*valid
 forged.CardIndex=19
 badWitness,err:=frontend.NewWitness(&forged,ecc.BN254.ScalarField());if err!=nil{t.Fatal(err)}
 if _,err:=groth16.Prove(cs,pk,badWitness);err==nil{t.Fatal("wrong card silently proved")}
 wrongAggregate:=*valid
 wrongAggregate.AggregatePKX=big.NewInt(0)
 wrongAggregate.AggregatePKY=big.NewInt(1)
 aggWitness,err:=frontend.NewWitness(&wrongAggregate,ecc.BN254.ScalarField());if err!=nil{t.Fatal(err)}
 if _,err:=groth16.Prove(cs,pk,aggWitness);err==nil{t.Fatal("wrong threshold aggregate accepted")}

 showdown:=*valid
 showdown.Street=4
 showdownWitness,err:=frontend.NewWitness(&showdown,ecc.BN254.ScalarField());if err!=nil{t.Fatal(err)}
 showdownProof,err:=groth16.Prove(cs,pk,showdownWitness);if err!=nil{t.Fatalf("showdown card proof rejected: %v",err)}
 showdownPublic,err:=showdownWitness.Public();if err!=nil{t.Fatal(err)}
 if err:=groth16.Verify(showdownProof,vk,showdownPublic);err!=nil{t.Fatalf("valid showdown card proof rejected: %v",err)}
 illegalStreet:=*valid
 illegalStreet.Street=5
 illegalWitness,err:=frontend.NewWitness(&illegalStreet,ecc.BN254.ScalarField());if err!=nil{t.Fatal(err)}
 if _,err:=groth16.Prove(cs,pk,illegalWitness);err==nil{t.Fatal("street 5 card unmask proved")}
 replay:=*valid
 replay.HandScope=421
 other,err:=frontend.NewWitness(&replay,ecc.BN254.ScalarField());if err!=nil{t.Fatal(err)}
 otherPublic,err:=other.Public();if err!=nil{t.Fatal(err)}
 if err:=groth16.Verify(proof,vk,otherPublic);err==nil{t.Fatal("cross-hand reveal reused")}
}
