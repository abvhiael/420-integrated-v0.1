package storage

import (
	"context"
	"crypto/subtle"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"
)

var ErrCacheTransport = errors.New("cache transport failure")

type HTTPCacheOrigin struct {
	BaseURL string
	Client  *http.Client
}

func (o HTTPCacheOrigin) FetchCacheObject(ctx context.Context, key CacheKey) ([]byte, error) {
	base := strings.TrimRight(strings.TrimSpace(o.BaseURL), "/")
	if base == "" { return nil, ErrCacheTransport }
	q := url.Values{}
	q.Set("object_id", key.ObjectID)
	q.Set("manifest_id", key.ManifestID)
	q.Set("shard_index", strconv.FormatUint(uint64(key.ShardIndex), 10))
	q.Set("shard_root", key.ShardRoot)
	q.Set("size_bytes", strconv.FormatUint(key.SizeBytes, 10))
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, base+"/v1/cache?"+q.Encode(), nil)
	if err != nil { return nil, err }
	client := o.Client
	if client == nil { client = &http.Client{Timeout: 30 * time.Second} }
	resp, err := client.Do(req)
	if err != nil { return nil, err }
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK { return nil, fmt.Errorf("%w: origin status %d", ErrCacheTransport, resp.StatusCode) }
	payload, err := io.ReadAll(io.LimitReader(resp.Body, int64(key.SizeBytes)+1))
	if err != nil { return nil, err }
	if uint64(len(payload)) != key.SizeBytes { return nil, ErrCacheIntegrity }
	return payload, nil
}

type CacheHTTPHandler struct {
	Runtime    *PersistentCacheRuntime
	Reconciler *CacheReconcileService
	Origin     CacheOrigin
	TTL        time.Duration
	AuthToken  string
	Now        func() time.Time
}

func (h CacheHTTPHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	if !h.authorized(r) {
		w.Header().Set("WWW-Authenticate", `Bearer realm="420cache"`)
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}
	switch r.URL.Path {
	case "/healthz": h.serveHealth(w,r)
	case "/metrics": h.serveMetrics(w,r)
	case "/v1/cache": h.serveCache(w,r)
	default: http.NotFound(w,r)
	}
}

func (h CacheHTTPHandler) authorized(r *http.Request) bool {
	token := strings.TrimSpace(h.AuthToken)
	if token == "" { return true }
	got := strings.TrimSpace(strings.TrimPrefix(r.Header.Get("Authorization"), "Bearer "))
	if len(got) != len(token) { return false }
	return subtle.ConstantTimeCompare([]byte(got), []byte(token)) == 1
}

func (h CacheHTTPHandler) serveCache(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet && r.Method != http.MethodHead { w.WriteHeader(http.StatusMethodNotAllowed); return }
	if h.Runtime == nil { http.Error(w,"cache unavailable",http.StatusServiceUnavailable); return }
	key, err := cacheKeyFromRequest(r)
	if err != nil { http.Error(w,"invalid cache key",http.StatusBadRequest); return }
	now := time.Now().UTC(); if h.Now != nil { now = h.Now().UTC() }
	payload, _, err := h.Runtime.Get(key, now)
	hit := err == nil
	if err != nil && (errors.Is(err,ErrCacheMiss) || errors.Is(err,ErrCacheIntegrity)) && h.Origin != nil {
		payload, err = h.Origin.FetchCacheObject(r.Context(), key)
		if err == nil { if _, putErr := h.Runtime.Put(key,payload,now,h.TTL); putErr != nil { err = putErr } }
	}
	if err != nil {
		if errors.Is(err,ErrCacheMiss) { http.Error(w,"cache miss",http.StatusNotFound); return }
		http.Error(w,"cache fetch failed",http.StatusBadGateway); return
	}

	etag := `"` + strings.TrimPrefix(strings.ToLower(strings.TrimSpace(key.ShardRoot)), "0x") + `"`
	w.Header().Set("Content-Type","application/octet-stream")
	w.Header().Set("Accept-Ranges","bytes")
	w.Header().Set("ETag",etag)
	if hit { w.Header().Set("X-420-Cache","HIT") } else { w.Header().Set("X-420-Cache","MISS") }
	if r.Header.Get("If-None-Match") == etag {
		w.WriteHeader(http.StatusNotModified)
		return
	}

	start, end, partial, rangeErr := cacheByteRange(r.Header.Get("Range"), uint64(len(payload)))
	if rangeErr != nil {
		w.Header().Set("Content-Range", fmt.Sprintf("bytes */%d", len(payload)))
		w.WriteHeader(http.StatusRequestedRangeNotSatisfiable)
		return
	}
	if partial && r.Header.Get("If-Range") != "" && r.Header.Get("If-Range") != etag { partial = false }
	if partial {
		part := payload[start:end+1]
		w.Header().Set("Content-Range",fmt.Sprintf("bytes %d-%d/%d",start,end,len(payload)))
		w.Header().Set("Content-Length",strconv.Itoa(len(part)))
		w.WriteHeader(http.StatusPartialContent)
		if r.Method == http.MethodGet { _, _ = w.Write(part) }
		return
	}
	w.Header().Set("Content-Length",strconv.Itoa(len(payload)))
	w.WriteHeader(http.StatusOK)
	if r.Method == http.MethodGet { _, _ = w.Write(payload) }
}

