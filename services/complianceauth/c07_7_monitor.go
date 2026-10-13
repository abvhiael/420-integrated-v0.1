package complianceauth

import (
 "context"
 "errors"
 "sort"
 "time"
)

// C07.7 metrics are operational observations only; they NEVER grant approval,
// override an evaluator failure or bypass a publication/revocation fence.
var ErrC077Observation=errors.New("compliance monitoring evidence unavailable")
type C077Metric string
const (
 C077SourceFreshness C077Metric="source_freshness"
 C077ReviewBacklog C077Metric="review_backlog"
 C077DecisionLatency C077Metric="decision_latency"
 C077EvaluatorErrors C077Metric="evaluator_errors"
 C077CoverageGaps C077Metric="coverage_gaps"
 C077ActivationLag C077Metric="activation_lag"
 C077RevocationPropagation C077Metric="revocation_propagation"
 C077ConsumerAcknowledgments C077Metric="consumer_acknowledgments"
)
var c077Metrics=[]C077Metric{C077SourceFreshness,C077ReviewBacklog,C077DecisionLatency,C077EvaluatorErrors,C077CoverageGaps,C077ActivationLag,C077RevocationPropagation,C077ConsumerAcknowledgments}
type C077Observation struct {
 Metric C077Metric
 Scope string
 ObservedAt time.Time
 Value float64 // seconds for time metrics; number of items for count metrics
 Samples uint64
 Failed uint64
}
type C077Threshold struct { Warn, Critical float64; MaxAge time.Duration }
type C077Reading struct { Metric C077Metric; Value float64; Status string; ObservedAt time.Time; Samples,Failed uint64 }
type C077Snapshot struct { Scope string; At time.Time; Readings []C077Reading; Overall string }
type C077Source interface { ReadC077(context.Context,string)([]C077Observation,error) }
type C077Monitor struct { Source C077Source; Limits map[C077Metric]C077Threshold; Now func()time.Time }

// EvaluateC077 rejects untrusted/missing/stale/nonfinite and duplicate
// observations. Targets must be separately approved by the operator; absent
// targets are UNKNOWN, never success. No tenant, case or PII labels are emitted.
func(m C077Monitor) EvaluateC077(ctx context.Context,scope string)(C077Snapshot,error){
 if ctx==nil||ctx.Err()!=nil||m.Source==nil||!c051Scope(scope)||m.Now==nil{return C077Snapshot{},ErrC077Observation}
 now:=m.Now().UTC()
 observations,err:=m.Source.ReadC077(ctx,scope)
 if err!=nil||ctx.Err()!=nil||len(observations)>64{return C077Snapshot{},ErrC077Observation}
 got:=make(map[C077Metric]C077Observation,len(observations))
 for _,o:=range observations{
  if o.Scope!=scope||!o.ObservedAt.Before(now.Add(time.Second))||o.ObservedAt.IsZero()||
   !c077Finite(o.Value)||o.Value<0||o.Failed>o.Samples||o.Samples==0{return C077Snapshot{},ErrC077Observation}
  if _,ok:=got[o.Metric];ok{return C077Snapshot{},ErrC077Observation}
  got[o.Metric]=o
 }
 result:=C077Snapshot{Scope:scope,At:now,Overall:"OK"}
 for _,metric:=range c077Metrics{
  o,exists:=got[metric];threshold,configured:=m.Limits[metric]
  reading:=C077Reading{Metric:metric,Status:"UNKNOWN"}
  if exists{
   reading.Value=o.Value;reading.ObservedAt=o.ObservedAt;reading.Samples=o.Samples;reading.Failed=o.Failed
   if configured&&threshold.Warn>=0&&threshold.Critical>threshold.Warn&&threshold.MaxAge>0&&now.Sub(o.ObservedAt)<=threshold.MaxAge{
    reading.Status="OK"
    if o.Value>=threshold.Critical{reading.Status="CRITICAL"}else if o.Value>=threshold.Warn{reading.Status="WARN"}
    if o.Failed>0&&reading.Status=="OK"{reading.Status="WARN"}
   }
  }
  if reading.Status=="UNKNOWN"||reading.Status=="CRITICAL"{result.Overall="CRITICAL"}else if reading.Status=="WARN"&&result.Overall=="OK"{result.Overall="WARN"}
  result.Readings=append(result.Readings,reading)
 }
 sort.Slice(result.Readings,func(i,j int)bool{return result.Readings[i].Metric<result.Readings[j].Metric})
 return result,nil
}
