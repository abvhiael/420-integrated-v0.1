package complianceauth

import (
 "context"
 "time"
)

// C077CoverageSnapshot must be supplied by the independent canonical
// jurisdiction/app capability registry, not inferred from only successful
// decisions. Unknown expected coverage must NEVER be reported as zero gaps.
type C077CoverageSnapshot struct {
 Expected uint64
 ReviewedCurrent uint64
}
type C077ComplianceInventory interface {
 SourceHealth(context.Context,string)([]SourceHealthInput,error)
 Coverage(context.Context,string)(C077CoverageSnapshot,error)
}
type C077InventoryCollector struct {
 Inventory C077ComplianceInventory
 Recorder C077Recorder
 Now func()time.Time
}
func(c C077InventoryCollector) Sample(ctx context.Context,scope string)error{
 if ctx==nil||ctx.Err()!=nil||!c051Scope(scope)||c.Inventory==nil||c.Recorder==nil||c.Now==nil{return ErrC077Observation}
 now:=c.Now().UTC()
 sources,e:=c.Inventory.SourceHealth(ctx,scope)
 if e!=nil||ctx.Err()!=nil||len(sources)==0||len(sources)>10000{return ErrC077Observation}
 var oldest float64
 failures:=uint64(0)
 seen:=make(map[string]bool,len(sources))
 for _,source:=range sources{
  if source.SourceID==""||seen[source.SourceID]||source.LastSuccessfulAt.After(now){return ErrC077Observation}
  seen[source.SourceID]=true
  decision,e:=AssessSourceHealth(source,now)
  if e!=nil{return ErrC077Observation}
  age:=float64((365*24*time.Hour)/time.Second)
  if !source.LastSuccessfulAt.IsZero(){age=now.Sub(source.LastSuccessfulAt).Seconds()}
  if !c077Finite(age)||age<0{return ErrC077Observation}
  if age>oldest{oldest=age}
  if decision.Status!="SOURCE_HEALTHY_REVIEW_CURRENT_AUTHORIZATION_UNPROVEN"{failures++}
 }
 coverage,e:=c.Inventory.Coverage(ctx,scope)
 if e!=nil||ctx.Err()!=nil||coverage.Expected==0||coverage.ReviewedCurrent>coverage.Expected||coverage.Expected>1000000{return ErrC077Observation}
 if e=c.Recorder.RecordC077(ctx,C077Observation{Metric:C077SourceFreshness,Scope:scope,ObservedAt:now,Value:oldest,Samples:uint64(len(sources)),Failed:failures});e!=nil{return ErrC077Observation}
 if e=c.Recorder.RecordC077(ctx,C077Observation{Metric:C077CoverageGaps,Scope:scope,ObservedAt:now,Value:float64(coverage.Expected-coverage.ReviewedCurrent),Samples:coverage.Expected,Failed:coverage.Expected-coverage.ReviewedCurrent});e!=nil{return ErrC077Observation}
 return nil
}
