package complianceauth

import (
 "context"
 "errors"
 "net/http"
 "net/http/httptest"
 "testing"
)
type c076GateFixture struct{ allow bool; err error; calls int }
func(g *c076GateFixture)CanServe(context.Context,string,uint64)(bool,error){g.calls++;return g.allow,g.err}
func TestC076DecisionGatewayRecoveryGate(t *testing.T){
 for _,tc:=range []struct{name string; gate *c076GateFixture; generation uint64; want int; calls int}{
  {"missing-gate",nil,3,http.StatusServiceUnavailable,0},
  {"blocked",&c076GateFixture{},3,http.StatusServiceUnavailable,1},
  {"authority-outage",&c076GateFixture{err:errors.New("authority offline")},3,http.StatusServiceUnavailable,1},
  {"no-generation",&c076GateFixture{allow:true},0,http.StatusServiceUnavailable,0},
  {"authority-open-but-unauthenticated",&c076GateFixture{allow:true},3,http.StatusServiceUnavailable,1},
 }{
  t.Run(tc.name,func(t *testing.T){
   api:=C051API{RecoveryGate:tc.gate,RecoveryScope:"production-bc-vancouver",RecoveryGeneration:tc.generation}
   w:=httptest.NewRecorder();r:=httptest.NewRequest(http.MethodPost,"/api/v1/evaluate",nil)
   api.ServeHTTP(w,r)
   if w.Code!=tc.want{t.Fatalf("got HTTP %d want %d",w.Code,tc.want)}
   if tc.gate!=nil&&tc.gate.calls!=tc.calls{t.Fatalf("gate invoked %d times expected %d",tc.gate.calls,tc.calls)}
  })
 }
}
