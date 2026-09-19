package observability

import (
 "encoding/json"
 "net/http"
 "net/http/httptest"
 "strings"
 "testing"
 "time"

 "github.com/420integrated/420-integrated/status/components"
)

func TestMetricsCountersAndStatusComponent(t *testing.T){
 m:=&Metrics{}
 m.Admission(false,false,nil)
 m.Admission(true,false,nil)
 m.Admission(false,true,nil)
 m.Admission(false,false,assertError{})
 m.Submission(2,3,4)
 now:=time.Date(2026,9,19,6,0,0,0,time.UTC)
 s:=m.Snapshot(now,true,420,"0x1111111111111111111111111111111111111111",7)
 if s.Canonical||s.Authoritative||!s.Ready||s.ActiveOperations!=7{t.Fatalf("invalid observational snapshot %+v",s)}
 if s.Counters.Admitted!=1||s.Counters.Duplicates!=1||s.Counters.Replacements!=1||s.Counters.AdmissionFailures!=1||s.Counters.Submitted!=2||s.Counters.ValidationRejected!=3||s.Counters.SubmissionFailures!=4{t.Fatalf("incorrect metrics %+v",s.Counters)}
 component,err:=s.Component("420-testnet","testnet")
 if err!=nil{t.Fatal(err)}
 if component.Authoritative||component.Component.Class!=components.ClassRPC||component.Health!=components.HealthHealthy{t.Fatalf("invalid component %+v",component)}
 s.Ready=false
 component,err=s.Component("420-testnet","testnet")
 if err!=nil||component.Health!=components.HealthDegraded||component.Ready{t.Fatalf("invalid degraded component %+v: %v",component,err)}
}

type assertError struct{}
func (assertError) Error()string{return "admission rejected"}

func TestStatusEndpointGETOnlyNoCacheAndNoSensitiveData(t *testing.T){
 m:=&Metrics{}
 snapshot:=func()Snapshot{return m.Snapshot(time.Unix(100,0),false,420,"0x1111111111111111111111111111111111111111",0)}
 handler:=Handler(snapshot)
 bad:=httptest.NewRecorder()
 handler.ServeHTTP(bad,httptest.NewRequest(http.MethodPost,"/status",nil))
 if bad.Code!=http.StatusMethodNotAllowed{t.Fatalf("unexpected status %d",bad.Code)}
 ok:=httptest.NewRecorder()
 handler.ServeHTTP(ok,httptest.NewRequest(http.MethodGet,"/status",nil))
 if ok.Code!=http.StatusOK||ok.Header().Get("Cache-Control")!="no-store"{t.Fatalf("bad status headers %d",ok.Code)}
 var got Snapshot
 if err:=json.Unmarshal(ok.Body.Bytes(),&got);err!=nil{t.Fatal(err)}
 if got.Authoritative||got.Canonical||got.Ready{t.Fatalf("status asserted authority: %+v",got)}
 for _,secret:=range []string{"signature","private_key","userOperation","paymasterAndData"}{if strings.Contains(ok.Body.String(),secret){t.Fatalf("exposed sensitive field %q",secret)}}
}
