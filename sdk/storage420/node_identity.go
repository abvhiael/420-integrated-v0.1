package storage420

import (
 "encoding/hex"
 "fmt"
 "strings"
)

// CanonicalResourceNodeID matches ResourceNodeRegistry420.canonicalNodeId.
// The initial commitments remain part of the ID even when current commitments change.
// Chain and registry context must be bound separately.
func CanonicalResourceNodeID(provider, service, operator, endpoint, capacity string) (string,error) {
 validService:=false
 for _,name:=range []string{"RELAY","STORE","CACHE","GATEWAY"} {
  id,_:=ResourceIdentifier("ResourceIds420.SERVICE_"+name)
  if strings.EqualFold(service,id) {validService=true}
 }
 if !validService {return "",fmt.Errorf("unknown Resource service")}
 domain:=keccak256([]byte("420/RESOURCE/NODE/IDENTITY/V1"))
 data:=make([]byte,192)
 copy(data,domain[:])
 for i,v:=range []string{provider,service,operator,endpoint,capacity} {
  size:=32; if i==2 {size=20}
  if len(v)!=2+size*2 || !strings.HasPrefix(v,"0x") {return "",fmt.Errorf("invalid node identity field %d",i)}
  raw,err:=hex.DecodeString(v[2:]); if err!=nil{return "",err}
  nonzero:=false; for _,b:=range raw {if b!=0 {nonzero=true}}
  if !nonzero {return "",fmt.Errorf("zero node identity field %d",i)}
  copy(data[32*(i+1)+32-size:32*(i+2)],raw)
 }
 return resourceHash(data),nil
}
