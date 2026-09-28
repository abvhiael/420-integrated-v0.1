package api

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	indexerapi "github.com/420integrated/420-integrated/indexer/api"
	"github.com/420integrated/420-integrated/indexer/decoder"
	"github.com/420integrated/420-integrated/indexer/model"
	explorerservice "github.com/420integrated/420-integrated/explorer/service"
)

type exp26APIFake struct {
	*fakeIndexer
	services []decoder.ServiceSummary
	summary decoder.ServiceSummary
}
func (f *exp26APIFake) Services(context.Context)([]decoder.ServiceSummary,error){return f.services,nil}
func (f *exp26APIFake) Service(context.Context,string)(decoder.ServiceSummary,error){return f.summary,nil}

func newEXP26Server(t *testing.T, idx *exp26APIFake) *Server {
	t.Helper()
	svc,err:=explorerservice.New(idx,420,time.Hour); if err!=nil{t.Fatal(err)}
	s,err:=NewServer(svc); if err!=nil{t.Fatal(err)}
	return s
}

func TestEXP26StatusAndReadyExposeRuntimeDiagnosticProvenance(t *testing.T){
	now:=time.Now().UTC()
	issueAt:=now.Add(-time.Minute)
	idx:=&exp26APIFake{fakeIndexer:&fakeIndexer{health:indexerapi.HealthResponse{Health:model.Health{
		ChainID:420,IndexedHeight:20,SafeHeight:19,FinalizedHeight:18,
		State:"DEGRADED",LastIngestAt:now,RuntimeIssue:"INGEST_CATCHUP_FAILED",RuntimeIssueAt:&issueAt,
	}}}}
	s:=newEXP26Server(t,idx)
	for _,path:=range []string{"/v1/status","/v1/ready"}{
		rr:=httptest.NewRecorder()
		s.Handler().ServeHTTP(rr,httptest.NewRequest(http.MethodGet,path,nil))
		if rr.Code!=http.StatusServiceUnavailable{t.Fatalf("%s status=%d body=%s",path,rr.Code,rr.Body.String())}
		if !strings.Contains(rr.Body.String(),`"runtimeIssue":"INGEST_CATCHUP_FAILED"`) ||
			!strings.Contains(rr.Body.String(),`"INDEXER_DEGRADED"`){
			t.Fatalf("%s missing diagnostic detail: %s",path,rr.Body.String())
		}
	}
}

func TestEXP26CapabilitiesAdvertiseTroubleshootingAndRegistryContracts(t *testing.T){
	s:=newEXP26Server(t,&exp26APIFake{fakeIndexer:&fakeIndexer{}})
	rr:=httptest.NewRecorder()
	s.Handler().ServeHTTP(rr,httptest.NewRequest(http.MethodGet,"/v1/capabilities",nil))
	if rr.Code!=http.StatusOK{t.Fatalf("status=%d body=%s",rr.Code,rr.Body.String())}
	var got capabilitiesResponse
	if err:=json.Unmarshal(rr.Body.Bytes(),&got);err!=nil{t.Fatal(err)}
	required:=[]string{"/v1/status","/v1/ready","/v1/services","/v1/services/{service}","/v1/services/{service}/versions/{version}"}
	for _,want:=range required{
		found:=false
		for _,ep:=range got.Endpoints{if ep==want{found=true;break}}
		if !found{t.Fatalf("missing capability endpoint %s: %+v",want,got.Endpoints)}
	}
	if got.CanonicalAuthority || got.DataSource!="420Indexer"{t.Fatalf("invalid capability provenance: %+v",got)}
}

func TestEXP26ServiceVersionRouteFailsClosedOnMismatchedIndexerRecord(t *testing.T){
	idx:=&exp26APIFake{fakeIndexer:&fakeIndexer{service:decoder.ServiceVersion{
		ServiceID:"420Other",Version:2,Implementation:"0x420",ActivatedHash:"0x07",
	}}}
	s:=newEXP26Server(t,idx)
	rr:=httptest.NewRecorder()
	s.Handler().ServeHTTP(rr,httptest.NewRequest(http.MethodGet,"/v1/services/420Registry/versions/2",nil))
	if rr.Code==http.StatusOK{t.Fatalf("mismatched service version unexpectedly succeeded: %s",rr.Body.String())}
	if !strings.Contains(rr.Body.String(),"inconsistent with request"){t.Fatalf("unexpected body: %s",rr.Body.String())}
}