func cacheByteRange(header string, size uint64) (uint64,uint64,bool,error) {
	header = strings.TrimSpace(header)
	if header == "" { return 0,0,false,nil }
	if size == 0 || !strings.HasPrefix(header,"bytes=") || strings.Contains(header,",") { return 0,0,false,ErrCacheTransport }
	spec := strings.TrimSpace(strings.TrimPrefix(header,"bytes="))
	parts := strings.SplitN(spec,"-",2)
	if len(parts) != 2 { return 0,0,false,ErrCacheTransport }
	if parts[0] == "" {
		suffix,err:=strconv.ParseUint(parts[1],10,64); if err!=nil||suffix==0{return 0,0,false,ErrCacheTransport}
		if suffix>size { suffix=size }
		return size-suffix,size-1,true,nil
	}
	start,err:=strconv.ParseUint(parts[0],10,64); if err!=nil||start>=size{return 0,0,false,ErrCacheTransport}
	end:=size-1
	if parts[1]!="" { end,err=strconv.ParseUint(parts[1],10,64); if err!=nil||end<start{return 0,0,false,ErrCacheTransport}; if end>=size{end=size-1} }
	return start,end,true,nil
}

func (h CacheHTTPHandler) serveHealth(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet { w.WriteHeader(http.StatusMethodNotAllowed); return }
	if h.Runtime == nil || h.Reconciler == nil { http.Error(w,"cache unavailable",http.StatusServiceUnavailable); return }
	now := time.Now().UTC(); if h.Now != nil { now = h.Now().UTC() }
	state := h.Runtime.Runtime.State(now)
	metrics := h.Reconciler.Metrics()
	w.Header().Set("Content-Type","application/json")
	_ = json.NewEncoder(w).Encode(map[string]any{"ready":true,"entries":len(state.Entries),"used_bytes":state.UsedBytes,"runs":metrics.Runs,"failures":metrics.Failures,"consecutive_failures":metrics.ConsecutiveFailures,"last_success_at":metrics.LastSuccessAt,"last_error":metrics.LastError})
}

func (h CacheHTTPHandler) serveMetrics(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet { w.WriteHeader(http.StatusMethodNotAllowed); return }
	if h.Runtime == nil || h.Reconciler == nil { http.Error(w,"cache unavailable",http.StatusServiceUnavailable); return }
	now := time.Now().UTC(); if h.Now != nil { now = h.Now().UTC() }
	state := h.Runtime.Runtime.State(now); m := h.Reconciler.Metrics()
	w.Header().Set("Content-Type","text/plain; version=0.0.4")
	fmt.Fprintf(w,"fourtwenty_cache_entries %d\n",len(state.Entries))
	fmt.Fprintf(w,"fourtwenty_cache_used_bytes %d\n",state.UsedBytes)
	fmt.Fprintf(w,"fourtwenty_cache_reconcile_runs_total %d\n",m.Runs)
	fmt.Fprintf(w,"fourtwenty_cache_reconcile_success_total %d\n",m.Successes)
	fmt.Fprintf(w,"fourtwenty_cache_reconcile_failures_total %d\n",m.Failures)
	fmt.Fprintf(w,"fourtwenty_cache_reconcile_invalidated_total %d\n",m.Invalidated)
	fmt.Fprintf(w,"fourtwenty_cache_triggered_evictions_total %d\n",m.TriggeredEvictions)
	fmt.Fprintf(w,"fourtwenty_cache_reconcile_consecutive_failures %d\n",m.ConsecutiveFailures)
}

func cacheKeyFromRequest(r *http.Request) (CacheKey,error) {
	q:=r.URL.Query(); index,err:=strconv.ParseUint(q.Get("shard_index"),10,32); if err!=nil{return CacheKey{},ErrInvalidCacheState}; size,err:=strconv.ParseUint(q.Get("size_bytes"),10,64); if err!=nil{return CacheKey{},ErrInvalidCacheState}
	key:=CacheKey{ObjectID:q.Get("object_id"),ManifestID:q.Get("manifest_id"),ShardIndex:uint32(index),ShardRoot:q.Get("shard_root"),SizeBytes:size}; if _,err:=CanonicalCacheKey(key);err!=nil{return CacheKey{},err}; return key,nil
}

type CacheHTTPService struct { Server *http.Server }
func NewCacheHTTPService(listen string, handler http.Handler, authToken string) (*CacheHTTPService,error) {
	if strings.TrimSpace(listen)=="" || handler==nil { return nil,ErrCacheTransport }
	if !loopbackListen(listen) && strings.TrimSpace(authToken)=="" { return nil,ErrCacheTransport }
	return &CacheHTTPService{Server:&http.Server{Addr:listen,Handler:handler,ReadHeaderTimeout:10*time.Second,ReadTimeout:30*time.Second,WriteTimeout:30*time.Second,IdleTimeout:60*time.Second,MaxHeaderBytes:32<<10}},nil
}
func (s *CacheHTTPService) Run(ctx context.Context) error {
	if s==nil||s.Server==nil{return ErrCacheTransport}; errCh:=make(chan error,1); go func(){err:=s.Server.ListenAndServe();if errors.Is(err,http.ErrServerClosed){err=nil};errCh<-err}()
	select{case<-ctx.Done():shutdownCtx,cancel:=context.WithTimeout(context.Background(),10*time.Second);defer cancel();return s.Server.Shutdown(shutdownCtx);case err:=<-errCh:return err}
}
