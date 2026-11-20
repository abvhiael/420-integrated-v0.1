package account

import (
 "bytes"
 "crypto/ecdsa"
 "crypto/elliptic"
 "crypto/sha256"
 "crypto/subtle"
 "encoding/binary"
 "encoding/json"
 "io"
 "math/big"
 "unicode/utf8"
)

// Exact supported WebAuthn profile: none attestation, ES256, discoverable
// credentials with user verification required, no authenticator extensions.
// Reject unsupported encodings rather than guessing their meaning.
func verifyClient(raw []byte,kind,origin string,challenge []byte)error{
 if len(raw)==0||len(raw)>4096||!utf8.Valid(raw)||len(challenge)!=32{return ErrAuthentication}
 dec:=json.NewDecoder(bytes.NewReader(raw))
 start,e:=dec.Token();if e!=nil||start!=json.Delim('{'){return ErrAuthentication}
 fields:=map[string]json.RawMessage{}
 for dec.More(){
  t,e:=dec.Token();name,ok:=t.(string);if e!=nil||!ok{return ErrAuthentication}
  if _,exists:=fields[name];exists{return ErrAuthentication}
  var v json.RawMessage;if e=dec.Decode(&v);e!=nil{return ErrAuthentication};fields[name]=v
 }
 end,e:=dec.Token();if e!=nil||end!=json.Delim('}'){return ErrAuthentication}
 if _,e=dec.Token();e!=io.EOF{return ErrAuthentication}
 for name,want:=range map[string]string{"type":kind,"origin":origin,"challenge":encodeBytes(challenge)}{
  var got string;if json.Unmarshal(fields[name],&got)!=nil||got!=want{return ErrAuthentication}
 }
 if v,ok:=fields["crossOrigin"];ok&&!bytes.Equal(bytes.TrimSpace(v),[]byte("false")){return ErrAuthentication}
 if _,ok:=fields["topOrigin"];ok{return ErrAuthentication}
 return nil
}
func authHeader(data []byte,rp string,registration bool)(uint32,bool,error){
 if len(data)<37{return 0,false,ErrAuthentication}
 digest:=sha256.Sum256([]byte(rp))
 if subtle.ConstantTimeCompare(data[:32],digest[:])!=1{return 0,false,ErrAuthentication}
 flags:=data[32]
 if flags&0x05!=0x05||flags&0xa2!=0||flags&0x10!=0&&flags&0x08==0{return 0,false,ErrAuthentication}
 if registration!=(flags&0x40!=0){return 0,false,ErrAuthentication}
 if !registration&&len(data)!=37{return 0,false,ErrAuthentication}
 return binary.BigEndian.Uint32(data[33:37]),flags&0x08!=0,nil
}

