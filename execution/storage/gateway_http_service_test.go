package storage

import (
	"context"
	"io"
	"net/http"
	"net/url"
	"testing"
	"time"
)

type gatewayAuthorizerFunc func(context.Context, GatewayAccess, GatewayRequest) error

func (f gatewayAuthorizerFunc) AuthorizeGatewayAccess(ctx context.Context, access GatewayAccess, req GatewayRequest) error {
	return f(ctx, access, req)
}

func TestGatewayHTTPHandlerPublicGETAndHEAD(t *testing.T) {
	payload := []byte("abcd")
	key := cacheTestKey(payload, "manifest-a", 1)
	router := GatewayRouter{Store: []GatewaySource{gatewaySourceFunc(func(context.Context, GatewayRequest) ([]byte, error) {
		return payload, nil
	})}}
	h := GatewayHTTPHandler{Router: router}
	service, err := NewGatewayHTTPService("127.0.0.1:0", h)
	if err != nil { t.Fatal(err) }
	ctx, cancel := context.WithCancel(context.Background())
	done := make(chan error, 1)
	go func() { done <- service.Run(ctx) }()

	endpoint := "http://" + service.Addr().String() + "/v1/gateway?" + gatewayTestQuery(key, "commitment-a").Encode()
	resp, err := http.Get(endpoint)
	if err != nil { t.Fatal(err) }
	body, err := io.ReadAll(resp.Body)
	_ = resp.Body.Close()
	if err != nil { t.Fatal(err) }
	if resp.StatusCode != http.StatusOK || string(body) != "abcd" || resp.Header.Get(GatewayHeaderTier) != "store" {
		t.Fatalf("status=%d body=%q tier=%q", resp.StatusCode, body, resp.Header.Get(GatewayHeaderTier))
	}

	req, err := http.NewRequest(http.MethodHead, endpoint, nil)
	if err != nil { t.Fatal(err) }
	resp, err = http.DefaultClient.Do(req)
	if err != nil { t.Fatal(err) }
	_ = resp.Body.Close()
	if resp.StatusCode != http.StatusOK || resp.ContentLength != int64(len(payload)) {
		t.Fatalf("HEAD status=%d length=%d", resp.StatusCode, resp.ContentLength)
	}

	cancel()
	select {
	case err := <-done:
		if err != nil { t.Fatal(err) }
	case <-time.After(2 * time.Second):
		t.Fatal("gateway service did not stop")
	}
}

func TestGatewayHTTPHandlerPrivateAccess(t *testing.T) {
	payload := []byte("abcd")
	key := cacheTestKey(payload, "manifest-a", 1)
	authorized := false
	router := GatewayRouter{
		Authorizer: gatewayAuthorizerFunc(func(_ context.Context, access GatewayAccess, _ GatewayRequest) error {
			authorized = access.Subject == "subject-a" && access.SessionID == "session-a" && access.Capability == GatewayAccessRead
			return nil
		}),
		Store: []GatewaySource{gatewaySourceFunc(func(context.Context, GatewayRequest) ([]byte, error) { return payload, nil })},
	}
	h := GatewayHTTPHandler{Router: router}
	service, err := NewGatewayHTTPService("127.0.0.1:0", h)
	if err != nil { t.Fatal(err) }
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	go service.Run(ctx)

	endpoint := "http://" + service.Addr().String() + "/v1/gateway?" + gatewayTestQuery(key, "commitment-a").Encode()
	req, err := http.NewRequest(http.MethodGet, endpoint, nil)
	if err != nil { t.Fatal(err) }
	req.Header.Set(GatewayHeaderAccessMode, string(GatewayAccessPrivate))
	req.Header.Set(GatewayHeaderSubject, "subject-a")
	req.Header.Set(GatewayHeaderSessionID, "session-a")
	req.Header.Set(GatewayHeaderCapability, GatewayAccessRead)
	resp, err := http.DefaultClient.Do(req)
	if err != nil { t.Fatal(err) }
	_ = resp.Body.Close()
	if resp.StatusCode != http.StatusOK || !authorized { t.Fatalf("status=%d authorized=%t", resp.StatusCode, authorized) }
}

func TestGatewayHTTPHandlerRejectsMalformedRequest(t *testing.T) {
	h := GatewayHTTPHandler{}
	req, err := http.NewRequest(http.MethodGet, "http://gateway/v1/gateway?shard_index=nope", nil)
	if err != nil { t.Fatal(err) }
	w := &gatewayResponseRecorder{header: make(http.Header)}
	h.ServeHTTP(w, req)
	if w.status != http.StatusBadRequest { t.Fatalf("status=%d", w.status) }
}

func gatewayTestQuery(key CacheKey, commitment string) url.Values {
	q := url.Values{}
	q.Set("object_id", key.ObjectID)
	q.Set("manifest_id", key.ManifestID)
	q.Set("shard_index", "1")
	q.Set("shard_root", key.ShardRoot)
	q.Set("size_bytes", "4")
	q.Set("commitment_id", commitment)
	return q
}

type gatewayResponseRecorder struct {
	header http.Header
	status int
}

func (r *gatewayResponseRecorder) Header() http.Header { return r.header }
func (r *gatewayResponseRecorder) Write(data []byte) (int, error) { if r.status == 0 { r.status = http.StatusOK }; return len(data), nil }
func (r *gatewayResponseRecorder) WriteHeader(statusCode int) { r.status = statusCode }
