package storage

import (
	"context"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"testing"
)

func TestGatewayHTTPETagAndIfNoneMatch(t *testing.T) {
	payload := []byte("abcdefgh")
	key := cacheTestKey(payload, "manifest-a", 1)
	router := GatewayRouter{Store: []GatewaySource{gatewaySourceFunc(func(context.Context, GatewayRequest) ([]byte, error) {
		return payload, nil
	})}}
	service, err := NewGatewayHTTPService("127.0.0.1:0", GatewayHTTPHandler{Router: router})
	if err != nil { t.Fatal(err) }
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	go service.Run(ctx)

	endpoint := "http://" + service.Addr().String() + "/v1/gateway?" + gatewayTestQueryForKey(key, "commitment-a").Encode()
	resp, err := http.Get(endpoint)
	if err != nil { t.Fatal(err) }
	etag := resp.Header.Get("ETag")
	_ = resp.Body.Close()
	if resp.StatusCode != http.StatusOK || etag == "" { t.Fatalf("status=%d etag=%q", resp.StatusCode, etag) }

	req, err := http.NewRequest(http.MethodGet, endpoint, nil)
	if err != nil { t.Fatal(err) }
	req.Header.Set("If-None-Match", etag)
	resp, err = http.DefaultClient.Do(req)
	if err != nil { t.Fatal(err) }
	body, _ := io.ReadAll(resp.Body)
	_ = resp.Body.Close()
	if resp.StatusCode != http.StatusNotModified || len(body) != 0 { t.Fatalf("status=%d body=%q", resp.StatusCode, body) }
}

func TestGatewayHTTPByteRanges(t *testing.T) {
	payload := []byte("abcdefgh")
	key := cacheTestKey(payload, "manifest-a", 1)
	router := GatewayRouter{Store: []GatewaySource{gatewaySourceFunc(func(context.Context, GatewayRequest) ([]byte, error) {
		return payload, nil
	})}}
	service, err := NewGatewayHTTPService("127.0.0.1:0", GatewayHTTPHandler{Router: router})
	if err != nil { t.Fatal(err) }
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	go service.Run(ctx)
	endpoint := "http://" + service.Addr().String() + "/v1/gateway?" + gatewayTestQueryForKey(key, "commitment-a").Encode()

	for _, tc := range []struct {
		rangeHeader string
		wantBody    string
		wantRange   string
	}{
		{"bytes=1-3", "bcd", "bytes 1-3/8"},
		{"bytes=5-", "fgh", "bytes 5-7/8"},
		{"bytes=-2", "gh", "bytes 6-7/8"},
	} {
		req, err := http.NewRequest(http.MethodGet, endpoint, nil)
		if err != nil { t.Fatal(err) }
		req.Header.Set("Range", tc.rangeHeader)
		resp, err := http.DefaultClient.Do(req)
		if err != nil { t.Fatal(err) }
		body, _ := io.ReadAll(resp.Body)
		_ = resp.Body.Close()
		if resp.StatusCode != http.StatusPartialContent || string(body) != tc.wantBody || resp.Header.Get("Content-Range") != tc.wantRange {
			t.Fatalf("range=%q status=%d body=%q content-range=%q", tc.rangeHeader, resp.StatusCode, body, resp.Header.Get("Content-Range"))
		}
	}
}

func TestGatewayHTTPRejectsUnsatisfiableOrMultiRange(t *testing.T) {
	payload := []byte("abcdefgh")
	key := cacheTestKey(payload, "manifest-a", 1)
	router := GatewayRouter{Store: []GatewaySource{gatewaySourceFunc(func(context.Context, GatewayRequest) ([]byte, error) { return payload, nil })}}
	service, err := NewGatewayHTTPService("127.0.0.1:0", GatewayHTTPHandler{Router: router})
	if err != nil { t.Fatal(err) }
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	go service.Run(ctx)
	endpoint := "http://" + service.Addr().String() + "/v1/gateway?" + gatewayTestQueryForKey(key, "commitment-a").Encode()

	for _, value := range []string{"bytes=99-100", "bytes=0-1,4-5", "items=0-1"} {
		req, err := http.NewRequest(http.MethodGet, endpoint, nil)
		if err != nil { t.Fatal(err) }
		req.Header.Set("Range", value)
		resp, err := http.DefaultClient.Do(req)
		if err != nil { t.Fatal(err) }
		_ = resp.Body.Close()
		if resp.StatusCode != http.StatusRequestedRangeNotSatisfiable || resp.Header.Get("Content-Range") != "bytes */8" {
			t.Fatalf("range=%q status=%d content-range=%q", value, resp.StatusCode, resp.Header.Get("Content-Range"))
		}
	}
}

func gatewayTestQueryForKey(key CacheKey, commitment string) url.Values {
	q := url.Values{}
	q.Set("object_id", key.ObjectID)
	q.Set("manifest_id", key.ManifestID)
	q.Set("shard_index", strconv.FormatUint(uint64(key.ShardIndex), 10))
	q.Set("shard_root", key.ShardRoot)
	q.Set("size_bytes", strconv.FormatUint(key.SizeBytes, 10))
	q.Set("commitment_id", commitment)
	return q
}
