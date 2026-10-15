package complianceauth

import (
 "context"
 "testing"
 "time"
)
type c077InventoryFixture struct{ sources []SourceHealthInput; coverage C077CoverageSnapshot }
func(f c077InventoryFixture)SourceHealth(context.Context,string)([]SourceHealthInput,error){return f.sources,nil}
func(f c077InventoryFixture)Coverage(context.Context,string)(C077CoverageSnapshot,error){return f.coverage,nil}
func TestC077InventoryFreshnessAndCoverage(t *testing.T){
 now:=time.Now().UTC()
 fresh:=SourceHealthInput{SourceID:"official-source",CollectedAt:now.Add(-time.Minute),LastSuccessfulAt:now.Add(-time.Minute),ReviewExpiresAt:now.Add(time.Hour),ReviewedPolicyDigest:Digest([]byte("approved-review")),MaxSourceAge:time.Hour}
 record:=&c077RecorderTest{}
 f:=c077InventoryFixture{sources:[]SourceHealthInput{fresh},coverage:C077CoverageSnapshot{Expected:3,ReviewedCurrent:2}}
 collector:=C077InventoryCollector{Inventory:f,Recorder:record,Now:func()time.Time{return now}}
 if e:=collector.Sample(context.Background(),"bc");e!=nil||len(record.rows)!=2||record.rows[0].Value!=60||record.rows[1].Value!=1||record.rows[1].Failed!=1{t.Fatal("freshness/coverage missing",e,record.rows)}
 f.coverage.Expected=0;collector.Inventory=f
 if collector.Sample(context.Background(),"bc")==nil{t.Fatal("unknown expected coverage treated as healthy")}
 f.coverage.Expected=3;f.coverage.ReviewedCurrent=4;collector.Inventory=f
 if collector.Sample(context.Background(),"bc")==nil{t.Fatal("overreported verified coverage accepted")}
 f.coverage.ReviewedCurrent=2;f.sources=nil;collector.Inventory=f
 if collector.Sample(context.Background(),"bc")==nil{t.Fatal("absent canonical source inventory treated as fresh")}
 f.sources=[]SourceHealthInput{fresh,fresh};collector.Inventory=f
 if collector.Sample(context.Background(),"bc")==nil{t.Fatal("duplicate source suppressed")}
 f.sources=[]SourceHealthInput{fresh};f.sources[0].LastSuccessfulAt=now.Add(-4*time.Hour);collector.Inventory=f
 record.rows=nil
 if e:=collector.Sample(context.Background(),"bc");e!=nil||record.rows[0].Failed!=1{t.Fatal("stale collection not unhealthy",e)}
}
