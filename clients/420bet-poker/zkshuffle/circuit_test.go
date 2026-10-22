package shuffle

import (
 "math/big"
 "testing"
 "github.com/consensys/gnark-crypto/ecc"
 mimcnative "github.com/consensys/gnark-crypto/ecc/bn254/fr/mimc"
 "github.com/consensys/gnark/backend/groth16"
 "github.com/consensys/gnark/constraint"
 "github.com/consensys/gnark/frontend"
 "github.com/consensys/gnark/frontend/cs/r1cs"
)
func witnessFor(reverse bool) *Circuit {
 c:=&Circuit{HandDomain:777}
 for i:=0;i<52;i++ {
  card:=i
  if reverse {card=51-i}
  salt:=i+12345
  c.Cards[i]=card
  c.Salts[i]=salt
  h:=mimcnative.NewMiMC()
  for _,v:=range []int{777,i,card,salt} {
   b:=new(big.Int).SetInt64(int64(v)).FillBytes(make([]byte,32))
   _,_ =h.Write(b)
  }
  c.Outputs[i]=new(big.Int).SetBytes(h.Sum(nil))
 }
 return c
}
func compile(t *testing.T) constraint.ConstraintSystem {
 t.Helper()
 var circuit Circuit
 ccs,err:=frontend.Compile(ecc.BN254.ScalarField(),r1cs.NewBuilder,&circuit)
 if err!=nil {t.Fatal(err)}
 return ccs
}
func TestRealGroth16ProofValidAndInvalid(t *testing.T){
 if testing.Short(){t.Skip("proof generation in full scoped CI only")}
 cs:=compile(t)
 pk,vk,err:=groth16.Setup(cs);if err!=nil{t.Fatal(err)}
 valid:=witnessFor(true)
 w,err:=frontend.NewWitness(valid,ecc.BN254.ScalarField());if err!=nil{t.Fatal(err)}
 proof,err:=groth16.Prove(cs,pk,w);if err!=nil{t.Fatal(err)}
 public,err:=w.Public();if err!=nil{t.Fatal(err)}
 if err=groth16.Verify(proof,vk,public);err!=nil{t.Fatalf("valid proof: %v",err)}
 // Statement mutation MUST fail with the genuine verifier.
 tampered:=witnessFor(true)
 tampered.Outputs[0]=big.NewInt(42)
 badW,err:=frontend.NewWitness(tampered,ecc.BN254.ScalarField());if err!=nil{t.Fatal(err)}
 badPublic,err:=badW.Public();if err!=nil{t.Fatal(err)}
 if err=groth16.Verify(proof,vk,badPublic);err==nil{t.Fatal("modified public output verified")}
 // Duplicate cards MUST be rejected by the prover's constraints.
 duplicate:=witnessFor(false)
 duplicate.Cards[1]=0
 duplicateWitness,err:=frontend.NewWitness(duplicate,ecc.BN254.ScalarField());if err!=nil{t.Fatal(err)}
 if _,err=groth16.Prove(cs,pk,duplicateWitness);err==nil{t.Fatal("duplicate card accepted")}
}
