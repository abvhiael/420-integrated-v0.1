package shuffle

import (
 "math/big"
 "testing"
 "os"
 "path/filepath"
 "github.com/consensys/gnark-crypto/ecc"
 native "github.com/consensys/gnark-crypto/ecc/bn254/twistededwards"
 "github.com/consensys/gnark/backend/groth16"
 "github.com/consensys/gnark/frontend"
 "github.com/consensys/gnark/frontend/cs/r1cs"
)

// TestFullInitial52RealProof certifies a full 52-card canonical encryption
// statement, not a two-card demonstration or merely successful compilation.
// The test ceremony proving key is intentionally NOT a production SRS.
func TestFullInitial52RealProof(t *testing.T) {
 curve:=native.GetEdwardsCurve()
 base:=curve.Base
 thresholdPK:=new(native.PointAffine).ScalarMultiplication(&base,big.NewInt(1729))
 pkX,pkY:=coordinates(thresholdPK)
 inverse8:=new(big.Int).ModInverse(big.NewInt(8),&curve.Order)
 if inverse8==nil{t.Fatal("cofactor not invertible in subgroup")}
 subgroupQ:=new(native.PointAffine).ScalarMultiplication(thresholdPK,inverse8)
 qx,qy:=coordinates(subgroupQ)
 w:=&InitialDeck52{HandScope:420,StatementScope:123456,PublicKeyX:pkX,PublicKeyY:pkY,SubgroupPreimageX:qx,SubgroupPreimageY:qy}
 for i:=0;i<52;i++ {
  randomness:=int64(i+100)
  c1,c2:=cipherOf(int64(i+1),randomness,&base,thresholdPK)
  w.Cards[i]=reencryptInput(c1,c2)
  w.Randomness[i]=randomness
 }
 root,_:=nativeCipherRootAndPath(420,w.Cards[:],0)
 w.DeckRoot=root
 cs,err:=frontend.Compile(ecc.BN254.ScalarField(),r1cs.NewBuilder,&InitialDeck52{})
 if err!=nil{t.Fatal(err)}
 t.Logf("canonical initial 52-card constraints: %d",cs.GetNbConstraints())
 pk,vk,err:=groth16.Setup(cs);if err!=nil{t.Fatal(err)}
 witness,err:=frontend.NewWitness(w,ecc.BN254.ScalarField());if err!=nil{t.Fatal(err)}
 proof,err:=groth16.Prove(cs,pk,witness);if err!=nil{t.Fatalf("full encrypted initial deck: %v",err)}
 public,err:=witness.Public();if err!=nil{t.Fatal(err)}
 if err:=groth16.Verify(proof,vk,public);err!=nil{t.Fatalf("valid initial deck rejected: %v",err)}
 exportTestGroth16Solidity(t,"InitialDeck52",vk,proof,
  w.DeckRoot,w.StatementScope,w.HandScope,w.PublicKeyX,w.PublicKeyY)
 // Adversarial relation checks reuse this exact compiled 52-card circuit.
 // They never replace the genuine valid proof and verifier acceptance above.
 assertUnsatisfied:=func(label string, forged *InitialDeck52){
  t.Helper()
  x,err:=frontend.NewWitness(forged,ecc.BN254.ScalarField())
  if err!=nil{return} // missing or noncanonical field representation is rejected
  if err:=cs.IsSolved(x);err==nil{t.Fatalf("%s satisfied authentic 52-card constraints",label)}
 }
 duplicate:=*w;duplicate.Cards[1]=w.Cards[0]
 assertUnsatisfied("duplicated encrypted position",&duplicate)
 tamperedCipher:=*w;tamperedCipher.Cards[19].C2X=big.NewInt(987654)
 assertUnsatisfied("altered card ciphertext",&tamperedCipher)
 missingPosition:=*w;missingPosition.Cards[51]=ElGamalCipher{C1X:0,C1Y:0,C2X:0,C2Y:0}
 assertUnsatisfied("missing ciphertext position",&missingPosition)
 zeroNonce:=*w;zeroNonce.Randomness[12]=0
 assertUnsatisfied("zero encryption nonce",&zeroNonce)
 wrongPublicKey:=*w;wrongPublicKey.PublicKeyX=big.NewInt(99)
 assertUnsatisfied("malformed public key",&wrongPublicKey)
 wrongStatement:=*w;wrongStatement.StatementScope=0
 assertUnsatisfied("zero statement digest",&wrongStatement)
 badSubgroup:=*w
 badSubgroup.SubgroupPreimageX=big.NewInt(42)
 badSubgroupWitness,err:=frontend.NewWitness(&badSubgroup,ecc.BN254.ScalarField());if err!=nil{t.Fatal(err)}
 if _,err:=groth16.Prove(cs,pk,badSubgroupWitness);err==nil{t.Fatal("invalid subgroup preimage accepted")}
 tampered:=*w;tampered.DeckRoot=big.NewInt(123)
 badWitness,err:=frontend.NewWitness(&tampered,ecc.BN254.ScalarField());if err!=nil{t.Fatal(err)}
 badPublic,err:=badWitness.Public();if err!=nil{t.Fatal(err)}
 if err:=groth16.Verify(proof,vk,badPublic);err==nil{t.Fatal("changed initial deck root verified")}
 wrongContext:=*w;wrongContext.StatementScope=123457
 wrongContextWitness,err:=frontend.NewWitness(&wrongContext,ecc.BN254.ScalarField());if err!=nil{t.Fatal(err)}
 wrongContextPublic,err:=wrongContextWitness.Public();if err!=nil{t.Fatal(err)}
 if err:=groth16.Verify(proof,vk,wrongContextPublic);err==nil{t.Fatal("changed full initial-deck context verified")}
 replay:=*w;replay.HandScope=421
 replayWitness,err:=frontend.NewWitness(&replay,ecc.BN254.ScalarField());if err!=nil{t.Fatal(err)}
 replayPublic,err:=replayWitness.Public();if err!=nil{t.Fatal(err)}
 if err:=groth16.Verify(proof,vk,replayPublic);err==nil{t.Fatal("cross-hand initial deck verified")}
 if dir:=os.Getenv("POKER_ZK_ARTIFACT_DIR");dir!=""{
  if err:=os.MkdirAll(dir,0755);err!=nil{t.Fatal(err)}
  file:=func(name string,serialize func(*os.File)error){
   t.Helper()
   path:=filepath.Join(dir,name)
   f,err:=os.Create(path);if err!=nil{t.Fatal(err)}
   if err:=serialize(f);err!=nil{f.Close();t.Fatal(err)}
   if err:=f.Close();err!=nil{t.Fatal(err)}
  }
  file("EXPERIMENTAL-InitialDeck52Verifier.sol",func(f *os.File)error{return vk.ExportSolidity(f)})
  file("EXPERIMENTAL-InitialDeck52VK.bin",func(f *os.File)error{_,err:=vk.WriteTo(f);return err})
  file("EXPERIMENTAL-InitialDeck52Proof.bin",func(f *os.File)error{_,err:=proof.WriteTo(f);return err})
 }
}
