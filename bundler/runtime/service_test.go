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
	code string
	head time.Time
	chainErr error
	codeErr error
	headErr error
}

func (p fakeProbe) ChainID(context.Context)(uint64,error){ return p.chain,p.chainErr }
func (p fakeProbe) EntryPointCode(context.Context,string)(string,error){ return p.code,p.codeErr }
func (p fakeProbe) LatestBlockTime(context.Context)(time.Time,error){ return p.head,p.headErr }

func validConfig() Config {
	return Config{ChainID:420,ExecutionRPC:"https://rpc.example",EntryPoint:"0xentry",ListenAddr:":8423",RequestTimeout:time.Second,MaxHeadAge:2*time.Minute}
}

func TestServiceQualificationAndReadiness(t *testing.T) {
	now:=time.Date(2026,9,18,1,0,0,0,time.UTC)
	svc,err:=NewService(validConfig(),fakeProbe{chain:420,code:"0x6000",head:now.Add(-time.Second)})
	if err!=nil { t.Fatal(err) }
	if err:=svc.Qualify(context.Background(),now); err!=nil { t.Fatal(err) }
	w:=httptest.NewRecorder()
	svc.Handler().ServeHTTP(w,httptest.NewRequest(http.MethodGet,"/readyz",nil))
	if w.Code!=http.StatusOK { t.Fatalf("readyz status %d",w.Code) }
	body:=w.Body.String()
	if !strings.Contains(body,"\"canonical\":false") { t.Fatalf("readiness lost noncanonical marker: %s",body) }
}

func TestHealthBoundaryIsNonAuthoritative(t *testing.T) {
	now:=time.Date(2026,9,18,1,0,0,0,time.UTC)
	svc,err:=NewService(validConfig(),fakeProbe{chain:420,code:"0x6000",head:now})
	if err!=nil { t.Fatal(err) }
	w:=httptest.NewRecorder()
	svc.Handler().ServeHTTP(w,httptest.NewRequest(http.MethodGet,"/healthz",nil))
	if w.Code!=http.StatusOK { t.Fatalf("healthz status %d",w.Code) }
	body:=w.Body.String()
	for _,want:=range []string{"\"canonical\":false","\"custodial\":false","\"authorization_authority\":false"} {
		if !strings.Contains(body,want) { t.Fatalf("healthz missing %s: %s",want,body) }
	}
}

func TestQualificationFailsClosed(t *testing.T) {
	now:=time.Date(2026,9,18,1,0,0,0,time.UTC)
	cases:=[]struct{
		name string
		probe fakeProbe
	}{
		{"wrong-chain",fakeProbe{chain:421,code:"0x6000",head:now}},
		{"missing-entrypoint",fakeProbe{chain:420,code:"0x",head:now}},
		{"stale-head",fakeProbe{chain:420,code:"0x6000",head:now.Add(-3*time.Minute)}},
		{"future-head",fakeProbe{chain:420,code:"0x6000",head:now.Add(2*time.Second)}},
		{"rpc-error",fakeProbe{chainErr:errors.New("down")}},
		{"code-error",fakeProbe{chain:420,codeErr:errors.New("down")}},
		{"head-error",fakeProbe{chain:420,code:"0x6000",headErr:errors.New("down")}},
	}
	for _,tc:=range cases {
		t.Run(tc.name,func(t *testing.T){
			svc,err:=NewService(validConfig(),tc.probe)
			if err!=nil { t.Fatal(err) }
			if err:=svc.Qualify(context.Background(),now); err==nil { t.Fatal("expected qualification failure") }
			w:=httptest.NewRecorder()
			svc.Handler().ServeHTTP(w,httptest.NewRequest(http.MethodGet,"/readyz",nil))
			if w.Code!=http.StatusServiceUnavailable { t.Fatalf("readyz status %d",w.Code) }
		})
	}
}

func TestConfigRejectsUnsafeRPC(t *testing.T) {
	cfg:=validConfig()
	cfg.ExecutionRPC="http://127.0.0.1:8545"
	if err:=cfg.Validate(); err==nil { t.Fatal("expected loopback rpc rejection") }
}
