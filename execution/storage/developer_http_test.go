package storage

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strconv"
	"strings"
	"testing"
	"time"
)

type developerResourceAPIStub struct {
	result DeveloperRetrieveResult
	err    error
	wait   bool
}

func (s developerResourceAPIStub) Retrieve(ctx context.Context, _ DeveloperRetrieveRequest) (DeveloperRetrieveResult, error) {
	if s.wait {
		<-ctx.Done()
		return DeveloperRetrieveResult{}, ctx.Err()
	}
	if s.err != nil {
		return DeveloperRetrieveResult{}, s.err
	}
	return s.result, nil
}

func developerHTTPURL(object DeveloperObjectRef) string {
	q := url.Values{}
	q.Set("object_id", object.ObjectID)
	q.Set("manifest_id", object.ManifestID)
	q.Set("shard_index", strconv.FormatUint(uint64(object.ShardIndex), 10))
	q.Set("shard_root", object.ShardRoot)
	q.Set("size_bytes", strconv.FormatUint(object.SizeBytes, 10))
	q.Set("commitment_id", object.CommitmentID)
	return DeveloperRetrievePath + "?" + q.Encode()
}

func developerHTTPResult(payload []byte) DeveloperRetrieveResult {
	object := developerObjectRef(payload)
	return DeveloperRetrieveResult{
		Version: DeveloperAPIVersion,
		Object:  object,
		Route: DeveloperRouteMetadata{
			Tier:       "cache",
			ProviderID: "provider-1",
			NodeID:     "node-1",
		},
		Payload: append([]byte(nil), payload...),
	}
}

func TestDeveloperHTTPGetReturnsVerifiedPayloadAndRouteMetadata(t *testing.T) {
	payload := []byte("developer-http-payload")
	result := developerHTTPResult(payload)
	handler := NewDeveloperHTTPHandler(developerResourceAPIStub{result: result})
	r := httptest.NewRequest(http.MethodGet, developerHTTPURL(result.Object), nil)
	w := httptest.NewRecorder()
	handler.ServeHTTP(w, r)
	if w.Code != http.StatusOK {
		t.Fatalf("unexpected status %d: %s", w.Code, w.Body.String())
	}
	if w.Body.String() != string(payload) {
		t.Fatalf("unexpected payload %q", w.Body.String())
	}
	if w.Header().Get(DeveloperHeaderRouteTier) != "cache" || w.Header().Get(DeveloperHeaderProviderID) != "provider-1" || w.Header().Get(DeveloperHeaderNodeID) != "node-1" {
		t.Fatalf("unexpected route headers %#v", w.Header())
	}
	if w.Header().Get("ETag") == "" || w.Header().Get("Accept-Ranges") != "bytes" {
		t.Fatalf("missing retrieval headers %#v", w.Header())
	}
}

func TestDeveloperHTTPHeadReturnsHeadersWithoutBody(t *testing.T) {
	payload := []byte("head-payload")
	result := developerHTTPResult(payload)
	handler := NewDeveloperHTTPHandler(developerResourceAPIStub{result: result})
	r := httptest.NewRequest(http.MethodHead, developerHTTPURL(result.Object), nil)
	w := httptest.NewRecorder()
	handler.ServeHTTP(w, r)
	if w.Code != http.StatusOK || w.Body.Len() != 0 {
		t.Fatalf("unexpected HEAD response status=%d body=%q", w.Code, w.Body.String())
	}
	if w.Header().Get("Content-Length") != strconv.Itoa(len(payload)) {
		t.Fatalf("unexpected content length %q", w.Header().Get("Content-Length"))
	}
}

func TestDeveloperHTTPRangeAndConditionalRequests(t *testing.T) {
	payload := []byte("0123456789")
	result := developerHTTPResult(payload)
	handler := NewDeveloperHTTPHandler(developerResourceAPIStub{result: result})

	r := httptest.NewRequest(http.MethodGet, developerHTTPURL(result.Object), nil)
	r.Header.Set("Range", "bytes=2-5")
	w := httptest.NewRecorder()
	handler.ServeHTTP(w, r)
	if w.Code != http.StatusPartialContent || w.Body.String() != "2345" {
		t.Fatalf("unexpected range response status=%d body=%q", w.Code, w.Body.String())
	}
	if w.Header().Get("Content-Range") != "bytes 2-5/10" {
		t.Fatalf("unexpected content range %q", w.Header().Get("Content-Range"))
	}

	etag := w.Header().Get("ETag")
	r = httptest.NewRequest(http.MethodGet, developerHTTPURL(result.Object), nil)
	r.Header.Set("If-None-Match", etag)
	w = httptest.NewRecorder()
	handler.ServeHTTP(w, r)
	if w.Code != http.StatusNotModified || w.Body.Len() != 0 {
		t.Fatalf("unexpected conditional response status=%d body=%q", w.Code, w.Body.String())
	}
}

func TestDeveloperHTTPUsesDeterministicJSONErrors(t *testing.T) {
	result := developerHTTPResult([]byte("error-envelope"))
	handler := NewDeveloperHTTPHandler(developerResourceAPIStub{result: result})
	r := httptest.NewRequest(http.MethodPost, developerHTTPURL(result.Object), nil)
	w := httptest.NewRecorder()
	handler.ServeHTTP(w, r)
	if w.Code != http.StatusMethodNotAllowed || w.Header().Get("Content-Type") != "application/json" {
		t.Fatalf("unexpected response status=%d type=%q", w.Code, w.Header().Get("Content-Type"))
	}
	var envelope DeveloperHTTPError
	if err := json.Unmarshal(w.Body.Bytes(), &envelope); err != nil {
		t.Fatal(err)
	}
	if envelope.Version != DeveloperAPIVersion || envelope.Code != "method_not_allowed" || envelope.Error == "" {
		t.Fatalf("unexpected envelope %#v", envelope)
	}
}

