package storage420

import (
 "encoding/hex"
 "fmt"
 "strings"
)

// CanonicalResourceProviderID encodes the operator's 20-byte address and nonzero 12-byte serial.
// The identifier is registry-local; callers must separately bind chain and registry.
func CanonicalResourceProviderID(operator, serial string) (string,error) {
 if len(operator)!=42 || !strings.HasPrefix(operator,"0x") || len(serial)!=26 || !strings.HasPrefix(serial,"0x") {
  return "",fmt.Errorf("expected 20-byte operator and 12-byte serial")
 }
 a,err:=hex.DecodeString(operator[2:]); if err!=nil{return "",err}
 b,err:=hex.DecodeString(serial[2:]); if err!=nil{return "",err}
 nonzero:=func(v []byte)bool{for _,x:=range v{if x!=0{return true}};return false}
 if !nonzero(a)||!nonzero(b){return "",fmt.Errorf("zero provider operator or serial")}
 return "0x"+hex.EncodeToString(append(a,b...)),nil
}
