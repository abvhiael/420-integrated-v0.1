package complianceauth

import (
 "context"
 "errors"
 "net/http"
 "net/http/httptest"
 "strings"
 "testing"
)
type c051Auth struct{deny bool}
func(a c051Auth)AuthorizeEvaluation(ctx context.Context,token,tenant string)(context.Context,error){if a.deny||token!="valid"||tenant!="tenant"{return nil,ErrUnauthorized};return ctx,nil}
type c051Backend struct{}
func(c051Backend)Evaluate(_ context.Context,r C051DecisionRequest)(C051Decision,error){return C051Decision{Outcome:"REVIEW_REQUIRED",Reason:"INDEPENDENT_LEGAL_REVIEW_REQUIRED",PolicyDigest:r.PolicyDigest},nil}
func(c051Backend)Guidance(_ context.Context,region string,limit,offset int)(C051ListPage[C051Guidance],error){return C051ListPage[C051Guidance]{Items:[]C051Guidance{{Region:region,Message:"Review current local conditions"}}},nil}
func(c051Backend)PolicyStatuses(_ context.Context,scope string,limit,offset int)(C051ListPage[C051PolicyStatus],error){return C051ListPage[C051PolicyStatus]{Items:[]C051PolicyStatus{{Scope:scope,Status:"REVIEW_REQUIRED"}}},nil}
type c051Unavailable struct{c051Backend}
func(c051Unavailable)Evaluate(context.Context,C051DecisionRequest)(C051Decision,error){return C051Decision{},errors.New("outage")}
func TestC051VersionedAPIAndSDKSecurity(t *testing.T){
 api:=C051API{Backend:c051Backend{},Auth:c051Auth{}}
 valid:=`{"tenant_id":"tenant","operation_ref":"order","stage":"dispatch","action":"review","policy_digest":"`+Digest([]byte("policy"))+`","facts_digest":"`+Digest([]byte("facts"))+`"}`
 request:=func(method,path,body,token string,handler http.Handler)int{
  rr:=httptest.NewRecorder();r:=httptest.NewRequest(method,path,strings.NewReader(body));r.Header.Set("Accept","application/json");if method=="POST"{r.Header.Set("Content-Type","application/json")};if token!=""{r.Header.Set("Authorization","Bearer "+token)};handler.ServeHTTP(rr,r);return rr.Code
 }
 if status:=request("POST","/api/v1/evaluate",valid,"valid",api);status!=200{t.Fatalf("authorized API %d",status)}
 for _,tc:=range []struct{path,body,token string;want int}{
  {"/api/v1/evaluate",valid,"",401},
  {"/api/v1/evaluate",valid,"wrong",403},
  {"/api/v1/evaluate",strings.Replace(valid,"tenant_id\":\"tenant","tenant_id\":\"other",1),"valid",403},
  {"/api/v1/evaluate",valid[:len(valid)-1]+`,"unknown":true}`,"valid",400},
  {"/api/v1/evaluate",valid+"{}", "valid",400},
  {"/api/v1/evaluate",strings.Repeat("x",20000),"valid",400},
 }{if got:=request("POST",tc.path,tc.body,tc.token,api);got!=tc.want{t.Fatalf("%s expected %d got %d",tc.path,tc.want,got)}}
 if got:=request("POST","/api/v1/evaluate",valid,"valid",C051API{Backend:c051Unavailable{},Auth:c051Auth{}});got!=503{t.Fatalf("backend outage %d",got)}
 for _,path:=range []string{"/api/v1/guidance?region=BC","/api/v1/policies/status?scope=delivery/BC"}{if got:=request("GET",path,"","",api);got!=200{t.Fatalf("%s %d",path,got)}}
 for _,path:=range []string{"/api/v1/guidance?region=BC&limit=51","/api/v1/guidance?region=BC&offset=-1","/api/v1/guidance?region=BC&other=1","/api/v1/guidance?region=%20","/api/v1/policies/status?scope=","/api/v2/guidance?region=BC"}{got:=request("GET",path,"","",api);if got==200{t.Fatalf("unsafe query accepted: %s",path)}}
 if got:=request("GET","/api/v1/evaluate","","",api);got!=405{t.Fatalf("method %d",got)}
 if got:=request("POST","/api/v1/guidance","","",api);got!=405{t.Fatalf("method %d",got)}
}
