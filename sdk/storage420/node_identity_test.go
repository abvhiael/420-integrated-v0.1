package storage420

import (
 "strings"
 "testing"
)

func TestCanonicalResourceNodeID(t *testing.T) {
 p:="0x"+strings.Repeat("11",32)
 service,_:=ResourceIdentifier("ResourceIds420.SERVICE_STORE")
 operator:="0x"+strings.Repeat("22",20)
 endpoint:="0x"+strings.Repeat("33",32)
 capacity:="0x"+strings.Repeat("44",32)
 id,err:=CanonicalResourceNodeID(p,service,operator,endpoint,capacity)
 if err!=nil || len(id)!=66 {t.Fatalf("canonical ID: %s %v",id,err)}
 relay,_:=ResourceIdentifier("ResourceIds420.SERVICE_RELAY")
 other,err:=CanonicalResourceNodeID(p,relay,operator,endpoint,capacity)
 if err!=nil || other==id {t.Fatal("service collision")}
 other,err=CanonicalResourceNodeID(p,service,operator,capacity,endpoint)
 if err!=nil || other==id {t.Fatal("commitment collision")}
 if _,err=CanonicalResourceNodeID(p,service,"0x"+strings.Repeat("00",20),endpoint,capacity);err==nil {t.Fatal("zero operator accepted")}
}
