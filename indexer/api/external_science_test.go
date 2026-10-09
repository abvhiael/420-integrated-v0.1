package api

import (
 "errors"
 "net/http"
 "net/http/httptest"
 "strings"
 "testing"
 "time"
)
type scienceFake struct{ fakeBackend; page SciencePage; err error }
func (f scienceFake) ExternalScience(_ string,_ uint32)(SciencePage,error){return f.page,f.err}
func TestExternalScienceNoSource503(t *testing.T){w:=httptest.NewRecorder();NewServer(fakeBackend{}).Handler().ServeHTTP(w,httptest.NewRequest("GET","/v1/compute/external-science?chainId=420",nil));if w.Code!=http.StatusServiceUnavailable||!strings.Contains(w.Body.String(),"\"canonicalAuthority\":false"){t.Fatalf("%d: %s",w.Code,w.Body.String())}}
func TestExternalScienceEmptyAndPopulated(t *testing.T){
 empty:=SciencePage{SchemaVersion:"420-science-read-v1",ChainID:"420",Items:[]ScienceObservation{}}
 filled:=empty;filled.Items=[]ScienceObservation{{ChainID:"420",Provider:"BOINC",Project:"testproject",WorkKey:strings.Repeat("a",64),CreditUnit:"BOINC_CREDIT",CreditedEvent:"1",ObservedAt:time.Now().UnixMilli(),Eligibility:"UNVERIFIED",Finality:"UNFINALIZED"}};filled.Total=1
 for _,page:=range []SciencePage{empty,filled}{w:=httptest.NewRecorder();NewServer(scienceFake{page:page}).Handler().ServeHTTP(w,httptest.NewRequest("GET","/v1/compute/external-science?chainId=420&limit=50",nil));if w.Code!=200||!strings.Contains(w.Body.String(),"\"canonicalAuthority\":false")||!strings.Contains(w.Body.String(),"\"schemaVersion\":\"420-science-read-v1\""){t.Fatalf("%d %s",w.Code,w.Body.String())}}
}
func TestExternalScienceRejectsWrongChainAndInvalidPage(t *testing.T){
 for _,path:=range []string{"/v1/compute/external-science?chainId=0","/v1/compute/external-science?chainId=420&limit=101","/v1/compute/external-science?chainId=bad"}{w:=httptest.NewRecorder();NewServer(fakeBackend{}).Handler().ServeHTTP(w,httptest.NewRequest("GET",path,nil));if w.Code!=400{t.Fatalf("%s: %d",path,w.Code)}}
 page:=SciencePage{SchemaVersion:"420-science-read-v1",ChainID:"1",Items:[]ScienceObservation{}}
 w:=httptest.NewRecorder();NewServer(scienceFake{page:page}).Handler().ServeHTTP(w,httptest.NewRequest("GET","/v1/compute/external-science?chainId=420",nil));if w.Code!=503{t.Fatalf("wrong chain %d",w.Code)}
}
func TestExternalScienceUnavailableReaderAndUnsafeAmount(t *testing.T){
 page:=SciencePage{SchemaVersion:"420-science-read-v1",ChainID:"420",Items:[]ScienceObservation{}}
 for _,f:=range []scienceFake{{page:page,err:errors.New("source down")},{page:SciencePage{SchemaVersion:"420-science-read-v1",ChainID:"420",Items:[]ScienceObservation{{ChainID:"420",Provider:"BOINC",ObservedAt:time.Now().UnixMilli(),Amount420:func()*string{s:="100";return &s}()}},Total:1}}}{
 w:=httptest.NewRecorder();NewServer(f).Handler().ServeHTTP(w,httptest.NewRequest("GET","/v1/compute/external-science?chainId=420",nil));if w.Code!=503{t.Fatalf("%d %s",w.Code,w.Body.String())}
 }
}

func TestExternalScienceCORSOnlyApprovedComputeOrigin(t *testing.T){
 for _,origin:=range []string{"https://compute.420integrated.org","https://untrusted.example"}{
  w:=httptest.NewRecorder();r:=httptest.NewRequest("GET","/v1/compute/external-science?chainId=420",nil);r.Header.Set("Origin",origin)
  NewServer(fakeBackend{}).Handler().ServeHTTP(w,r)
  expected:="";if origin=="https://compute.420integrated.org"{expected=origin}
  if w.Header().Get("Access-Control-Allow-Origin")!=expected{t.Fatalf("unsafe origin %s %s",origin,w.Header().Get("Access-Control-Allow-Origin"))}
 }
}
