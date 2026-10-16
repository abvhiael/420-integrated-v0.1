package complianceauth

import (
 "context"
 "errors"
 "testing"
 "time"
)
type c077RecorderTest struct { rows []C077Observation; fail bool }
func(r *c077RecorderTest)RecordC077(_ context.Context,o C077Observation)error{
 if r.fail{return ErrC077Observation}
 r.rows=append(r.rows,o);return nil
}
type c077EvaluatorTest struct{ outcome string; err error }
func(e c077EvaluatorTest)Evaluate(context.Context,C051DecisionRequest)(C051Decision,error){return C051Decision{Outcome:e.outcome},e.err}
func(e c077EvaluatorTest)Guidance(context.Context,string,int,int)(C051ListPage[C051Guidance],error){return C051ListPage[C051Guidance]{},nil}
func(e c077EvaluatorTest)PolicyStatuses(context.Context,string,int,int)(C051ListPage[C051PolicyStatus],error){return C051ListPage[C051PolicyStatus]{},nil}
func TestC077EvaluatorMonitoringFailureAndDenial(t *testing.T){
 now:=time.Date(2026,10,13,12,0,0,0,time.UTC);ticks:=0
 clock:=func()time.Time{ticks++;return now.Add(time.Duration(ticks)*time.Millisecond)}
 recorder:=&c077RecorderTest{}
 svc:=C077InstrumentedEvaluator{Underlying:c077EvaluatorTest{outcome:"DENY"},Recorder:recorder,Scope:"bc",Now:clock}
 dec,e:=svc.Evaluate(context.Background(),C051DecisionRequest{})
 if e!=nil||dec.Outcome!="DENY"||len(recorder.rows)!=2||recorder.rows[0].Metric!=C077DecisionLatency||recorder.rows[1].Metric!=C077EvaluatorErrors||recorder.rows[1].Failed!=0{t.Fatal("denial instrumentation",e)}
 recorder.rows=nil;svc.Underlying=c077EvaluatorTest{err:errors.New("evaluator failed")}
 if _,e=svc.Evaluate(context.Background(),C051DecisionRequest{});e==nil||len(recorder.rows)!=2||recorder.rows[1].Failed!=1{t.Fatal("errors not recorded")}
 recorder.fail=true;svc.Underlying=c077EvaluatorTest{outcome:"ALLOW"}
 if dec,e=svc.Evaluate(context.Background(),C051DecisionRequest{});e==nil||dec.Outcome=="ALLOW"{t.Fatal("telemetry failure allowed decision")}
}
