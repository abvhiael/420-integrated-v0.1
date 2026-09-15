package storage

import (
	"errors"
	"net/http/httptest"
	"testing"
)

func TestProviderAuthNormalizationAndScopes(t *testing.T) {
	cfg:=ServiceConfig{ListenAddr:"127.0.0.1:8420",AuthToken:"legacy"}
	normalizeProviderAuth(&cfg)
	if cfg.ReadAuthToken!="legacy"||cfg.WriteAuthToken!="legacy"||cfg.MaxConcurrentRequests!=128{t.Fatalf("bad normalized config %+v",cfg)}

	s:=&Service{cfg:ServiceConfig{ReadAuthToken:"read",WriteAuthToken:"write"}}
	ts:=&transportServer{service:s}
	r:=httptest.NewRequest("GET","http://localhost/v1/capacity",nil)
	r.Header.Set("Authorization","Bearer read")
	if !ts.authorized(r,false){t.Fatal("read token rejected")}
	if ts.authorized(r,true){t.Fatal("read token gained write capability")}
	r.Header.Set("Authorization","Bearer write")
	if !ts.authorized(r,true){t.Fatal("write token rejected")}
}

func TestProviderNonLoopbackRequiresTLSAndScopedAuth(t *testing.T) {
	base:=ServiceConfig{ListenAddr:"0.0.0.0:8420",ReadAuthToken:"read",WriteAuthToken:"write"}
	if err:=validateProviderTransportSecurity(base); !errors.Is(err,ErrInvalidChainState){t.Fatalf("expected TLS requirement, got %v",err)}
	base.TLSCertFile="cert.pem"; base.TLSKeyFile="key.pem"
	if err:=validateProviderTransportSecurity(base); err!=nil{t.Fatalf("secure config rejected: %v",err)}
	base.WriteAuthToken=""
	if err:=validateProviderTransportSecurity(base); !errors.Is(err,ErrInvalidChainState){t.Fatalf("expected scoped auth rejection, got %v",err)}
	if err:=validateProviderTransportSecurity(ServiceConfig{ListenAddr:"127.0.0.1:8420"}); err!=nil{t.Fatalf("loopback local config rejected: %v",err)}
}

func TestStorageRangeCloseoutSemantics(t *testing.T) {
	etag:=`"root"`
	cases:=[]struct{header string; wantOffset,wantLength uint64}{
		{"bytes=2-5",2,4},
		{"bytes=7-",7,3},
		{"bytes=-4",6,4},
		{"bytes=-99",0,10},
	}
	for _,tc:=range cases{
		r:=httptest.NewRequest("GET","http://localhost/v1/shards/x",nil);r.Header.Set("Range",tc.header)
		o,l,p,err:=requestedRangeForSize(r,10,etag)
		if err!=nil||!p||o!=tc.wantOffset||l!=tc.wantLength{t.Fatalf("%s -> %d,%d,%v,%v",tc.header,o,l,p,err)}
	}
	r:=httptest.NewRequest("GET","http://localhost/v1/shards/x",nil);r.Header.Set("Range","bytes=2-5");r.Header.Set("If-Range",`"other"`)
	o,l,p,err:=requestedRangeForSize(r,10,etag);if err!=nil||p||o!=0||l!=0{t.Fatalf("If-Range fallback %d,%d,%v,%v",o,l,p,err)}
	r=httptest.NewRequest("GET","http://localhost/v1/shards/x",nil);r.Header.Set("Range","bytes=10-11")
	if _,_,_,err:=requestedRangeForSize(r,10,etag);!errors.Is(err,ErrInvalidShard){t.Fatalf("expected unsatisfied range, got %v",err)}
}

func TestStorageETagMatching(t *testing.T) {
	if !etagMatches(`W/"root", "other"`,`"root"`){t.Fatal("weak matching ETag rejected")}
	if !etagMatches("*",`"root"`){t.Fatal("wildcard ETag rejected")}
	if etagMatches(`"other"`,`"root"`){t.Fatal("mismatched ETag accepted")}
}
