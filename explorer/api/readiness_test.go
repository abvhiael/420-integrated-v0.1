package api

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	indexerapi "github.com/420integrated/420-integrated/indexer/api"
	"github.com/420integrated/420-integrated/indexer/model"
)

func TestHealthIsLivenessOnly(t *testing.T) {
	f := &fakeIndexer{health:indexerapi.HealthResponse{Health:model.Health{ChainID:1,State:"DEGRADED"}}}
	s := newTestServer(t,f)
	rr := httptest.NewRecorder()
	s.Handler().ServeHTTP(rr,httptest.NewRequest(http.MethodGet,"/v1/health",nil))
	if rr.Code != http.StatusOK { t.Fatalf("status=%d body=%s",rr.Code,rr.Body.String()) }
	var got healthResponse
	if err:=json.Unmarshal(rr.Body.Bytes(),&got);err!=nil{t.Fatal(err)}
	if got.Status!="LIVE" || got.CanonicalAuthority || got.DataSource!="420Indexer" { t.Fatalf("unexpected health: %+v",got) }
}

func TestReadySucceedsOnlyForQualifiedFreshIndexer(t *testing.T) {
	f := &fakeIndexer{health:indexerapi.HealthResponse{Health:model.Health{ChainID:420,IndexedHeight:100,SafeHeight:99,FinalizedHeight:98,State:"READY",LastIngestAt:time.Now().UTC()}}}
	s := newTestServer(t,f)
	rr := httptest.NewRecorder()
	s.Handler().ServeHTTP(rr,httptest.NewRequest(http.MethodGet,"/v1/ready",nil))
	if rr.Code != http.StatusOK { t.Fatalf("status=%d body=%s",rr.Code,rr.Body.String()) }
	var got readinessResponse
	if err:=json.Unmarshal(rr.Body.Bytes(),&got);err!=nil{t.Fatal(err)}
	if !got.Ready || !got.Status.Ready || got.Issue!=nil { t.Fatalf("unexpected readiness: %+v",got) }
}

func TestReadyFailsClosedOnWrongChain(t *testing.T) {
	f := &fakeIndexer{health:indexerapi.HealthResponse{Health:model.Health{ChainID:1,IndexedHeight:100,SafeHeight:99,FinalizedHeight:98,State:"READY",LastIngestAt:time.Now().UTC()}}}
	s := newTestServer(t,f)
	rr := httptest.NewRecorder()
	s.Handler().ServeHTTP(rr,httptest.NewRequest(http.MethodGet,"/v1/ready",nil))
	if rr.Code != http.StatusServiceUnavailable { t.Fatalf("status=%d body=%s",rr.Code,rr.Body.String()) }
	var got readinessResponse
	if err:=json.Unmarshal(rr.Body.Bytes(),&got);err!=nil{t.Fatal(err)}
	if got.Ready || got.Issue==nil || got.Issue.Code!="WRONG_CHAIN" || got.Issue.Retryable { t.Fatalf("unexpected readiness failure: %+v",got) }
}

func TestAPIResponsesDeclareQualifiedIndexerConsumerBoundary(t *testing.T) {
	f := &fakeIndexer{health:indexerapi.HealthResponse{Health:model.Health{ChainID:420,State:"READY",LastIngestAt:time.Now().UTC()}}}
	s := newTestServer(t,f)
	for _,path := range []string{"/v1/health","/v1/capabilities","/v1/status"} {
		rr := httptest.NewRecorder()
		s.Handler().ServeHTTP(rr,httptest.NewRequest(http.MethodGet,path,nil))
		if got:=rr.Header().Get("X-420-Service");got!="420Explorer"{t.Fatalf("%s service=%q",path,got)}
		if got:=rr.Header().Get("X-420-Data-Source");got!="420Indexer"{t.Fatalf("%s source=%q",path,got)}
		if got:=rr.Header().Get("X-420-Canonical-Authority");got!="false"{t.Fatalf("%s authority=%q",path,got)}
		if got:=rr.Header().Get("X-420-Consumer-Qualification");got!="QUALIFIED_INDEXER_API_CONSUMER"{t.Fatalf("%s qualification=%q",path,got)}
	}
}

func TestCapabilitiesAdvertiseReadOnlyQualifiedSurface(t *testing.T) {
	s := newTestServer(t,&fakeIndexer{})
	rr := httptest.NewRecorder()
	s.Handler().ServeHTTP(rr,httptest.NewRequest(http.MethodGet,"/v1/capabilities",nil))
	if rr.Code != http.StatusOK { t.Fatalf("status=%d body=%s",rr.Code,rr.Body.String()) }
	var got capabilitiesResponse
	if err:=json.Unmarshal(rr.Body.Bytes(),&got);err!=nil{t.Fatal(err)}
	if got.CanonicalAuthority || got.DataSource!="420Indexer" || got.Qualification!="QUALIFIED_INDEXER_API_CONSUMER" { t.Fatalf("unexpected capabilities: %+v",got) }
	if len(got.Endpoints)<10 { t.Fatalf("expected qualified endpoint inventory, got %d",len(got.Endpoints)) }
}
