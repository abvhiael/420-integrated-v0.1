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

func encryptedShareWitness()*EncryptedShareDeliveryV1{
 base:=native.GetEdwardsCurve().Base
 sk:=big.NewInt(887)
 recipientSecret:=big.NewInt(1021)
 nonce:=big.NewInt(773)
 provider:=new(native.PointAffine).ScalarMultiplication(&base,sk)
 recipient:=new(native.PointAffine).ScalarMultiplication(&base,recipientSecret)
 var cards [52]ElGamalCipher
 var chosen native.PointAffine
 for i:=0;i<52;i++{
  c1,c2:=cipherOf(int64(i+1),int64(i+400),&base,provider)
  cards[i]=reencryptInput(c1,c2)
  if i==7{chosen=c1}
 }
 root,path:=nativeCipherRootAndPath(420,cards[:],7)
 share:=new(native.PointAffine).ScalarMultiplication(&chosen,sk)
 u:=new(native.PointAffine).ScalarMultiplication(&base,nonce)
 v:=new(native.PointAffine).Add(share,new(native.PointAffine).ScalarMultiplication(recipient,nonce))
 px,py:=coordinates(provider);qx,qy:=coordinates(recipient)
 ux,uy:=coordinates(u);vx,vy:=coordinates(v)
 w:=&EncryptedShareDeliveryV1{HandScope:420,DeckRoot:root,Position:7,
  Seat:1,ProviderIndex:0,DeliveryContext:big.NewInt(112233),
  CipherC1X:cards[7].C1X,CipherC1Y:cards[7].C1Y,
  CipherC2X:cards[7].C2X,CipherC2Y:cards[7].C2Y,
  ProviderPKX:px,ProviderPKY:py,RecipientPKX:qx,RecipientPKY:qy,
  EnvelopeUX:ux,EnvelopeUY:uy,EnvelopeVX:vx,EnvelopeVY:vy,
  ProviderSecret:sk,EncryptionNonce:nonce}
 for i:=0;i<6;i++{w.MerklePath[i]=path[i]}
 return w
}

func TestEncryptedShareDeliveryProofAndAdversarialRejections(t *testing.T){
 cs,err:=frontend.Compile(ecc.BN254.ScalarField(),r1cs.NewBuilder,&EncryptedShareDeliveryV1{})
 if err!=nil{t.Fatal(err)}
 pk,vk,err:=groth16.Setup(cs);if err!=nil{t.Fatal(err)}
 valid:=encryptedShareWitness()
 w,err:=frontend.NewWitness(valid,ecc.BN254.ScalarField());if err!=nil{t.Fatal(err)}
 proof,err:=groth16.Prove(cs,pk,w);if err!=nil{t.Fatalf("valid encrypted threshold share did not prove: %v",err)}
 pub,err:=w.Public();if err!=nil{t.Fatal(err)}
 if err:=groth16.Verify(proof,vk,pub);err!=nil{t.Fatal(err)}
 exportTestGroth16Solidity(t,"EncryptedShareDelivery",vk,proof,
  valid.HandScope,valid.DeckRoot,valid.Position,valid.Seat,valid.ProviderIndex,
  valid.DeliveryContext,valid.CipherC1X,valid.CipherC1Y,valid.CipherC2X,
  valid.CipherC2Y,valid.ProviderPKX,valid.ProviderPKY,valid.RecipientPKX,
  valid.RecipientPKY,valid.EnvelopeUX,valid.EnvelopeUY,valid.EnvelopeVX,
  valid.EnvelopeVY)
 for _,tc:=range []struct{
  name string
  edit func(*EncryptedShareDeliveryV1)
 }{
  {"invalid envelope",func(x *EncryptedShareDeliveryV1){x.EnvelopeVX=big.NewInt(1)}},
  {"wrong provider",func(x *EncryptedShareDeliveryV1){x.ProviderPKX=big.NewInt(1)}},
  {"wrong recipient",func(x *EncryptedShareDeliveryV1){x.RecipientPKX=big.NewInt(1)}},
  {"wrong merkle root",func(x *EncryptedShareDeliveryV1){x.DeckRoot=big.NewInt(1)}},
  {"wrong card ciphertext",func(x *EncryptedShareDeliveryV1){x.CipherC1X=big.NewInt(1)}},
 }{
  t.Run(tc.name,func(t *testing.T){
   bad:=*valid;tc.edit(&bad)
   bw,err:=frontend.NewWitness(&bad,ecc.BN254.ScalarField());if err!=nil{t.Fatal(err)}
   if _,err:=groth16.Prove(cs,pk,bw);err==nil{t.Fatal("forged recipient delivery proved")}
  })
 }
 for _,tc:=range []struct{name string;edit func(*EncryptedShareDeliveryV1)}{
  {"hand",func(x *EncryptedShareDeliveryV1){x.HandScope=421}},
  {"seat",func(x *EncryptedShareDeliveryV1){x.Seat=2}},
  {"provider",func(x *EncryptedShareDeliveryV1){x.ProviderIndex=1}},
  {"position",func(x *EncryptedShareDeliveryV1){x.Position=8}},
  {"context",func(x *EncryptedShareDeliveryV1){x.DeliveryContext=big.NewInt(112234)}},
 }{
  t.Run("public binding "+tc.name,func(t *testing.T){
   changed:=*valid;tc.edit(&changed)
   cw,err:=frontend.NewWitness(&changed,ecc.BN254.ScalarField());if err!=nil{t.Fatal(err)}
   cp,err:=cw.Public();if err!=nil{t.Fatal(err)}
   if err:=groth16.Verify(proof,vk,cp);err==nil{t.Fatal("replayed ZK proof verified under altered public input")}
  })
 }
}
