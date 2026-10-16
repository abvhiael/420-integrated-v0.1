package complianceauth

import (
 "context"
 "testing"
 "time"
)
func TestC077OperationalCollectorPostgreSQL(t *testing.T){
 f:=c072Setup(t)
 store:=C077SQLStore{DB:f.admin}
 now:=time.Now().UTC().Truncate(time.Millisecond)
 sampler:=C077OperationalCollector{DB:f.admin,Recorder:store,Now:func()time.Time{return now}}
 if e:=sampler.Sample(f.ctx,f.initial.Scope);e!=nil{t.Fatal("authoritative primary operational collection",e)}
 rows,e:=store.ReadC077(f.ctx,f.initial.Scope)
 if e!=nil||len(rows)!=4{t.Fatalf("expected 4 measured metrics, got %d: %v",len(rows),e)}
 expected:=map[C077Metric]bool{C077ReviewBacklog:true,C077ActivationLag:true,C077RevocationPropagation:true,C077ConsumerAcknowledgments:true}
 for _,v:=range rows{if !expected[v.Metric]||v.Value!=0||v.Samples!=1{t.Fatal("unexpected operational signal",v)};delete(expected,v.Metric)}
 if len(expected)!=0{t.Fatal("missing operational coverage",expected)}
 if e=sampler.Sample(context.Background(),"invalid scope!");e==nil{t.Fatal("invalid scope allowed")}
}
