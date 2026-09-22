package publisher

import (
 "context"
 "errors"
 "testing"
 "time"
)

type parksIntake struct {records []Candidate;fail error}
func(p *parksIntake)ImportCandidate(_ context.Context,c Candidate)error{if p.fail!=nil{return p.fail};p.records=append(p.records,c);return nil}
func parksBatch()VancouverParksBatch{return VancouverParksBatch{Dataset:"parks",AcquisitionID:"independently-reviewed-acquisition-v1",Revision:"export-sha256-example",RetrievedAt:time.Date(2026,9,21,12,0,0,0,time.UTC),Parks:[]VancouverPark{{ParkID:"00017",Name:"Sample Park (fixture)",Latitude:49.25,Longitude:-123.12}}}}
func TestVancouverParksStagesOnlyCandidates(t *testing.T){
 ctx:=context.Background();sink:=&parksIntake{};n,err:=StageVancouverParks(ctx,sink,parksBatch());if err!=nil||n!=1{t.Fatalf("stage: %d %v",n,err)}
 c:=sink.records[0];if c.ID!="vancouver-park:00017"||c.Source.RecordID!="00017"||c.Kind!=Place||c.ExpectedVersion!=0||c.Source.Namespace!=VancouverParksNamespace||!validDigest(c.NormalizedSHA256)||!validDigest(c.Source.PayloadSHA256){t.Fatalf("invalid pending candidate: %+v",c)}
 l,_:=NewLedger(&testAuth{true},&testSource{true},time.Now)
 for _,candidate:=range sink.records {if err=l.ImportCandidate(ctx,candidate);err!=nil{t.Fatal(err)}}
 r,ok:=l.Get(c.ID);if !ok||r.State!=Pending||len(l.History())!=0{t.Fatal("adapter implicitly approved or published")}
}
func TestVancouverParksRejectsInvalidBatchBeforeStage(t *testing.T){
 ctx:=context.Background()
 for name,change:=range map[string]func(*VancouverParksBatch){
  "wrong dataset":func(b *VancouverParksBatch){b.Dataset="events"},
  "missing acquisition":func(b *VancouverParksBatch){b.AcquisitionID=""},
  "empty batch":func(b *VancouverParksBatch){b.Parks=nil},
  "duplicate id":func(b *VancouverParksBatch){b.Parks=append(b.Parks,b.Parks[0])},
  "out of region":func(b *VancouverParksBatch){b.Parks[0].Latitude=50},
  "blank name":func(b *VancouverParksBatch){b.Parks[0].Name=" "},
  "unsafe id":func(b *VancouverParksBatch){b.Parks[0].ParkID="../park"},
  "bad second row":func(b *VancouverParksBatch){b.Parks=append(b.Parks,VancouverPark{ParkID:"two",Name:"invalid",Latitude:0,Longitude:0})},
 }{t.Run(name,func(t *testing.T){b:=parksBatch();change(&b);sink:=&parksIntake{};n,err:=StageVancouverParks(ctx,sink,b);if !errors.Is(err,ErrInvalid)||n!=0||len(sink.records)!=0{t.Fatalf("invalid source partially staged: %d %v",n,err)}})}
 if n,err:=StageVancouverParks(ctx,nil,parksBatch());!errors.Is(err,ErrInvalid)||n!=0{t.Fatalf("missing private intake accepted: %v",err)}
}
func TestVancouverParksMissingSourceGrantIsRejected(t *testing.T){
 ctx:=context.Background();policy:=trustedPolicy();l,_:=NewLedger(policy,policy,policy.Clock)
 n,err:=StageVancouverParks(ctx,l,parksBatch());if n!=0||!errors.Is(err,ErrUntrustedSource){t.Fatalf("ungranted source staged: %d %v",n,err)}
 if _,ok:=l.Get("vancouver-park:00017");ok{t.Fatal("ungranted candidate recorded")}
}
