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
func TestGenuineProviderKeyAggregateProof(t *testing.T){
 cs,err:=frontend.Compile(ecc.BN254.ScalarField(),r1cs.NewBuilder,&ThresholdKeyAggregateV1{})
 if err!=nil{t.Fatal(err)}
 pk,vk,err:=groth16.Setup(cs);if err!=nil{t.Fatal(err)}
 g:=native.GetEdwardsCurve().Base
 a:=new(native.PointAffine).ScalarMultiplication(&g,big.NewInt(887))
 b:=new(native.PointAffine).ScalarMultiplication(&g,big.NewInt(997))
 sum:=new(native.PointAffine).Add(a,b)
 ax,ay:=coordinates(a);bx,by:=coordinates(b);tx,ty:=coordinates(sum)
 valid:=&ThresholdKeyAggregateV1{Scope:12345,ProviderAX:ax,ProviderAY:ay,
  ProviderBX:bx,ProviderBY:by,AggregateX:tx,AggregateY:ty}
 w,err:=frontend.NewWitness(valid,ecc.BN254.ScalarField());if err!=nil{t.Fatal(err)}
 proof,err:=groth16.Prove(cs,pk,w);if err!=nil{t.Fatal(err)}
 pub,err:=w.Public();if err!=nil{t.Fatal(err)}
 if err:=groth16.Verify(proof,vk,pub);err!=nil{t.Fatal(err)}
 exportTestGroth16Solidity(t,"ThresholdKeyAggregate",vk,proof,valid.Scope,
  valid.ProviderAX,valid.ProviderAY,valid.ProviderBX,valid.ProviderBY,
  valid.AggregateX,valid.AggregateY)
 bad:=*valid;bad.AggregateX=big.NewInt(1)
 wbad,err:=frontend.NewWitness(&bad,ecc.BN254.ScalarField());if err!=nil{t.Fatal(err)}
 if _,err:=groth16.Prove(cs,pk,wbad);err==nil{t.Fatal("forged aggregate proved")}
 replay:=*valid;replay.Scope=12346
 wr,err:=frontend.NewWitness(&replay,ecc.BN254.ScalarField());if err!=nil{t.Fatal(err)}
 pubr,err:=wr.Public();if err!=nil{t.Fatal(err)}
 if err:=groth16.Verify(proof,vk,pubr);err==nil{t.Fatal("cross-domain aggregate proof accepted")}
}
