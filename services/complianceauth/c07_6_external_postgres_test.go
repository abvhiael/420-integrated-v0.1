package complianceauth

import (
 "context"
 "testing"
)
func TestC076ExternalAuthoritySchemaAndFailClosed(t *testing.T){
 for _,fragment:=range []string{"c076_authority","c076_deletion_journal","PRIMARY KEY(scope,ordinal)","UNIQUE(scope,kind,ref)","REVOKE ALL"}{
  if !containsC076SQL(C076ExternalAuthoritySQL,fragment){t.Fatalf("missing authority schema control %q",fragment)}
 }
 b:=&C076ExternalPostgres{}
 if _,e:=b.ReadSigned(context.Background(),"scope");e==nil{t.Fatal("nil external backend read accepted")}
 if _,e:=b.ReadWitness(context.Background(),"scope");e==nil{t.Fatal("nil independent journal accepted")}
 if e:=b.WithCurrent(context.Background(),C076Checkpoint{Scope:"scope",Generation:1},func(context.Context)error{return nil});e==nil{t.Fatal("nil backend authorized release")}
}
func containsC076SQL(haystack,needle string)bool{
 for i:=0;i+len(needle)<=len(haystack);i++ {if haystack[i:i+len(needle)]==needle{return true}}
 return false
}
