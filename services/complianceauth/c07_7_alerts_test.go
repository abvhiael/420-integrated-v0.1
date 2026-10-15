package complianceauth

import(
 "context"
 "errors"
 "testing"
 "time"
)
type c077SinkFixture struct { snapshots int; unavailable int; fail bool }
func(s *c077SinkFixture)PublishC077(_ context.Context,_ C077Snapshot)error{s.snapshots++;if s.fail{return errors.New("alert sink unavailable")};return nil}
func(s *c077SinkFixture)UnavailableC077(context.Context,string)error{s.unavailable++;return nil}
func TestC077AlertDeliveryAndUnavailable(t *testing.T){
 now:=time.Now().UTC()
 scope:="bc"
 rows:=make([]C077Observation,0,len(c077Metrics));limits:=map[C077Metric]C077Threshold{}
 for _,metric:=range c077Metrics{
  rows=append(rows,C077Observation{Metric:metric,Scope:scope,ObservedAt:now,Value:0,Samples:1})
  limits[metric]=C077Threshold{Warn:2,Critical:5,MaxAge:time.Minute}
 }
 m:=C077Monitor{Source:c077Fixture{rows:rows},Limits:limits,Now:func()time.Time{return now}}
 sink:=&c077SinkFixture{}
 snap,e:=C077Run(context.Background(),scope,m,sink)
 if e!=nil||snap.Overall!="OK"||sink.snapshots!=1||sink.unavailable!=0{t.Fatal("healthy clearance not delivered",e)}
 m.Source=c077Fixture{rows:nil}
 if _,e=C077Run(context.Background(),scope,m,sink);e!=nil||sink.snapshots!=2{t.Fatal("missing telemetry must publish critical snapshot",e)}
 m.Source=c077Fixture{err:errors.New("database unavailable")}
 if _,e=C077Run(context.Background(),scope,m,sink);e==nil||sink.unavailable!=1{t.Fatal("monitor outage did not alarm")}
 m.Source=c077Fixture{rows:rows};sink.fail=true
 if _,e=C077Run(context.Background(),scope,m,sink);e==nil{t.Fatal("alert sink failure treated as success")}
}
