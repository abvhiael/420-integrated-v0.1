package storage

import (
	"context"
	"fmt"
	"net/http"
	"net/http/httptest"
	"runtime"
	"sync"
	"sync/atomic"
	"testing"
	"time"
)

type productionAlternatingSource struct {
	payload []byte
	calls   atomic.Uint64
	failOnEven bool
}

func (s *productionAlternatingSource) FetchGatewayObject(context.Context, GatewayRequest) ([]byte, error) {
	call := s.calls.Add(1)
	if s.failOnEven && call%2 == 0 {
		return nil, ErrGatewayRoute
	}
	return append([]byte(nil), s.payload...), nil
}

func TestProductionConcurrentRetrievalCapacity(t *testing.T) {
	const operations = 512
	const workers = 32
	payload := []byte("production-capacity-payload")
	cache := &productionAlternatingSource{payload: payload, failOnEven: true}
	store := &productionAlternatingSource{payload: payload}
	discovery := MultiProviderResourceDiscovery{Sources: []ResourceDiscovery{
		productionDiscoveryStub{endpoints: []ResourceEndpoint{{ProviderID: "provider-a", NodeID: "node-a", ServiceID: "cache-a", Capability: ResourceCapabilityCache, Priority: 10, State: ResourceServiceRunning, Source: cache}}},
		productionDiscoveryStub{endpoints: []ResourceEndpoint{{ProviderID: "provider-b", NodeID: "node-b", ServiceID: "store-b", Capability: ResourceCapabilityStore, Priority: 20, State: ResourceServiceRunning, Source: store}}},
	}}
	router := GatewayRouter{Discovery: ResourceGatewayDiscovery{Discovery: discovery}}
	key := CacheKey{ObjectID: "obj", ManifestID: "manifest", ShardIndex: 0, ShardRoot: DeveloperShardRoot(payload), SizeBytes: uint64(len(payload))}

	jobs := make(chan int)
	errCh := make(chan error, operations)
	var wg sync.WaitGroup
	for i := 0; i < workers; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for range jobs {
				result, err := router.Route(context.Background(), GatewayRequest{CacheKey: key, CommitmentID: "commit", Access: GatewayAccess{Mode: GatewayAccessPublic}})
				if err != nil {
					errCh <- err
					continue
				}
				if err := verifyCachePayload(key, result.Payload); err != nil {
					errCh <- err
				}
			}
		}()
	}
	for i := 0; i < operations; i++ {
		jobs <- i
	}
	close(jobs)
	wg.Wait()
	close(errCh)
	for err := range errCh {
		t.Fatalf("concurrent retrieval failed: %v", err)
	}
	if got := cache.calls.Load(); got != operations {
		t.Fatalf("cache attempts=%d want=%d", got, operations)
	}
	if got := store.calls.Load(); got != operations/2 {
		t.Fatalf("store fallbacks=%d want=%d", got, operations/2)
	}
}

func TestProductionDiscoveryChurnUnderLoad(t *testing.T) {
	payload := []byte("churn-payload")
	topology := buildProductionTestTopology(t, payload)
	if err := topology.StartAll(); err != nil {
		t.Fatal(err)
	}

	var wg sync.WaitGroup
	errCh := make(chan error, 256)
	wg.Add(1)
	go func() {
		defer wg.Done()
		for i := 0; i < 100; i++ {
			for _, node := range topology.Nodes() {
				if node.ProviderID != "provider-a" {
					continue
				}
				if err := node.Runtime.Transition("cache-a", ResourceServiceDegraded); err != nil {
					errCh <- err
					return
				}
				if err := node.Runtime.Transition("cache-a", ResourceServiceRunning); err != nil {
					errCh <- err
					return
				}
			}
		}
	}()
	for worker := 0; worker < 8; worker++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for i := 0; i < 100; i++ {
				endpoints, err := topology.Discovery().DiscoverResources(context.Background(), ResourceDiscoveryRequest{Capabilities: []ResourceCapability{ResourceCapabilityStore, ResourceCapabilityCache}, IncludeDegraded: true})
				if err != nil {
					errCh <- err
					return
				}
				if len(endpoints) < 3 {
					errCh <- fmt.Errorf("discovery lost stable endpoints: %#v", endpoints)
					return
				}
			}
		}()
	}
	wg.Wait()
	close(errCh)
	for err := range errCh {
		t.Fatal(err)
	}
}

func TestProductionGatewayConcurrentRangeLoad(t *testing.T) {
	const operations = 128
	payload := []byte("0123456789abcdef")
	router := GatewayRouter{Store: []GatewaySource{productionGatewaySource{payload: payload}}}
	handler := GatewayHTTPHandler{Router: router}
	root := DeveloperShardRoot(payload)
	url := fmt.Sprintf("/v1/gateway?object_id=obj&manifest_id=manifest&shard_index=0&shard_root=%s&size_bytes=%d&commitment_id=commit", root, len(payload))

	var wg sync.WaitGroup
	errCh := make(chan error, operations)
	for i := 0; i < operations; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			req := httptest.NewRequest(http.MethodGet, url, nil)
			req.Header.Set("Range", "bytes=0-3")
			rec := httptest.NewRecorder()
			handler.ServeHTTP(rec, req)
			if rec.Code != http.StatusPartialContent || rec.Body.String() != "0123" {
				errCh <- fmt.Errorf("range response status=%d body=%q", rec.Code, rec.Body.String())
			}
		}()
	}
	wg.Wait()
	close(errCh)
	for err := range errCh {
		t.Fatal(err)
	}
}

func TestProductionCancellationLoadDoesNotLeakWorkers(t *testing.T) {
	before := runtime.NumGoroutine()
	const operations = 64
	var wg sync.WaitGroup
	for i := 0; i < operations; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			ctx, cancel := context.WithTimeout(context.Background(), 2*time.Millisecond)
			defer cancel()
			_, _ = productionBlockingSource{}.FetchGatewayObject(ctx, GatewayRequest{})
		}()
	}
	wg.Wait()
	runtime.GC()
	time.Sleep(10 * time.Millisecond)
	after := runtime.NumGoroutine()
	if after > before+8 {
		t.Fatalf("possible goroutine leak: before=%d after=%d", before, after)
	}
}
