package complianceauth

import (
 "context"
 "crypto/ed25519"
 "crypto/rand"
 "errors"
 "testing"
 "time"
)
type c059Policy struct{f PublicationFence;err error}
func (p c059Policy)ReadCurrentPolicy(context.Context,string)(PublicationFence,error){return p.f,p.err}
type c059Outbox struct{published int;last ComplianceImpactEvent;subs []string;item ComplianceOutboxItem;fail bool}
func(s *c059Outbox)PublishImpact(_ context.Context,e ComplianceImpactEvent,subs []string)error{
 if s.fail||s.published>0{return ErrImpactUnavailable}
 s.published++;s.last=e;s.subs=append([]string(nil),subs...);return nil
}
func(s *c059Outbox)LeaseImpact(context.Context,time.Time)(ComplianceOutboxItem,error){if s.fail{return ComplianceOutboxItem{},ErrImpactUnavailable};return s.item,nil}
func(s *c059Outbox)FinishImpact(_ context.Context,item ComplianceOutboxItem,success bool,next time.Time,max uint32)error{
 if s.fail||s.item.Event.EventID!=item.Event.EventID||s.item.Subscriber!=item.Subscriber||s.item.Attempts!=item.Attempts{return ErrImpactUnavailable}
 s.item.Attempts++;s.item.NextAttempt=next;s.item.Acknowledged=success;s.item.DeadLetter=!success&&s.item.Attempts>=max;return nil
}
type c059Sender struct{err error;n int}
func(s *c059Sender)SendInvalidation(context.Context,string,ComplianceImpactEvent)error{s.n++;return s.err}
func TestC059SignedOutboxInvalidationAndRecovery(t *testing.T){
 pub,secret,e:=ed25519.GenerateKey(rand.Reader);if e!=nil{t.Fatal(e)}
 now:=time.Date(2026,10,11,23,0,0,0,time.UTC)
 event:=ComplianceImpactEvent{EventID:"event-one",Scope:"BC",Sequence:2,PolicyDigest:Digest([]byte("policy")),RevocationEpoch:1,Kind:"POLICY_REVOKED",IssuedAt:now,KeyID:"issuer"}
 signed,err:=SignComplianceImpact(event,secret);if err!=nil||!VerifyComplianceImpact(signed,pub){t.Fatalf("signature %v",err)}
 forged:=signed;forged.PolicyDigest=Digest([]byte("different"));if VerifyComplianceImpact(forged,pub){t.Fatal("tampered event verified")}
 forged=signed;forged.Signature=append([]byte(nil),signed.Signature...);forged.Signature[0]^=1;if VerifyComplianceImpact(forged,pub){t.Fatal("forged signature verified")}
 store:=&c059Outbox{}
 if err:=PublishComplianceImpact(context.Background(),store,signed,[]string{"Travel","DOOBr"},pub);err!=nil{t.Fatal(err)}
 if len(store.subs)!=2||store.published!=1{t.Fatal("fanout missing")}
 if err:=PublishComplianceImpact(context.Background(),store,signed,[]string{"Travel"},pub);err==nil{t.Fatal("duplicate event accepted")}
 store2:=&c059Outbox{}
 if err:=PublishComplianceImpact(context.Background(),store2,signed,[]string{"Travel","Travel"},pub);err==nil{t.Fatal("duplicate subscription accepted")}
 if err:=PublishComplianceImpact(context.Background(),store2,forged,[]string{"Travel"},pub);err==nil{t.Fatal("forgery published")}
 fence:=PublicationFence{Scope:"BC",Sequence:2,RevocationEpoch:1,PolicyDigest:signed.PolicyDigest}
 if err:=ConsumeComplianceImpact(context.Background(),signed,pub,c059Policy{f:fence});err!=nil{t.Fatal(err)}
 stale:=fence;stale.Sequence=1
 if err:=ConsumeComplianceImpact(context.Background(),signed,pub,c059Policy{f:stale});err==nil{t.Fatal("stale canonical read accepted")}
 if err:=ConsumeComplianceImpact(context.Background(),signed,pub,c059Policy{err:errors.New("offline")});err==nil{t.Fatal("provider outage fail open")}
 st:=&c059Outbox{item:ComplianceOutboxItem{Event:signed,Subscriber:"Travel"}}
 sender:=&c059Sender{err:errors.New("temporary outage")}
 if err:=DeliverComplianceImpact(context.Background(),st,sender,now,2);err==nil||st.item.Attempts!=1||st.item.DeadLetter{t.Fatal("retry state incorrect")}
 if err:=DeliverComplianceImpact(context.Background(),st,sender,now,2);err==nil||sender.n!=1{t.Fatal("premature retry sent")}
 later:=st.item.NextAttempt
 if err:=DeliverComplianceImpact(context.Background(),st,sender,later,2);err==nil||!st.item.DeadLetter{t.Fatal("dead letter not reached")}
 if err:=DeliverComplianceImpact(context.Background(),st,sender,later.Add(time.Hour),2);err==nil||sender.n!=2{t.Fatal("dead letter replayed")}
 st=&c059Outbox{item:ComplianceOutboxItem{Event:signed,Subscriber:"DOOBr"}}
 sender=&c059Sender{}
 if err:=DeliverComplianceImpact(context.Background(),st,sender,now,2);err!=nil||!st.item.Acknowledged{t.Fatalf("delivery %v",err)}
 if err:=DeliverComplianceImpact(context.Background(),st,sender,now,2);err==nil{t.Fatal("acknowledged duplicate delivered")}
}