func TestDeveloperHTTPPrivateAccessRemainsDefaultDeny(t *testing.T) {
	payload := []byte("private-http")
	object := developerObjectRef(payload)
	api := GatewayDeveloperAPI{Router: GatewayRouter{Cache: []GatewaySource{developerGatewaySourceStub{payload: payload}}}}
	handler := NewDeveloperHTTPHandler(api)
	r := httptest.NewRequest(http.MethodGet, developerHTTPURL(object), nil)
	r.Header.Set(DeveloperHeaderAccessMode, string(DeveloperAccessPrivate))
	r.Header.Set(DeveloperHeaderSubject, "subject-1")
	r.Header.Set(DeveloperHeaderSessionID, "session-1")
	r.Header.Set(DeveloperHeaderCapability, GatewayAccessRead)
	w := httptest.NewRecorder()
	handler.ServeHTTP(w, r)
	if w.Code != http.StatusForbidden {
		t.Fatalf("expected default deny, got status=%d body=%q", w.Code, w.Body.String())
	}
}

func TestDeveloperHTTPDoesNotTrustForwardedIdentityHeaders(t *testing.T) {
	payload := []byte("forwarded")
	object := developerObjectRef(payload)
	api := GatewayDeveloperAPI{Router: GatewayRouter{Cache: []GatewaySource{developerGatewaySourceStub{payload: payload}}, Authorizer: developerGatewayAuthorizerStub{}}}
	handler := NewDeveloperHTTPHandler(api)
	r := httptest.NewRequest(http.MethodGet, developerHTTPURL(object), nil)
	r.Header.Set(DeveloperHeaderAccessMode, string(DeveloperAccessPrivate))
	r.Header.Set("X-Forwarded-User", "subject-1")
	r.Header.Set("X-Forwarded-Session", "session-1")
	r.Header.Set("X-Forwarded-Capability", GatewayAccessRead)
	w := httptest.NewRecorder()
	handler.ServeHTTP(w, r)
	if w.Code != http.StatusBadRequest {
		t.Fatalf("forwarded identity unexpectedly accepted: status=%d body=%q", w.Code, w.Body.String())
	}
}

func TestDeveloperHTTPRejectsBodiesAndOversizedRequests(t *testing.T) {
	result := developerHTTPResult([]byte("bounded"))
	handler := NewDeveloperHTTPHandler(developerResourceAPIStub{result: result})

	r := httptest.NewRequest(http.MethodGet, developerHTTPURL(result.Object), strings.NewReader("body"))
	w := httptest.NewRecorder()
	handler.ServeHTTP(w, r)
	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected body rejection, got %d", w.Code)
	}

	handler.Policy.MaxRequestURIBytes = 16
	r = httptest.NewRequest(http.MethodGet, developerHTTPURL(result.Object), nil)
	w = httptest.NewRecorder()
	handler.ServeHTTP(w, r)
	if w.Code != http.StatusRequestURITooLong {
		t.Fatalf("expected URI limit, got %d", w.Code)
	}

	handler = NewDeveloperHTTPHandler(developerResourceAPIStub{result: result})
	handler.Policy.MaxHeaderBytes = 8
	r = httptest.NewRequest(http.MethodGet, developerHTTPURL(result.Object), nil)
	r.Header.Set("X-Large", strings.Repeat("x", 32))
	w = httptest.NewRecorder()
	handler.ServeHTTP(w, r)
	if w.Code != http.StatusRequestHeaderFieldsTooLarge {
		t.Fatalf("expected header limit, got %d", w.Code)
	}
}

func TestDeveloperHTTPAppliesRequestTimeout(t *testing.T) {
	handler := NewDeveloperHTTPHandler(developerResourceAPIStub{wait: true})
	handler.Policy.RequestTimeout = time.Millisecond
	object := developerObjectRef([]byte("timeout"))
	r := httptest.NewRequest(http.MethodGet, developerHTTPURL(object), nil)
	w := httptest.NewRecorder()
	handler.ServeHTTP(w, r)
	if w.Code != http.StatusGatewayTimeout {
		t.Fatalf("expected timeout, got status=%d body=%q", w.Code, w.Body.String())
	}
}

func TestDeveloperHTTPMapsUnavailableResource(t *testing.T) {
	object := developerObjectRef([]byte("unavailable"))
	handler := NewDeveloperHTTPHandler(developerResourceAPIStub{err: errors.New("offline")})
	r := httptest.NewRequest(http.MethodGet, developerHTTPURL(object), nil)
	w := httptest.NewRecorder()
	handler.ServeHTTP(w, r)
	if w.Code != http.StatusBadGateway {
		t.Fatalf("expected bad gateway, got %d", w.Code)
	}
}

func TestDeveloperHTTPServiceRejectsUnsafePublicBind(t *testing.T) {
	handler := NewDeveloperHTTPHandler(developerResourceAPIStub{})
	service, err := NewDeveloperHTTPService("0.0.0.0:0", handler, DeveloperHTTPTransportPolicy{})
	if service != nil || !errors.Is(err, ErrDeveloperAPI) {
		t.Fatalf("expected public bind rejection, service=%v err=%v", service, err)
	}
}
