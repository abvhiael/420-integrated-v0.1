package account

import (
 "bytes"
 "encoding/hex"
 "strings"
 "testing"

 worker "github.com/420integrated/420-integrated/compute/worker"
)
func walletTestKey(t *testing.T)*worker.Secp256k1ExecutionKey{
 t.Helper();k,e:=worker.NewSecp256k1ExecutionKey(bytes.Repeat([]byte{0x42},32));if e!=nil{t.Fatal(e)};return k
}
func walletTestSign(t *testing.T,k *worker.Secp256k1ExecutionKey,msg string)string{
 t.Helper();sig,e:=k.SignDigest(walletMessageDigest(msg));if e!=nil{t.Fatal(e)};return "0x"+hex.EncodeToString(sig)
}
func TestEOAWalletSignatureCryptography(t *testing.T){
 k:=walletTestKey(t);sum:=walletKeccak([]byte("hello"))
 if hex.EncodeToString(sum[:])!="1c8aff950685c2ed4bc3174f3472287b56d9517b9c948127319a09a7a36deac8"{t.Fatal("non-Ethereum Keccak implementation")}
 msg:="420ID Optional Wallet Link\nOrigin: https://auth.420integrated.org\nNonce: independently signed"
 sig:=walletTestSign(t,k,msg)
 if !verifyEOAWallet(msg,k.Address(),sig){t.Fatal("independently signed EIP-191 proof rejected")}
 if verifyEOAWallet(msg+"!",k.Address(),sig){t.Fatal("altered message accepted")}
 if verifyEOAWallet(msg,"0x"+strings.Repeat("f",40),sig){t.Fatal("wrong signer accepted")}
 if verifyEOAWallet(msg,k.Address(),strings.ToUpper(sig)){t.Fatal("noncanonical signature prefix accepted")}
 raw,_:=hex.DecodeString(sig[2:])
 for _,v:=range []byte{29,30,255}{altered:=append([]byte{},raw...);altered[64]=v
  if verifyEOAWallet(msg,k.Address(),"0x"+hex.EncodeToString(altered)){t.Fatal("bad recovery id accepted",v)}
 }
 zero:=append([]byte{},raw...);for i:=0;i<32;i++{zero[i]=0}
 if verifyEOAWallet(msg,k.Address(),"0x"+hex.EncodeToString(zero)){t.Fatal("zero scalar accepted")}
 high:=append([]byte{},raw...);for i:=32;i<64;i++{high[i]=0xff}
 if verifyEOAWallet(msg,k.Address(),"0x"+hex.EncodeToString(high)){t.Fatal("high-s malleability accepted")}
 if verifyEOAWallet(msg,k.Address(),sig[:len(sig)-2]){t.Fatal("short signature accepted")}
 if _,e:=canonicalWalletAddress("0x"+strings.Repeat("0",40));e==nil{t.Fatal("zero wallet accepted")}
 if normalized,e:=canonicalWalletAddress("0x"+strings.ToUpper(k.Address()[2:]));e!=nil||normalized!=k.Address(){t.Fatal("canonical wallet normalization",e)}
}
func TestWalletMessageScope(t *testing.T){
 s:=&SessionManager{auth:&Auth{origin:"https://auth.420integrated.org",rp:"auth.420integrated.org"},app:"bong-goggles"}
 record:=sessionRecord{Session:Session{ID:"11111111-1111-4111-8111-111111111111",Subject:Subject{App:"bong-goggles",ID:"22222222-2222-4222-8222-222222222222"}}}
 msg:=walletLinkMessage(s,record,420,"0x"+strings.Repeat("a",40),"eoa","nonce",1730000300)
 for _,piece:=range []string{"https://auth.420integrated.org","auth.420integrated.org","bong-goggles",record.Subject.ID,record.ID,"420","nonce","1730000300","No account login"}{
  if !strings.Contains(msg,piece){t.Fatal("missing signed domain",piece)}
 }
}
