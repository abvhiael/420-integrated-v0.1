package main

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

func TestNewNodeGatewayServiceRequiresUpstream(t *testing.T) {
	oldListen, oldCache, oldStore, oldTimeout := *gatewayListen, *gatewayCacheURL, *gatewayStoreURL, *gatewayTimeout
	defer func() { *gatewayListen, *gatewayCacheURL, *gatewayStoreURL, *gatewayTimeout = oldListen, oldCache, oldStore, oldTimeout }()
	*gatewayListen = "127.0.0.1:0"
	*gatewayCacheURL = ""
	*gatewayStoreURL = ""
	*gatewayTimeout = time.Second
	if _, err := newNodeGatewayService(); err == nil { t.Fatal("expected missing upstream error") }
}

func TestNewNodeGatewayServiceLifecycle(t *testing.T) {
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusBadGateway)
	}))
	defer upstream.Close()

	oldListen, oldCache, oldStore, oldTimeout := *gatewayListen, *gatewayCacheURL, *gatewayStoreURL, *gatewayTimeout
	defer func() { *gatewayListen, *gatewayCacheURL, *gatewayStoreURL, *gatewayTimeout = oldListen, oldCache, oldStore, oldTimeout }()
	*gatewayListen = "127.0.0.1:0"
	*gatewayCacheURL = upstream.URL
	*gatewayStoreURL = ""
	*gatewayTimeout = time.Second

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
