package reputation

import (
	"errors"
	"testing"
	"time"
)

func cfg()Config{return Config{
	Window:time.Minute,MaxRequestsPerSource:3,MaxFailuresPerSource:2,
	MaxRequestsPerSender:2,Backoff:2*time.Minute,MaxEntries:8,
}}

func TestSourceKeyUsesTransportAddress(t *testing.T){
	k,err:=SourceKey("192.0.2.10:4200")
	if err!=nil || k!="192.0.2.10"{t.Fatalf("key=%q err=%v",k,err)}
	if _,err:=SourceKey("spoofed");err==nil{t.Fatal("accepted invalid remote address")}
}
func TestSourceRequestLimitBacksOff(t *testing.T){
	g,_:=New(cfg())
	now:=time.Unix(1000,0)
	for i:=0;i<3;i++{
		if err:=g.Allow("192.0.2.1","0xsender"+string(rune('a'+i)),now);err!=nil{t.Fatal(err)}
	}
	if err:=g.Allow("192.0.2.1","0xsenderz",now);!errors.Is(err,ErrSourceRateLimited){t.Fatalf("got %v",err)}
	if err:=g.Allow("192.0.2.1","0xsendery",now.Add(time.Minute));!errors.Is(err,ErrSourceBackoff){t.Fatalf("got %v",err)}
	if err:=g.Allow("192.0.2.1","0xsenderx",now.Add(3*time.Minute));err!=nil{t.Fatalf("backoff did not expire: %v",err)}
}
func TestFailuresTriggerTemporaryBackoff(t *testing.T){
	g,_:=New(cfg())
	now:=time.Unix(1000,0)
	if err:=g.Allow("192.0.2.2","0xsender1",now);err!=nil{t.Fatal(err)}
	g.Failure("192.0.2.2",now)
	g.Failure("192.0.2.2",now)
	if err:=g.Allow("192.0.2.2","0xsender2",now);!errors.Is(err,ErrSourceBackoff){t.Fatalf("got %v",err)}
}
func TestSenderQuotaSpansSources(t *testing.T){
	g,_:=New(cfg())
	now:=time.Unix(1000,0)
	if err:=g.Allow("192.0.2.1","0xsender",now);err!=nil{t.Fatal(err)}
	if err:=g.Allow("192.0.2.2","0xsender",now);err!=nil{t.Fatal(err)}
	if err:=g.Allow("192.0.2.3","0xsender",now);!errors.Is(err,ErrSenderRateLimited){t.Fatalf("got %v",err)}
}
func TestConfigValidation(t *testing.T){
	bad:=cfg();bad.MaxFailuresPerSource=4
	if _,err:=New(bad);err==nil{t.Fatal("accepted impossible failure threshold")}
}
