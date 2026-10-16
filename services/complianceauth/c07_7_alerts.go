package complianceauth

import "context"

// C077AlertSink is an authenticated operator-only delivery integration; the
// payload contains metric aggregates, never reviewer IDs or source documents.
// The sink must durably acknowledge persistence before returning success.
type C077AlertSink interface {
 PublishC077(context.Context,C077Snapshot)error
 UnavailableC077(context.Context,string)error
}

// C077Run publishes a complete snapshot (including healthy clearance) so
// downstream alerting can close incidents. If collection is unavailable, it
// emits a distinct fail-closed outage alarm rather than sending fictitious 0s.
func C077Run(ctx context.Context,scope string,monitor C077Monitor,sink C077AlertSink)(C077Snapshot,error){
 if ctx==nil||ctx.Err()!=nil||sink==nil||!c051Scope(scope){return C077Snapshot{},ErrC077Observation}
 snapshot,err:=monitor.EvaluateC077(ctx,scope)
 if err!=nil{
  _=sink.UnavailableC077(ctx,scope)
  return C077Snapshot{},ErrC077Observation
 }
 if ctx.Err()!=nil||sink.PublishC077(ctx,snapshot)!=nil{return C077Snapshot{},ErrC077Observation}
 return snapshot,nil
}
