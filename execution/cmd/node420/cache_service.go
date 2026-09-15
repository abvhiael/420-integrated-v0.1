package main

import (
	"context"
	"errors"
	"flag"
	"path/filepath"
	"time"

	storage "github.com/420integrated/420-integrated/execution/storage"
)

var (
	cacheEnabled    = flag.Bool("cache", false, "enable 420Cache reconciliation service")
	cacheListen     = flag.String("cache.listen", "127.0.0.1:8421", "420Cache HTTP listen address")
	cacheOriginURL  = flag.String("cache.origin", "", "optional upstream 420Cache/420Gateway origin URL")
	cacheMaxBytes   = flag.Uint64("cache.max-bytes", 1<<30, "maximum local cache bytes")
	cacheMaxEntries = flag.Uint("cache.max-entries", 4096, "maximum local cache entries")
	cacheTTL        = flag.Duration("cache.ttl", 30*time.Minute, "default local cache TTL")
	cacheMaxTTL     = flag.Duration("cache.max-ttl", 2*time.Hour, "maximum local cache TTL")
	cacheInterval   = flag.Duration("cache.reconcile-interval", time.Minute, "canonical cache reconciliation interval")
	cacheMinBackoff = flag.Duration("cache.reconcile-min-backoff", 5*time.Second, "minimum reconciliation retry backoff")
	cacheMaxBackoff = flag.Duration("cache.reconcile-max-backoff", time.Minute, "maximum reconciliation retry backoff")
)

func newNodeCacheService(datadir, rpcURL string, contracts storage.RPCStorageContracts) (serviceRunner, error) {
	if *cacheMaxEntries == 0 || uint64(*cacheMaxEntries) > uint64(^uint32(0)) {
		return nil, storage.ErrInvalidCacheState
	}
	persistent, err := storage.NewPersistentCacheRuntime(filepath.Join(datadir, "cache"), storage.CachePolicy{
		MaxBytes: *cacheMaxBytes, MaxEntries: uint32(*cacheMaxEntries), DefaultTTL: *cacheTTL, MaxTTL: *cacheMaxTTL,
	})
	if err != nil { return nil, err }
	canonical := storage.RepairCacheCanonicalReader{Reader: storage.RPCRepairReader{
		Backend: storage.RPCBackend{URL: rpcURL}, Contracts: contracts,
	}}
	reconciler, err := storage.NewCacheReconcileService(persistent, canonical, *cacheInterval, *cacheMinBackoff, *cacheMaxBackoff)
	if err != nil { return nil, err }
	runtime, err := storage.NewCacheRuntimeService(reconciler)
	if err != nil { return nil, err }
	var origin storage.CacheOrigin
	if *cacheOriginURL != "" { origin = storage.HTTPCacheOrigin{BaseURL:*cacheOriginURL} }
	handler := storage.CacheHTTPHandler{Runtime:persistent, Reconciler:reconciler, Origin:origin, TTL:*cacheTTL}
	transport, err := storage.NewCacheHTTPService(*cacheListen, handler)
	if err != nil { return nil, err }
	return serviceGroup{services:[]serviceRunner{runtime, transport}}, nil
}

type serviceGroup struct { services []serviceRunner }

func (g serviceGroup) Run(ctx context.Context) error {
	if len(g.services) == 0 { return errors.New("empty node420 service group") }
	runCtx, cancel := context.WithCancel(ctx)
	defer cancel()
	type result struct { index int; err error }
	results := make(chan result, len(g.services))
	for i, service := range g.services {
		if service == nil { return errors.New("nil node420 service") }
		go func(index int, runner serviceRunner) { results <- result{index:index, err:runner.Run(runCtx)} }(i, service)
	}
	first := <-results
	cancel()
	if first.err != nil && !errors.Is(first.err, context.Canceled) { return first.err }
	if ctx.Err() == nil { return errors.New("node420 service exited unexpectedly") }
	return nil
}
