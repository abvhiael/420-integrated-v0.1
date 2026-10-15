package complianceauth

import (
 "context"
 "math"
 "testing"
 "time"
)
type c077Fixture struct{ rows []C077Observation; err error }
func(s c077Fixture)ReadC077(context.Context,string)([]C077Observation,error){return s.rows,s.err}
func TestC077CompleteMonitoringAndAdversarial(t *testing.T){
 now:=time.Date(2026,10,13,12,0,0,0,time.UTC)
 scope:="bc-vancouver"
 rows:=make([]C077Observation,0,len(c077Metrics));limits:=map[C077Metric]C077Threshold{}
 for _,metric:=range c077Metrics{
  rows=append(rows,C077Observation{Metric:metric,Scope:scope,ObservedAt:now.Add(-time.Minute),Value:2,Samples:10})
  limits[metric]=C077Threshold{Warn:5,Critical:10,MaxAge:5*time.Minute}
 }
 mk:=func(x []C077Observation)C077Monitor{return C077Monitor{Source:c077Fixture{rows:x},Limits:limits,Now:func()time.Time{return now}}}
 good,e:=mk(rows).EvaluateC077(context.Background(),scope)
 if e!=nil||good.Overall!="OK"||len(good.Readings)!=8{t.Fatal("eight metrics not healthy",e,good)}
 bad:=append([]C077Observation(nil),rows...)
 bad[0].Value=11
 snap,e:=mk(bad).EvaluateC077(context.Background(),scope)
 if e!=nil||snap.Overall!="CRITICAL"{t.Fatal("threshold failure suppressed",e)}
 bad=append([]C077Observation(nil),rows...);bad[0].ObservedAt=now.Add(-time.Hour)
 snap,e=mk(bad).EvaluateC077(context.Background(),scope)
 if e!=nil||snap.Overall!="CRITICAL"{t.Fatal("stale observations reported healthy",e)}
 snap,e=mk(rows[:7]).EvaluateC077(context.Background(),scope)
 if e!=nil||snap.Overall!="CRITICAL"{t.Fatal("missing metric reported healthy",e)}
 for _,mutate:=range []func([]C077Observation)[]C077Observation{
  func(x []C077Observation)[]C077Observation{x[0].Value=math.NaN();return x},
  func(x []C077Observation)[]C077Observation{x[0].Value=math.Inf(1);return x},
  func(x []C077Observation)[]C077Observation{x[0].Scope="other-tenant";return x},
  func(x []C077Observation)[]C077Observation{x[0].Failed=11;return x},
  func(x []C077Observation)[]C077Observation{return append(x,x[0])},
 }{
  x:=append([]C077Observation(nil),rows...)
  if _,e=mk(mutate(x)).EvaluateC077(context.Background(),scope);e==nil{t.Fatal("invalid telemetry accepted")}
 }
 noThreshold:=mk(rows);noThreshold.Limits=map[C077Metric]C077Threshold{}
 snap,e=noThreshold.EvaluateC077(context.Background(),scope)
 if e!=nil||snap.Overall!="CRITICAL"{t.Fatal("unapproved threshold should never be green",e)}
}
