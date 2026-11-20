package account

import (
 "bytes"
 "context"
 "crypto/ecdsa"
 "crypto/elliptic"
 "crypto/rand"
 "crypto/sha256"
 "encoding/binary"
 "encoding/json"
 "errors"
 "testing"
)

const testRP="accounts.example.org"
const testOrigin="https://"+testRP
type testMailer struct{email,secret string; fail bool}
func (m *testMailer) SendVerification(_ context.Context,email,secret string)error{
 m.email,m.secret=email,secret;if m.fail{return errors.New("relay failed")};return nil
}
func mustRandom(t *testing.T)[]byte{t.Helper();b,e:=randomBytes();if e!=nil{t.Fatal(e)};return b}
func testKey(t *testing.T)*ecdsa.PrivateKey{t.Helper();k,e:=ecdsa.GenerateKey(elliptic.P256(),rand.Reader);if e!=nil{t.Fatal(e)};return k}
func clientJSON(kind,origin string,challenge []byte)[]byte{
 b,_:=json.Marshal(map[string]any{"type":kind,"origin":origin,"challenge":encodeBytes(challenge),"crossOrigin":false});return b
}
func cbBytes(b []byte)[]byte{
 if len(b)<24{return append([]byte{byte(0x40+len(b))},b...)}
 if len(b)<256{return append([]byte{0x58,byte(len(b))},b...)}
 return append([]byte{0x59,byte(len(b)>>8),byte(len(b))},b...)
}
func cbText(s string)[]byte{return append([]byte{byte(0x60+len(s))},[]byte(s)...)}
func header(rp string,flag byte,count uint32)[]byte{
 d:=sha256.Sum256([]byte(rp));out:=append([]byte{},d[:]...);out=append(out,flag,0,0,0,0);binary.BigEndian.PutUint32(out[33:],count);return out
}
func registration(t *testing.T,k *ecdsa.PrivateKey,challenge,id []byte,flags byte)RegistrationResponse{
 t.Helper()
 data:=append(header(testRP,flags,0),make([]byte,16)...)
 data=append(data,byte(len(id)>>8),byte(len(id)));data=append(data,id...)
 data=append(data,0xa5,0x01,0x02,0x03,0x26,0x20,0x01,0x21)
 data=append(data,cbBytes(k.X.FillBytes(make([]byte,32)))...);data=append(data,0x22)
 data=append(data,cbBytes(k.Y.FillBytes(make([]byte,32)))...)
 object:=[]byte{0xa3};object=append(object,cbText("fmt")...);object=append(object,cbText("none")...)
 object=append(object,cbText("attStmt")...);object=append(object,0xa0)
 object=append(object,cbText("authData")...);object=append(object,cbBytes(data)...)
 return RegistrationResponse{id,clientJSON("webauthn.create",testOrigin,challenge),object}
}
func assertion(t *testing.T,k *ecdsa.PrivateKey,challenge,id,handle []byte,flag byte,count uint32,origin,rp string)AssertionResponse{
 t.Helper();client:=clientJSON("webauthn.get",origin,challenge);auth:=header(rp,flag,count)
 ch:=sha256.Sum256(client);digest:=sha256.Sum256(append(append([]byte{},auth...),ch[:]...))
 sig,e:=ecdsa.SignASN1(rand.Reader,k,digest[:]);if e!=nil{t.Fatal(e)}
 return AssertionResponse{id,client,auth,sig,handle}
}
func TestEmailNormalizationAndRP(t *testing.T){
 for _,v:=range []string{"a@@example.org","a\r\nBcc:x@example.org","a..b@example.org","a@-x.org","a@127.0.0.1","<x@example.org>","a@localhost","a@example.org."}{
  if _,e:=normalizeEmail(v);e==nil{t.Fatalf("accepted %q",v)}
 }
 if v,e:=normalizeEmail(" Local+tag@EXAMPLE.ORG ");e!=nil||v!="Local+tag@example.org"{t.Fatal(v,e)}
 for _,origin:=range []string{"http://"+testRP,testOrigin+"/",testOrigin+":443","https://evil.example.org",testOrigin+"?x=1",testOrigin+"#x"}{
  if _,e:=NewAuth(&Store{},&testMailer{},origin,testRP);e==nil{t.Fatal("accepted origin",origin)}
 }
 if _,e:=NewAuth(&Store{},&testMailer{},testOrigin,testRP);e!=nil{t.Fatal(e)}
 if _,e:=NewSMTPMailer("smtp.example.org",465,"user","password","sender@example.org");e!=nil{t.Fatal(e)}
 if _,e:=NewSMTPMailer("smtp.example.org",465,"user","password","sender@example.org\r\nBcc:x@example.org");e==nil{t.Fatal("accepted header injection")}
}
func TestWebAuthnRegistrationAndAssertion(t *testing.T){
 key:=testKey(t);challenge,id,handle:=mustRandom(t),mustRandom(t),mustRandom(t)
 r:=registration(t,key,challenge,id,0x4d)
 pub,count,backup,e:=verifyRegistration(testOrigin,testRP,challenge,r)
 if e!=nil||count!=0||!backup||!bytes.Equal(pub,elliptic.Marshal(elliptic.P256(),key.X,key.Y)){t.Fatal(count,backup,e)}
 for _,flag:=range []byte{0x41,0x44,0x45|0x10,0x45|0x80,0x45|0x20,0x05}{
  bad:=registration(t,key,challenge,id,flag);if _,_,_,e=verifyRegistration(testOrigin,testRP,challenge,bad);e==nil{t.Fatal("accepted flags",flag)}
 }
 for _,bad:=range [][]byte{r.AttestationObject[:len(r.AttestationObject)-1],append(append([]byte{},r.AttestationObject...),0),{0xbf,0xff},{0xa3,0x63,0x66,0x6d,0x74}}{
  invalid:=r;invalid.AttestationObject=bad;if _,_,_,e=verifyRegistration(testOrigin,testRP,challenge,invalid);e==nil{t.Fatal("accepted malformed CBOR")}
 }
 invalid:=r;invalid.CredentialID=mustRandom(t);if _,_,_,e=verifyRegistration(testOrigin,testRP,challenge,invalid);e==nil{t.Fatal("credential substitution")}
 invalid=r;invalid.ClientDataJSON=clientJSON("webauthn.create","https://evil.example.org",challenge);if _,_,_,e=verifyRegistration(testOrigin,testRP,challenge,invalid);e==nil{t.Fatal("origin substitution")}
 invalid=r;invalid.ClientDataJSON=append([]byte(`{"type":"webauthn.create",`),r.ClientDataJSON[1:]...);if _,_,_,e=verifyRegistration(testOrigin,testRP,challenge,invalid);e==nil{t.Fatal("duplicate client field")}
 s:=assertion(t,key,challenge,id,handle,0x0d,1,testOrigin,testRP)
 if got,e:=verifyAssertion(testOrigin,testRP,challenge,s,pub,0,true);e!=nil||got!=1{t.Fatal(got,e)}
 if _,e=verifyAssertion(testOrigin,testRP,challenge,s,pub,1,true);e==nil{t.Fatal("counter replay")}
 if _,e=verifyAssertion(testOrigin,testRP,mustRandom(t),s,pub,0,true);e==nil{t.Fatal("challenge substitution")}
 for _,bad:=range []AssertionResponse{
  assertion(t,key,challenge,id,handle,0x09,2,testOrigin,testRP),
  assertion(t,key,challenge,id,handle,0x05,2,testOrigin,testRP),
  assertion(t,key,challenge,id,handle,0x0d,2,"https://evil.example.org",testRP),
  assertion(t,key,challenge,id,handle,0x0d,2,testOrigin,"evil.example.org"),
  assertion(t,testKey(t),challenge,id,handle,0x0d,2,testOrigin,testRP),
 }{if _,e=verifyAssertion(testOrigin,testRP,challenge,bad,pub,0,true);e==nil{t.Fatal("accepted invalid assertion")}}
 zero:=assertion(t,key,challenge,id,handle,0x1d,0,testOrigin,testRP)
 if _,e=verifyAssertion(testOrigin,testRP,challenge,zero,pub,0,true);e!=nil{t.Fatal("valid synced zero counter",e)}
 if _,e=verifyAssertion(testOrigin,testRP,challenge,zero,pub,1,true);e==nil{t.Fatal("counter reset")}
}
func FuzzWebAuthnBoundedAttestation(f *testing.F){
 f.Add([]byte{0xa3,0x63,0x66,0x6d,0x74,0x64,0x6e,0x6f,0x6e,0x65})
 f.Add([]byte{0xff});f.Add([]byte{0x5b,0xff,0xff,0xff,0xff,0xff,0xff,0xff,0xff})
 f.Fuzz(func(t *testing.T,b []byte){_,_=attestation(b);_,_=coseKey(b)})
}
