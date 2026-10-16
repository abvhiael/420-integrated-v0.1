package complianceauth

import (
 "context"
 "errors"
 "time"
)

// C077InstrumentedEvaluator measures the canonical backend rather than
// trusting user-supplied latency/errors. Telemetry is non-authoritative;
// collector failures cannot turn an evaluator denial into an ALLOW.
type C077Recorder interface { RecordC077(context.Context,C077Observation)error }
type C077InstrumentedEvaluator struct {
 Underlying C051Backend
 Recorder C077Recorder
 Scope string
 Now func()time.Time
}
func(e C077InstrumentedEvaluator)Evaluate(ctx context.Context,req C051DecisionRequest)(C051Decision,error){
 if ctx==nil||ctx.Err()!=nil||e.Underlying==nil||e.Recorder==nil||e.Now==nil||!c051Scope(e.Scope){
  return C051Decision{},ErrC077Observation
 }
 started:=e.Now()
 out,err:=e.Underlying.Evaluate(ctx,req)
 seconds:=e.Now().Sub(started).Seconds()
 if seconds<0||!c077Finite(seconds){return C051Decision{},ErrC077Observation}
 stamp:=e.Now().UTC()
 failed:=uint64(0)
 if err!=nil||out.Outcome==""{failed=1}
 latency:=C077Observation{Metric:C077DecisionLatency,Scope:e.Scope,ObservedAt:stamp,Value:seconds,Samples:1,Failed:failed}
 errorsMetric:=C077Observation{Metric:C077EvaluatorErrors,Scope:e.Scope,ObservedAt:stamp,Value:float64(failed),Samples:1,Failed:failed}
 // Observability failure is fail-closed: never authorize silently while
 // material decision metrics are unavailable.
 if x:=e.Recorder.RecordC077(ctx,latency);x!=nil{return C051Decision{},errors.Join(ErrC077Observation,x)}
 if x:=e.Recorder.RecordC077(ctx,errorsMetric);x!=nil{return C051Decision{},errors.Join(ErrC077Observation,x)}
 return out,err
}
func(e C077InstrumentedEvaluator)Guidance(ctx context.Context,s string,limit,offset int)(C051ListPage[C051Guidance],error){
 if e.Underlying==nil{return C051ListPage[C051Guidance]{},ErrC077Observation}
 return e.Underlying.Guidance(ctx,s,limit,offset)
}
func(e C077InstrumentedEvaluator)PolicyStatuses(ctx context.Context,s string,limit,offset int)(C051ListPage[C051PolicyStatus],error){
 if e.Underlying==nil{return C051ListPage[C051PolicyStatus]{},ErrC077Observation}
 return e.Underlying.PolicyStatuses(ctx,s,limit,offset)
}
