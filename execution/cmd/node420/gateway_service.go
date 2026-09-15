package main

import (
	"context"
	"errors"
	"flag"
	"log/slog"
	"net/http"
	"strings"
	"time"

	storage "github.com/420integrated/420-integrated/execution/storage"
)

var (
	gatewayEnabled          = flag.Bool("gateway", false, "enable 420Gateway HTTP service")
	gatewayListen           = flag.String("gateway.listen", "127.0.0.1:8422", "420Gateway HTTP listen address")
	gatewayCacheURL         = flag.String("gateway.cache-url", "", "optional upstream 420Cache base URL")
	gatewayCacheToken       = flag.String("gateway.cache-token", "", "optional bearer token for upstream 420Cache")
	gatewayStoreURL         = flag.String("gateway.store-url", "", "optional upstream 420Store base URL")
	gatewayStoreToken       = flag.String("gateway.store-token", "", "optional bearer token for upstream 420Store")
	gatewayTimeout          = flag.Duration("gateway.upstream-timeout", 10*time.Second, "420Gateway upstream request timeout")
	gatewayUpstreamAttempts = flag.Uint("gateway.upstream-attempts", 3, "maximum attempts per 420Gateway HTTP upstream")
	gatewayUpstreamBackoff  = flag.Duration("gateway.upstream-backoff", 100*time.Millisecond, "initial retry backoff for transient 420Gateway upstream failures")
	gatewayUpstreamMaxBackoff = flag.Duration("gateway.upstream-max-backoff", time.Second, "maximum retry backoff for transient 420Gateway upstream failures")
	gatewayMaxConcurrent    = flag.Uint("gateway.max-concurrent-requests", 128, "maximum concurrent 420Gateway requests")
	gatewayRateRequests     = flag.Uint("gateway.rate-limit-requests", 240, "maximum requests per client in each rate-limit window")
	gatewayRateWindow       = flag.Duration("gateway.rate-limit-window", time.Minute, "per-client 420Gateway rate-limit window")
	gatewayTLSCert          = flag.String("gateway.tls-cert", "", "TLS certificate file for 420Gateway HTTPS")
	gatewayTLSKey           = flag.String("gateway.tls-key", "", "TLS private key file for 420Gateway HTTPS")
	gatewayAllowedHosts     = flag.String("gateway.allowed-hosts", "", "comma-separated allowed Host values; required for non-loopback gateway exposure")
	gatewayFailureThreshold = flag.Uint64("gateway.degraded-failure-threshold", 3, "consecutive gateway 5xx responses before readiness becomes degraded")
	gatewayMetrics          *storage.GatewayHTTPMetrics
	gatewayHealth           *storage.GatewayHealthTracker
)

func newNodeGatewayService() (serviceRunner, error) {
	if strings.TrimSpace(*gatewayListen) == "" || *gatewayTimeout <= 0 || *gatewayRateWindow <= 0 || *gatewayFailureThreshold == 0 {
		return nil, storage.ErrGatewayRoute
	}
	if *gatewayUpstreamAttempts == 0 || *gatewayUpstreamAttempts > 16 || *gatewayUpstreamBackoff <= 0 || *gatewayUpstreamMaxBackoff <= 0 || *gatewayUpstreamMaxBackoff < *gatewayUpstreamBackoff {
		return nil, storage.ErrGatewayRoute
	}
	if *gatewayMaxConcurrent == 0 || *gatewayRateRequests == 0 || uint64(*gatewayMaxConcurrent) > uint64(^uint32(0)) || uint64(*gatewayRateRequests) > uint64(^uint32(0)) {
		return nil, storage.ErrGatewayRoute
	}
	client := &http.Client{Timeout: *gatewayTimeout}
	retry := storage.GatewayRetryPolicy{
		MaxAttempts:    uint32(*gatewayUpstreamAttempts),
		InitialBackoff: *gatewayUpstreamBackoff,
		MaxBackoff:     *gatewayUpstreamMaxBackoff,
	}
	router := storage.GatewayRouter{}
	if strings.TrimSpace(*gatewayCacheURL) != "" {
		router.Cache = append(router.Cache, storage.HTTPGatewayCacheSource{
			BaseURL: *gatewayCacheURL,
			Client:  client,
			Token:   *gatewayCacheToken,
			Retry:   retry,
		})
	}
	if strings.TrimSpace(*gatewayStoreURL) != "" {
		router.Store = append(router.Store, storage.HTTPGatewayStoreSource{
			BaseURL: *gatewayStoreURL,
			Client:  client,
			Token:   *gatewayStoreToken,
			Retry:   retry,
		})
	}
	if len(router.Cache) == 0 && len(router.Store) == 0 {
		return nil, errors.New("gateway requires at least one cache or store upstream")
	}
	var hosts []string
	for _, host := range strings.Split(*gatewayAllowedHosts, ",") {
		if host = strings.TrimSpace(host); host != "" {
			hosts = append(hosts, host)
		}
	}
	health := storage.NewGatewayHealthTracker(*gatewayFailureThreshold)
	loggerObserver := storage.GatewaySlogObserver{Logger: slog.Default()}
	observer := storage.GatewayHTTPObserverFunc(func(ctx context.Context, observation storage.GatewayHTTPObservation) {
		loggerObserver.ObserveGatewayHTTP(ctx, observation)
	})
	service, metrics, health, err := storage.NewGatewayHTTPServiceWithHealthObservability(*gatewayListen, storage.GatewayHTTPHandler{Router: router}, storage.GatewayHTTPPolicy{
		MaxConcurrentRequests: uint32(*gatewayMaxConcurrent),
		RateLimitRequests:     uint32(*gatewayRateRequests),
		RateLimitWindow:       *gatewayRateWindow,
	}, storage.GatewayHTTPTransportPolicy{
		TLSCertFile:  *gatewayTLSCert,
		TLSKeyFile:   *gatewayTLSKey,
		AllowedHosts: hosts,
	}, health, observer)
	if err != nil {
		return nil, err
	}
	gatewayMetrics = metrics
	gatewayHealth = health
	return service, nil
}
