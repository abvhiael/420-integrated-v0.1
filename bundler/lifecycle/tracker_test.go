package lifecycle

import (
	"strings"
	"testing"
	"time"
)

func TestStoreRejectsConflictingSubmission(t *testing.T){
	s:=NewStore()
	h:="0x"+strings.Repeat("11",32)
	tx1:="0x"+strings.Repeat("22",32)
	tx2:="0x"+strings.Repeat("33",32)
	entry:="0x4444444444444444444444444444444444444444"
	now:=time.Unix(100,0)
	if err:=s.RecordSubmission(h,tx1,entry,now);err!=nil{t.Fatal(err)}
	if err:=s.RecordSubmission(h,tx1,entry,now);err!=nil{t.Fatal(err)}
	if err:=s.RecordSubmission(h,tx2,entry,now);err==nil{t.Fatal("accepted conflicting transaction")}
}
func TestHandledData(t *testing.T){
	okData:="0x"+strings.Repeat("0",64)+strings.Repeat("0",63)+"1"
	ok,err:=decodeHandledData(okData); if err!=nil || !ok{t.Fatalf("unexpected decode %v %v",ok,err)}
	failData:="0x"+strings.Repeat("0",128)
	ok,err=decodeHandledData(failData); if err!=nil || ok{t.Fatalf("unexpected failure decode %v %v",ok,err)}
	if _,err:=decodeHandledData("0x12");err==nil{t.Fatal("accepted malformed data")}
}
func TestReceiptQuantityMustBeCanonical(t *testing.T){
	if _,err:=parseQuantity("0x10");err!=nil{t.Fatal(err)}
	if _,err:=parseQuantity("0x010");err==nil{t.Fatal("accepted noncanonical quantity")}
}
