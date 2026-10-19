package shuffle

import (
 "math/big"
 "fmt"
 "testing"
 "os"
 "path/filepath"
 "github.com/consensys/gnark-crypto/ecc"
 native "github.com/consensys/gnark-crypto/ecc/bn254/twistededwards"
 "github.com/consensys/gnark/backend/groth16"
 "github.com/consensys/gnark/frontend"
 "github.com/consensys/gnark/frontend/cs/r1cs"
)

// This test runs a REAL 52-ciphertext, 52-permutation-position proof, NOT
// a 2-card mock, hash commitment, 52-card compile-only check or fabricated vk.
func TestFull52RealEncryptedShuffleProof(t *testing.T) {
 curve:=native.GetEdwardsCurve()
 base:=curve.Base
 pub:=new(native.PointAffine).ScalarMultiplication(&base,big.NewInt(1729))
 pkX,pkY:=coordinates(pub)
 witness:=&Reencrypt52{HandScope:420,PublicKeyX:pkX,PublicKeyY:pkY}
 for i:=0;i<52;i++ {
  c1,c2:=cipherOf(int64(i+1),int64(i+100),&base,pub)
  witness.Input[i]=reencryptInput(c1,c2)
 }
 for i:=0;i<52;i++ {
  pos:=51-i
  c1,c2:=cipherOf(int64(pos+1),int64(pos+100),&base,pub)
  r:=int64(i+1000)
  deltaG:=new(native.PointAffine).ScalarMultiplication(&base,big.NewInt(r))
  deltaK:=new(native.PointAffine).ScalarMultiplication(pub,big.NewInt(r))
  finalC1:=new(native.PointAffine).Add(&c1,deltaG)
  finalC2:=new(native.PointAffine).Add(&c2,deltaK)
  witness.Output[i]=reencryptInput(*finalC1,*finalC2)
  witness.Indices[i]=pos
  witness.Nonces[i]=r
 }
 inputRoot,_:=nativeCipherRootAndPath(420,witness.Input[:],0)
 outputRoot,_:=nativeCipherRootAndPath(420,witness.Output[:],0)
 witness.InputRoot=inputRoot;witness.OutputRoot=outputRoot
 cs,err:=frontend.Compile(ecc.BN254.ScalarField(),r1cs.NewBuilder,&Reencrypt52{})
 if err!=nil {t.Fatalf("compile full 52-card relation: %v",err)}
 t.Logf("full 52-card constraints: %d",cs.GetNbConstraints())
 provingKey,verifyingKey,err:=groth16.Setup(cs)
 if err!=nil {t.Fatalf("full 52-card setup: %v",err)}
 fullWitness,err:=frontend.NewWitness(witness,ecc.BN254.ScalarField())
 if err!=nil {t.Fatal(err)}
 proof,err:=groth16.Prove(cs,provingKey,fullWitness)
 if err!=nil {t.Fatalf("full 52-card proof generation failed: %v",err)}
 public,err:=fullWitness.Public()
 if err!=nil {t.Fatal(err)}
 if err=groth16.Verify(proof,verifyingKey,public);err!=nil {
  t.Fatalf("full 52-card proof rejected: %v",err)
 }
 // Export the exact source-correlated generated Solidity verifier and key
 // artifacts, never claiming this test-generated SRS is production trusted.
 if dir:=os.Getenv("POKER_ZK_ARTIFACT_DIR");dir!=""{
  if err:=os.MkdirAll(dir,0755);err!=nil{t.Fatal(err)}
  write:=func(filename string,produce func(*os.File)error){
   t.Helper()
   file,err:=os.Create(filepath.Join(dir,filename));if err!=nil{t.Fatal(err)}
   if err=produce(file);err!=nil{file.Close();t.Fatal(err)}
   if err=file.Close();err!=nil{t.Fatal(err)}
  }
  write("EXPERIMENTAL-Reencrypt52Verifier.sol",func(f *os.File)error{
   return verifyingKey.ExportSolidity(f)
  })
  write("EXPERIMENTAL-Reencrypt52VerifyingKey.bin",func(f *os.File)error{
   _,err:=verifyingKey.WriteTo(f);return err
  })
  write("EXPERIMENTAL-Reencrypt52Proof.bin",func(f *os.File)error{
   _,err:=proof.WriteTo(f);return err
  })
  write("EXPERIMENTAL-Reencrypt52PublicWitness.bin",func(f *os.File)error{
   _,err:=public.WriteTo(f);return err
  })
  // The Solidity verifier receives the precise gnark BN254 8-word proof and
  // five public circuit inputs. This fixture is generated in the SAME run as
  // the proof and VK, never copied from a mock or an unrelated test setup.
  rawProof,ok:=proof.(interface{MarshalSolidity() []byte})
  if !ok {t.Fatal("BN254 proof does not support Solidity serialization")}
  write("EXPERIMENTAL-Reencrypt52SolidityFixture.json",func(f *os.File)error{
   _,err:=fmt.Fprintf(f,`{"proof":"0x%x","public":["%s","%s","420","%s","%s"]}`,
     rawProof.MarshalSolidity(),inputRoot.String(),outputRoot.String(),
     pkX.(*big.Int).String(),pkY.(*big.Int).String())
   return err
  })
 }
 // Sound verifier rejects a changed public deck output AND replay into another hand.
 wrongDeck:=*witness
 wrongDeck.OutputRoot=big.NewInt(42)
 changedWitness,err:=frontend.NewWitness(&wrongDeck,ecc.BN254.ScalarField())
 if err!=nil {t.Fatal(err)}
 changedPublic,err:=changedWitness.Public();if err!=nil {t.Fatal(err)}
 if err=groth16.Verify(proof,verifyingKey,changedPublic);err==nil {
  t.Fatal("actual 52-card verifier accepted modified ciphertext")
 }
 wrongHand:=*witness
 wrongHand.HandScope=421
 handWitness,err:=frontend.NewWitness(&wrongHand,ecc.BN254.ScalarField())
 if err!=nil {t.Fatal(err)}
 handPublic,err:=handWitness.Public();if err!=nil {t.Fatal(err)}
 if err=groth16.Verify(proof,verifyingKey,handPublic);err==nil {
  t.Fatal("actual 52-card verifier accepted replay for different hand")
 }
}
