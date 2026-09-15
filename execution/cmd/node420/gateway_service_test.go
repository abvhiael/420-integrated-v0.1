package main

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

func preserveGatewayRetryFlags(t *testing.T) func() {
	t.Helper()
	oldAttempts, oldBackoff, oldMaxBackoff := *gatewayUpstreamAttempts, *gatewayUpstreamBackoff, *gatewayUpstreamMaxBackoff
	return func() {
		*gatewayUpstreamAttempts = oldAttempts
		*gatewayUpstreamBackoff = oldBackoff
		*gatewayUpstreamMaxBackoff = oldMaxBackoff
	}
}

func TestNewNodeGatewayServiceRequiresUpstream(t *testing.T) {
	oldListen, oldCache, oldStore, oldTimeout := *gatewayListen, *gatewayCacheURL, *gatewayStoreURL, *gatewayTimeout
	defer func() { *gatewayListen, *gatewayCacheURL, *gatewayStoreURL, *gatewayTimeout = oldListen, oldCache, oldStore, oldTimeout }()
	defer preserveGatewayRetryFlags(t)()
	*gatewayListen = "127.0.0.1:0"
	*gatewayCacheURL = ""
	*gatewayStoreURL = ""
	*gatewayTimeout = time.Second
	*gatewayUpstreamAttempts = 3
	*gatewayUpstreamBackoff = time.Millisecond
	*gatewayUpstreamMaxBackoff = 10 * time.Millisecond
	if _, err := newNodeGatewayService(); err == nil { t.Fatal("expected missing upstream error") }
}

func TestNewNodeGatewayServiceRejectsInvalidRetryPolicy(t *testing.T) {
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusBadGateway)
	}))
	defer upstream.Close()
	oldListen, oldCache, oldStore, oldTimeout := *gatewayListen, *gatewayCacheURL, *gatewayStoreURL, *gatewayTimeout
	defer func() { *gatewayListen, *gatewayCacheURL, *gatewayStoreURL, *gatewayTimeout = oldListen, oldCache, oldStore, oldTimeout }()
	defer preserveGatewayRetryFlags(t)()
	*gatewayListen = "127.0.0.1:0"
	*gatewayCacheURL = upstream.URL
	*gatewayStoreURL = ""
	*gatewayTimeout = time.Second
	*gatewayUpstreamAttempts = 0
	if _, err := newNodeGatewayService(); err == nil { t.Fatal("expected invalid retry policy error") }
}

func TestNewNodeGatewayServiceLifecycle(t *testing.T) {
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusBadGateway)
	}))
	defer upstream.Close()

	oldListen, oldCache, oldStore, oldTimeout := *gatewayListen, *gatewayCacheURL, *gatewayStoreURL, *gatewayTimeout
	defer func() { *gatewayListen, *gatewayCacheURL, *gatewayStoreURL, *gatewayTimeout = oldListen, oldCache, oldStore, oldTimeout }()
	defer preserveGatewayRetryFlags(t)()
	*gatewayListen = "127.0.0.1:0"
	*gatewayCacheURL = upstream.URL
	*gatewayStoreURL = ""
	*gatewayTimeout = time.Second
	*gatewayUpstreamAttempts = 3
	*gatewayUpstreamBackoff = time.Millisecond
	*gatewayUpstreamMaxBackoff = 10 * time.Millisecond

	service, err := newNodeGatewayService()
	if err != nil { t.Fatal(err) }
	ctx, cancel := context.WithCancel(context.Background())
	done := make(chan error, 1)
	go func() { done <- service.Run(ctx) }()
	cancel()
	select {
	case err := <-done:
		if err != nil { t.Fatal(err) }
	case <-time.After(2 * time.Second):
		t.Fatal("gateway service did not stop")
	}
}
