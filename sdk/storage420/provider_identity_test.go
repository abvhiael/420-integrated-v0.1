package storage420

import "testing"

func TestCanonicalResourceProviderID(t *testing.T) {
 a:="0x00000000000000000000000000000000000a11ce"
 n:="0x000000000000000000000001"
 id,err:=CanonicalResourceProviderID(a,n)
 if err!=nil||id!="0x00000000000000000000000000000000000a11ce000000000000000000000001"{t.Fatalf("canonical vector %s %v",id,err)}
 for _,v:=range [][2]string{{a,"0x000000000000000000000000"},{"0x0000000000000000000000000000000000000000",n},{a,"0x01"},{"0x1234",n},{a,"0xgg0000000000000000000001"}}{
  if _,err:=CanonicalResourceProviderID(v[0],v[1]);err==nil{t.Fatalf("accepted invalid vector %v",v)}
 }
}
