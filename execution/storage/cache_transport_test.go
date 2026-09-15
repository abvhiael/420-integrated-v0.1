package storage

import (
	"context"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

type cacheOriginFunc func(context.Context, CacheKey) ([]byte, error)
func (f cacheOriginFunc) FetchCacheObject(ctx context.Context, key CacheKey) ([]byte, error) { return f(ctx,key) }

func TestCacheHTTPHandlerMissFillThenHit(t *testing.T) {
	policy:=CachePolicy{MaxBytes:1024,MaxEntries:8,DefaultTTL:time.Hour,MaxTTL:2*time.Hour}
	p,err:=NewPersistentCacheRuntime(t.TempDir(),policy); if err!=nil{t.Fatal(err)}
	canonical:=cacheCanonicalStub{valid:true}
	r,err:=NewCacheReconcileService(p,canonical,time.Minute,time.Second,time.Minute); if err!=nil{t.Fatal(err)}
	payload:=[]byte("cache-data")
	key:=cacheTestKey(payload,"manifest-a",1)
	calls:=0
	h:=CacheHTTPHandler{Runtime:p,Reconciler:r,TTL:time.Hour,Now:func()time.Time{return time.Unix(100,0)},Origin:cacheOriginFunc(func(context.Context,CacheKey)([]byte,error){calls++;return payload,nil})}
	url:="/v1/cache?object_id="+key.ObjectID+"&manifest_id="+key.ManifestID+"&shard_index=1&shard_root="+key.ShardRoot+"&size_bytes=10"
	req:=httptest.NewRequest(http.MethodGet,url,nil); w:=httptest.NewRecorder(); h.ServeHTTP(w,req)
	if w.Code!=http.StatusOK||w.Header().Get("X-420-Cache")!="MISS"||w.Body.String()!="cache-data"||calls!=1{t.Fatalf("first code=%d cache=%q body=%q calls=%d",w.Code,w.Header().Get("X-420-Cache"),w.Body.String(),calls)}
	req=httptest.NewRequest(http.MethodGet,url,nil); w=httptest.NewRecorder(); h.ServeHTTP(w,req)
	if w.Code!=http.StatusOK||w.Header().Get("X-420-Cache")!="HIT"||calls!=1{t.Fatalf("second code=%d cache=%q calls=%d",w.Code,w.Header().Get("X-420-Cache"),calls)}
}

func TestCacheHTTPHandlerHealthAndMetrics(t *testing.T) {
	policy:=CachePolicy{MaxBytes:1024,MaxEntries:8,DefaultTTL:time.Hour,MaxTTL:2*time.Hour}
	p,err:=NewPersistentCacheRuntime(t.TempDir(),policy); if err!=nil{t.Fatal(err)}
	r,err:=NewCacheReconcileService(p,cacheCanonicalStub{valid:true},time.Minute,time.Second,time.Minute); if err!=nil{t.Fatal(err)}
	h:=CacheHTTPHandler{Runtime:p,Reconciler:r,Now:func()time.Time{return time.Unix(100,0)}}
	w:=httptest.NewRecorder(); h.ServeHTTP(w,httptest.NewRequest(http.MethodGet,"/healthz",nil)); if w.Code!=http.StatusOK||!strings.Contains(w.Body.String(),"\"ready\":true"){t.Fatalf("health %d %s",w.Code,w.Body.String())}
	w=httptest.NewRecorder(); h.ServeHTTP(w,httptest.NewRequest(http.MethodGet,"/metrics",nil)); body:=w.Body.String(); if w.Code!=http.StatusOK||!strings.Contains(body,"fourtwenty_cache_entries 0")||!strings.Contains(body,"fourtwenty_cache_reconcile_runs_total 0"){t.Fatalf("metrics %d %s",w.Code,body)}
}

func TestHTTPCacheOrigin(t *testing.T) {
	payload:=[]byte("abcd")
	key:=cacheTestKey(payload,"manifest-a",2)
	server:=httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter,r *http.Request){ if r.URL.Path!="/v1/cache"||r.URL.Query().Get("manifest_id")!="manifest-a"{t.Fatalf("bad request %s",r.URL.String())};_,_=w.Write(payload)})); defer server.Close()
	o:=HTTPCacheOrigin{BaseURL:server.URL,Client:server.Client()}
	got,err:=o.FetchCacheObject(context.Background(),key); if err!=nil{t.Fatal(err)}; if string(got)!="abcd"{t.Fatalf("got %q",got)}
}

func TestCacheHTTPHeadHasNoBody(t *testing.T) {
	policy:=CachePolicy{MaxBytes:1024,MaxEntries:8,DefaultTTL:time.Hour,MaxTTL:2*time.Hour}
	p,_:=NewPersistentCacheRuntime(t.TempDir(),policy)
	payload:=[]byte("abcd"); key:=cacheTestKey(payload,"manifest-a",0); now:=time.Unix(100,0); if _,err:=p.Put(key,payload,now,time.Hour);err!=nil{t.Fatal(err)}
	r,_:=NewCacheReconcileService(p,cacheCanonicalStub{valid:true},time.Minute,time.Second,time.Minute)
	h:=CacheHTTPHandler{Runtime:p,Reconciler:r,Now:func()time.Time{return now}}
	url:="/v1/cache?object_id="+key.ObjectID+"&manifest_id="+key.ManifestID+"&shard_index=0&shard_root="+key.ShardRoot+"&size_bytes=4"
	w:=httptest.NewRecorder(); h.ServeHTTP(w,httptest.NewRequest(http.MethodHead,url,nil)); b,_:=io.ReadAll(w.Result().Body); if w.Code!=http.StatusOK||len(b)!=0{t.Fatalf("code=%d body=%q",w.Code,b)}
}

func TestCacheHTTPServiceRejectsNonLoopback(t *testing.T) {
	if _,err:=NewCacheHTTPService("0.0.0.0:8421",http.HandlerFunc(func(http.ResponseWriter,*http.Request){})); !errors.Is(err,ErrCacheTransport){t.Fatalf("expected transport error, got %v",err)}
}
