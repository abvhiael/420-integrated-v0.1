package main

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	statusapi "github.com/420integrated/420-integrated/status/api"
	"github.com/420integrated/420-integrated/status/components"
	"github.com/420integrated/420-integrated/status/evidence"
	"github.com/420integrated/420-integrated/status/history"
	"github.com/420integrated/420-integrated/status/incidents"
	runtime420 "github.com/420integrated/420-integrated/status/runtime"
)

type stubIndexer struct {
	chain uint64
	observed time.Time
	failure error
}
func (p stubIndexer) ChainID(context.Context) (uint64,error) { return p.chain,p.failure }
func (p stubIndexer) Ready(context.Context) error { return p.failure }
func (p stubIndexer) ObservedAt(context.Context) (time.Time,error) { return p.observed,p.failure }

func TestProductionHandlerServesPublicRoutesAndFrontend(t *testing.T) {
	now:=time.Now().UTC().Truncate(time.Second)
	cfg:=runtime420.Config{ChainID:420,IndexerURL:"https://indexer.example",ListenAddr:":8422",RequestTimeout:time.Second,MaxEvidenceAge:2*time.Minute}
	svc,err:=runtime420.NewService(cfg,stubIndexer{chain:420,observed:now})
	if err!=nil { t.Fatal(err) }
	if err:=svc.Qualify(context.Background(),now); err!=nil { t.Fatal(err) }
	registry:=components.NewRegistry()
	c:=components.Component{ID:"indexer",Name:"420Indexer",Class:components.ClassIndexer,Network:"chain-420",Environment:"testnet",Public:true}
	if err:=registry.Register(c); err!=nil { t.Fatal(err) }
	ingestor,err:=evidence.NewIngestor(registry,c.Network,c.Environment)
	if err!=nil { t.Fatal(err) }
	api,err:=statusapi.NewPublicAPI(registry,ingestor,incidents.NewStore(),history.NewStore())
	if err!=nil { t.Fatal(err) }
	handler:=publicHandler(svc,api)
	for _,path:=range []string{"/healthz","/readyz","/v1/status","/v1/components","/v1/incidents","/v1/maintenance","/v1/history","/","/app.js","/app.css"} {
		resp:=httptest.NewRecorder()
		handler.ServeHTTP(resp,httptest.NewRequest(http.MethodGet,path,nil))
		if resp.Code!=http.StatusOK { t.Errorf("%s expected 200, got %d: %s",path,resp.Code,resp.Body.String()); continue }
		if strings.HasPrefix(path,"/v1/") {
			var body map[string]any
			if err:=json.Unmarshal(resp.Body.Bytes(),&body); err!=nil { t.Fatalf("%s invalid JSON: %v",path,err) }
			if body["canonical"]!=false { t.Errorf("%s must remain explicitly noncanonical",path) }
		}
	}
	for _,path:=range []string{"/v1/status","/v1/incidents","/readyz"} {
		resp:=httptest.NewRecorder()
		handler.ServeHTTP(resp,httptest.NewRequest(http.MethodPost,path,nil))
		if resp.Code!=http.StatusMethodNotAllowed { t.Errorf("POST %s expected 405, got %d",path,resp.Code) }
	}
}

func TestFailedRequalificationMakesHTTPUnready(t *testing.T) {
	now:=time.Now().UTC()
	cfg:=runtime420.Config{ChainID:420,IndexerURL:"https://indexer.example",ListenAddr:":8422",RequestTimeout:time.Second,MaxEvidenceAge:2*time.Minute}
	// An unsuccessful refresh cannot reuse a stale startup success.
	svc,err:=runtime420.NewService(cfg,stubIndexer{chain:421,observed:now,failure:errors.New("down")})
	if err!=nil { t.Fatal(err) }
	if err:=svc.Qualify(context.Background(),now); err==nil { t.Fatal("expected dependency failure") }
	resp:=httptest.NewRecorder()
	svc.Handler().ServeHTTP(resp,httptest.NewRequest(http.MethodGet,"/readyz",nil))
	if resp.Code!=http.StatusServiceUnavailable { t.Fatalf("expected 503, got %d",resp.Code) }
}

func TestRefreshIntervalAlwaysPrecedesExpiry(t *testing.T) {
	for _,age:=range []time.Duration{100*time.Millisecond,time.Second,2*time.Minute,time.Hour} {
		if d:=refreshInterval(age); d<=0 || d>=age { t.Fatalf("bad refresh interval %v for age %v",d,age) }
	}
}