// Bounded decoder for the definite-length CBOR subset used by none
// attestation and P-256 COSE keys. No recursion, tags, indefinite values,
// duplicate keys, extensions, unbounded allocations or trailing data.
type cbor struct{b []byte;pos int}
func (c *cbor) head()(byte,uint64,error){
 if c.pos>=len(c.b){return 0,0,ErrAuthentication}
 h:=c.b[c.pos];c.pos++
 major,add:=h>>5,h&31
 if add<24{return major,uint64(add),nil}
 var n int
 switch add{case 24:n=1;case 25:n=2;case 26:n=4;case 27:n=8;default:return 0,0,ErrAuthentication}
 if n>len(c.b)-c.pos{return 0,0,ErrAuthentication}
 var v uint64;for i:=0;i<n;i++{v=v<<8|uint64(c.b[c.pos]);c.pos++}
 if n==1&&v<24||n==2&&v<=255||n==4&&v<=65535||n==8&&v<=4294967295{return 0,0,ErrAuthentication}
 return major,v,nil
}
func (c *cbor) data(major byte,max int)([]byte,error){
 m,n,e:=c.head();if e!=nil||m!=major||n>uint64(max)||n>uint64(len(c.b)-c.pos){return nil,ErrAuthentication}
 v:=c.b[c.pos:c.pos+int(n)];c.pos+=int(n);return v,nil
}
func (c *cbor) integer()(int64,error){
 m,n,e:=c.head();if e!=nil||m>1||n>2147483647{return 0,ErrAuthentication}
 if m==1{return -1-int64(n),nil};return int64(n),nil
}
func (c *cbor) exactMap(size uint64)error{
 m,n,e:=c.head();if e!=nil||m!=5||n!=size{return ErrAuthentication};return nil
}
func attestation(raw []byte)([]byte,error){
 if len(raw)==0||len(raw)>8192{return nil,ErrAuthentication}
 c:=cbor{b:raw};if c.exactMap(3)!=nil{return nil,ErrAuthentication}
 seen:=map[string]bool{};var auth []byte
 for i:=0;i<3;i++{
  b,e:=c.data(3,16);if e!=nil||seen[string(b)]{return nil,ErrAuthentication};name:=string(b);seen[name]=true
  switch name{
  case "fmt":v,e:=c.data(3,16);if e!=nil||string(v)!="none"{return nil,ErrAuthentication}
  case "attStmt":if c.exactMap(0)!=nil{return nil,ErrAuthentication}
  case "authData":auth,e=c.data(2,4096);if e!=nil{return nil,e}
  default:return nil,ErrAuthentication
  }
 }
 if c.pos!=len(raw)||!seen["authData"]||!seen["fmt"]||!seen["attStmt"]{return nil,ErrAuthentication}
 return auth,nil
}
func coseKey(raw []byte)([]byte,error){
 c:=cbor{b:raw};if c.exactMap(5)!=nil{return nil,ErrAuthentication}
 seen:=map[int64]bool{};var x,y []byte
 for i:=0;i<5;i++{
  k,e:=c.integer();if e!=nil||seen[k]{return nil,ErrAuthentication};seen[k]=true
  switch k{
  case 1,3,-1:
   v,e:=c.integer();want:=map[int64]int64{1:2,3:-7,-1:1}[k];if e!=nil||v!=want{return nil,ErrAuthentication}
  case -2,-3:
   v,e:=c.data(2,32);if e!=nil||len(v)!=32{return nil,ErrAuthentication};if k==-2{x=v}else{y=v}
  default:return nil,ErrAuthentication
  }
 }
 if c.pos!=len(raw)||len(x)!=32||len(y)!=32{return nil,ErrAuthentication}
 px,py:=new(big.Int).SetBytes(x),new(big.Int).SetBytes(y)
 if !elliptic.P256().IsOnCurve(px,py){return nil,ErrAuthentication}
 return elliptic.Marshal(elliptic.P256(),px,py),nil
}
func verifyRegistration(origin,rp string,challenge []byte,r RegistrationResponse)([]byte,uint32,bool,error){
 if verifyClient(r.ClientDataJSON,"webauthn.create",origin,challenge)!=nil{return nil,0,false,ErrAuthentication}
 data,e:=attestation(r.AttestationObject);if e!=nil{return nil,0,false,e}
 count,backup,e:=authHeader(data,rp,true);if e!=nil||len(data)<55{return nil,0,false,ErrAuthentication}
 n:=int(binary.BigEndian.Uint16(data[53:55]))
 if n<1||n>1023||n>len(data)-55||!bytes.Equal(data[55:55+n],r.CredentialID){return nil,0,false,ErrAuthentication}
 key,e:=coseKey(data[55+n:]);if e!=nil{return nil,0,false,e}
 return key,count,backup,nil
}
func verifyAssertion(origin,rp string,challenge []byte,r AssertionResponse,key []byte,previous uint32,backup bool)(uint32,error){
 if verifyClient(r.ClientDataJSON,"webauthn.get",origin,challenge)!=nil{return 0,ErrAuthentication}
 count,eligible,e:=authHeader(r.AuthenticatorData,rp,false)
 if e!=nil||eligible!=backup||(previous!=0||count!=0)&&count<=previous||len(r.Signature)<8||len(r.Signature)>80||len(key)!=65{return 0,ErrAuthentication}
 x,y:=elliptic.Unmarshal(elliptic.P256(),key);if x==nil{return 0,ErrAuthentication}
 clientHash:=sha256.Sum256(r.ClientDataJSON)
 message:=make([]byte,0,69);message=append(message,r.AuthenticatorData...);message=append(message,clientHash[:]...)
 digest:=sha256.Sum256(message)
 if !ecdsa.VerifyASN1(&ecdsa.PublicKey{Curve:elliptic.P256(),X:x,Y:y},digest[:],r.Signature){return 0,ErrAuthentication}
 return count,nil
}
