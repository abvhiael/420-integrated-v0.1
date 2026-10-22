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
func TestRecipientPublicKeyProofOfPossession(t *testing.T){
 cs,err:=frontend.Compile(ecc.BN254.ScalarField(),r1cs.NewBuilder,&RecipientKeyPossessionV1{})
 if err!=nil{t.Fatal(err)}
 pk,vk,err:=groth16.Setup(cs);if err!=nil{t.Fatal(err)}
 base:=native.GetEdwardsCurve().Base
 secret:=big.NewInt(1021)
 pubkey:=new(native.PointAffine).ScalarMultiplication(&base,secret)
 x,y:=coordinates(pubkey)
 valid:=&RecipientKeyPossessionV1{Scope:6677,KeyX:x,KeyY:y,Secret:secret}
 w,err:=frontend.NewWitness(valid,ecc.BN254.ScalarField());if err!=nil{t.Fatal(err)}
 proof,err:=groth16.Prove(cs,pk,w);if err!=nil{t.Fatal(err)}
 public,err:=w.Public();if err!=nil{t.Fatal(err)}
 if err:=groth16.Verify(proof,vk,public);err!=nil{t.Fatal(err)}
 exportTestGroth16Solidity(t,"RecipientKeyPossession",vk,proof,valid.Scope,valid.KeyX,valid.KeyY)
 bad:=*valid;bad.Secret=big.NewInt(1022)
 bw,err:=frontend.NewWitness(&bad,ecc.BN254.ScalarField());if err!=nil{t.Fatal(err)}
 if _,err:=groth16.Prove(cs,pk,bw);err==nil{t.Fatal("wrong recipient secret proved")}
 replay:=*valid;replay.Scope=6678
 rw,err:=frontend.NewWitness(&replay,ecc.BN254.ScalarField());if err!=nil{t.Fatal(err)}
 rp,err:=rw.Public();if err!=nil{t.Fatal(err)}
 if err:=groth16.Verify(proof,vk,rp);err==nil{t.Fatal("cross-epoch proof replay accepted")}
}
