package ordering

import (
 "reflect"
 "testing"
 "time"

 "github.com/420integrated/420-integrated/bundler/mempool"
 "github.com/420integrated/420-integrated/bundler/userop"
)

func TestGenesisOrderingIsAuditableAndBounded(t *testing.T) {
 now:=time.Date(2026,9,19,12,0,0,0,time.UTC)
 // High-fee and sponsored candidates must not jump ahead of earlier admission.
 a:=mempool.Entry{Hash:"0x03",AdmittedAt:now.Add(-time.Minute),Operation:userop.PackedUserOperation{GasFees:"0xffff",PaymasterAndData:"0xab"}}
 b:=mempool.Entry{Hash:"0x02",AdmittedAt:now,Operation:userop.PackedUserOperation{GasFees:"0x01"}}
 c:=mempool.Entry{Hash:"0x01",AdmittedAt:now,Operation:userop.PackedUserOperation{GasFees:"0xffffffff"}}
 original:=[]mempool.Entry{b,a,c}
 got,err:=Select(original,2,"")
 if err!=nil{t.Fatal(err)}
 want:=[]mempool.Entry{a,c}
 if !reflect.DeepEqual(got,want){t.Fatalf("wrong FIFO ordering: got=%v want=%v",got,want)}
 if !reflect.DeepEqual(original,[]mempool.Entry{b,a,c}){t.Fatal("ordering mutated the pool snapshot")}
 reversed,err:=Select([]mempool.Entry{c,b,a},2,GenesisFIFO)
 if err!=nil{t.Fatal(err)}
 if !reflect.DeepEqual(got,reversed){t.Fatal("input order influenced selection")}
}

func TestOrderingRejectsUnpublishedPolicies(t *testing.T){
 for _,name:=range []string{"fee-first","operator-priority","fifo-v2","FIFO-V1"}{
  if err:=Validate(name);err==nil{t.Fatalf("policy %q unexpectedly accepted",name)}
 }
 if _,err:=Select(nil,0,GenesisFIFO);err==nil{t.Fatal("unbounded or zero selection accepted")}
}
