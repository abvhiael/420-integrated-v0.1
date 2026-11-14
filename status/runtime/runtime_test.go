package runtime

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

type fakeProbe struct {
	chain uint64
	readyErr error
	observed time.Time
	observedErr error
	chainErr error
}

func (f fakeProbe) ChainID(context.Context) (uint64,error){ return f.chain,f.chainErr }
func (f fakeProbe) Ready(context.Context) error { return f.readyErr }
func (f fakeProbe) ObservedAt(context.Context)(time.Time,error){ return f.observed,f.observedErr }

func testConfig() Config { return Config{ChainID:420, IndexerURL:"https://indexer.example", ListenAddr:":8422", RequestTimeout:time.Second, MaxEvidenceAge:2*time.Minute} }

func TestConfigValidate(t *testing.T){
	cfg:=testConfig(); if err:=cfg.Validate(); err!=nil { t.Fatal(err) }
	bad:=[]Config{
		{IndexerURL:cfg.IndexerURL,ListenAddr:cfg.ListenAddr,RequestTimeout:cfg.RequestTimeout,MaxEvidenceAge:cfg.MaxEvidenceAge},
		{ChainID:420,IndexerURL:"javascript:bad",ListenAddr:cfg.ListenAddr,RequestTimeout:cfg.RequestTimeout,MaxEvidenceAge:cfg.MaxEvidenceAge},
		{ChainID:420,IndexerURL:cfg.IndexerURL,RequestTimeout:cfg.RequestTimeout,MaxEvidenceAge:cfg.MaxEvidenceAge},
		{ChainID:420,IndexerURL:cfg.IndexerURL,ListenAddr:cfg.ListenAddr,MaxEvidenceAge:cfg.MaxEvidenceAge},
		{ChainID:420,IndexerURL:cfg.IndexerURL,ListenAddr:cfg.ListenAddr,RequestTimeout:cfg.RequestTimeout},
	}
	for _,c:=range bad { if err:=c.Validate(); err==nil { t.Fatalf("expected invalid config: %+v",c) } }
}

func TestQualifyRequiresFreshCorrectChainEvidence(t *testing.T){
	now:=time.Date(2026,9,17,6,0,0,0,time.UTC)
	svc,err:=NewService(testConfig(),fakeProbe{chain:420,observed:now.Add(-time.Minute)})
	if err!=nil { t.Fatal(err) }
	if err:=svc.Qualify(context.Background(),now); err!=nil { t.Fatal(err) }

	cases:=[]fakeProbe{
		{chain:421,observed:now},
		{chain:420,readyErr:errors.New("down"),observed:now},
		{chain:420,observed:now.Add(-3*time.Minute)},
		{chain:420,observed:now.Add(time.Minute)},
	}
	for _,p:=range cases {
		s,err:=NewService(testConfig(),p); if err!=nil { t.Fatal(err) }
		if err:=s.Qualify(context.Background(),now); err==nil { t.Fatalf("expected qualification failure for %+v",p) }
	}
}

func TestHealthAndReadinessAreNoncanonical(t *testing.T){
	now:=time.Now().UTC().Truncate(time.Second)
	svc,_:=NewService(testConfig(),fakeProbe{chain:420,observed:now})

	r:=httptest.NewRequest(http.MethodGet,"/healthz",nil); w:=httptest.NewRecorder(); svc.Handler().ServeHTTP(w,r)
	if w.Code!=http.StatusOK || !strings.Contains(w.Body.String(),`"canonical":false`) { t.Fatalf("bad health response: %d %s",w.Code,w.Body.String()) }

	r=httptest.NewRequest(http.MethodGet,"/readyz",nil); w=httptest.NewRecorder(); svc.Handler().ServeHTTP(w,r)
	if w.Code!=http.StatusServiceUnavailable { t.Fatalf("expected unready, got %d",w.Code) }

	if err:=svc.Qualify(context.Background(),now); err!=nil { t.Fatal(err) }
	r=httptest.NewRequest(http.MethodGet,"/readyz",nil); w=httptest.NewRecorder(); svc.Handler().ServeHTTP(w,r)
	if w.Code!=http.StatusOK || !strings.Contains(w.Body.String(),`"canonical":false`) { t.Fatalf("bad ready response: %d %s",w.Code,w.Body.String()) }
}

func TestReadinessExpiresEvenIfBackgroundRefreshStops(t *testing.T) {
	now := time.Now().UTC()
	svc,err := NewService(testConfig(), fakeProbe{chain:420, observed:now.Add(-time.Second)})
	if err!=nil { t.Fatal(err) }
	if err:=svc.Qualify(context.Background(),now); err!=nil { t.Fatal(err) }
	if !svc.Ready(now) { t.Fatal("fresh qualification should be ready") }
	if svc.Ready(now.Add(3*time.Minute)) { t.Fatal("stale qualification must expire") }
	// The HTTP path must also fail closed using its own wall clock.
	stale := time.Now().UTC().Add(-3*time.Minute)
	staleSvc,err := NewService(testConfig(),fakeProbe{chain:420,observed:stale})
	if err!=nil { t.Fatal(err) }
	if err:=staleSvc.Qualify(context.Background(),stale); err!=nil { t.Fatal(err) }
	res:=httptest.NewRecorder()
	staleSvc.Handler().ServeHTTP(res,httptest.NewRequest(http.MethodGet,"/readyz",nil))
	if res.Code!=http.StatusServiceUnavailable { t.Fatalf("stale HTTP readiness must be 503, got %d",res.Code) }
}

type mutableIndexerProbe struct {
	chain uint64
	observed time.Time
	err error
}
func (p *mutableIndexerProbe) ChainID(context.Context)(uint64,error) { return p.chain,p.err }
func (p *mutableIndexerProbe) Ready(context.Context) error { return p.err }
func (p *mutableIndexerProbe) ObservedAt(context.Context)(time.Time,error) { return p.observed,p.err }

func TestFailedRefreshInvalidatesPreviouslyReadyService(t *testing.T) {
	now:=time.Now().UTC()
	probe:=&mutableIndexerProbe{chain:420,observed:now}
	svc,err:=NewService(testConfig(),probe)
	if err!=nil { t.Fatal(err) }
	if err:=svc.Qualify(context.Background(),now); err!=nil { t.Fatal(err) }
	if !svc.Ready(now) { t.Fatal("initial qualification missing") }
	probe.err=errors.New("indexer down")
	if err:=svc.Qualify(context.Background(),now.Add(time.Second)); err==nil { t.Fatal("expected failed refresh") }
	if svc.Ready(now.Add(time.Second)) { t.Fatal("previous success must not survive refresh failure") }
	res:=httptest.NewRecorder()
	svc.Handler().ServeHTTP(res,httptest.NewRequest(http.MethodGet,"/readyz",nil))
	if res.Code!=http.StatusServiceUnavailable { t.Fatalf("expected 503 after failed refresh, got %d",res.Code) }
}
