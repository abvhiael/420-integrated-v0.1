package main

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"os"
	"os/signal"
	"strconv"
	"strings"
	"syscall"
	"time"

	appstoreapi "github.com/420integrated/420-integrated/appstore/api"
	appstorecatalog "github.com/420integrated/420-integrated/appstore/catalog"
	"github.com/420integrated/420-integrated/appstore/hardening"
	appstorepublic "github.com/420integrated/420-integrated/appstore/publicservice"
	appstoreregistry "github.com/420integrated/420-integrated/appstore/registry"
	appstoreruntime "github.com/420integrated/420-integrated/appstore/runtime"
)

const catalogueRefreshInterval = 30 * time.Second

func main() {
	cfg, err := loadConfig(os.Getenv)
	if err != nil {
		fatal(err)
	}
	probe := appstoreruntime.NewRPCProbe(cfg)
	service, err := appstoreruntime.NewService(cfg, probe)
	if err != nil {
		fatal(err)
	}
	source, err := appstoreregistry.NewIndexerSource(cfg.IndexerURL, cfg.ChainID, cfg.RegistryAddress, 10*time.Second)
	if err != nil {
		fatal(err)
	}
	store, err := appstorecatalog.Open(cfg.CatalogueStore)
	if err != nil {
		fatal(err)
	}
	lifecycle, err := appstorecatalog.NewLifecycle(store, source, cfg.ChainID, cfg.RegistryAddress)
	if err != nil {
		fatal(err)
	}
	views := appstoreapi.NewViewSet()
	dependencies := appstorepublic.NewDependencyState(hardening.Dependencies{
		Registry: true,
		RPC:      true,
		Search:   true,
		Verify:   false,
		Store:    false,
	})
	verifyClient := &http.Client{Timeout: 5 * time.Second}

	qualifyCtx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	if err := service.Qualify(qualifyCtx); err != nil {
		cancel()
		fatal(err)
	}
	if err := lifecycle.Bootstrap(qualifyCtx); err != nil {
		cancel()
		fatal(err)
	}
	if err := rebuildApplicationViews(cfg, lifecycle, views); err != nil {
		cancel()
		fatal(err)
	}
	dependencies.Set(hardening.Dependencies{
		Registry: true,
		RPC:      true,
		Search:   true,
		Verify:   appstorepublic.ProbeReady(qualifyCtx, verifyClient, cfg.VerifyURL),
		Store:    true,
	})
	publicService, err := appstorepublic.New(service, views, dependencies, appstorepublic.Config{})
	if err != nil {
		cancel()
		fatal(err)
	}
	cancel()

	server := &http.Server{Addr: cfg.ListenAddr, Handler: publicService.Handler(), ReadHeaderTimeout: 5 * time.Second}
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	errCh := make(chan error, 2)
	go func() { errCh <- server.ListenAndServe() }()
	go func() {
		if err := runCatalogueComposition(ctx, cfg, lifecycle, views, dependencies, verifyClient, catalogueRefreshInterval); err != nil {
			errCh <- fmt.Errorf("catalogue/ApplicationView lifecycle: %w", err)
		}
	}()

	select {
	case err := <-errCh:
		if err != nil && !errors.Is(err, http.ErrServerClosed) {
			shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
			_ = server.Shutdown(shutdownCtx)
			cancel()
			fatal(err)
		}
	case <-ctx.Done():
		shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		if err := server.Shutdown(shutdownCtx); err != nil {
			fatal(err)
		}
	}
}

func runCatalogueComposition(ctx context.Context, cfg appstoreruntime.Config, lifecycle *appstorecatalog.Lifecycle, views *appstoreapi.ViewSet, dependencies *appstorepublic.DependencyState, verifyClient *http.Client, interval time.Duration) error {
	if interval <= 0 {
		return errors.New("catalogue refresh interval must be positive")
	}
	ticker := time.NewTicker(interval)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return nil
		case <-ticker.C:
			if err := lifecycle.Refresh(ctx); err != nil {
				return err
			}
			if err := rebuildApplicationViews(cfg, lifecycle, views); err != nil {
				return err
			}
			dependencies.Set(hardening.Dependencies{
				Registry: true,
				RPC:      true,
				Search:   true,
				Verify:   appstorepublic.ProbeReady(ctx, verifyClient, cfg.VerifyURL),
				Store:    true,
			})
		}
	}
}

func rebuildApplicationViews(cfg appstoreruntime.Config, lifecycle *appstorecatalog.Lifecycle, views *appstoreapi.ViewSet) error {
	doc, ok := lifecycle.Snapshot()
	if !ok {
		return errors.New("catalogue lifecycle is not ready")
	}
	inputs, err := appstoreapi.LoadCompositionInputs(cfg.ViewInputs)
	if err != nil {
		return err
	}
	if err := views.Rebuild(doc, cfg.ChainID, inputs); err != nil {
		return err
	}
	return nil
}

func loadConfig(getenv func(string) string) (appstoreruntime.Config, error) {
	chainID := uint64(420)
	if raw := strings.TrimSpace(getenv("APPSTORE_CHAIN_ID")); raw != "" {
		v, err := strconv.ParseUint(raw, 10, 64)
		if err != nil || v == 0 {
			return appstoreruntime.Config{}, fmt.Errorf("APPSTORE_CHAIN_ID must be a non-zero uint64")
		}
		chainID = v
	}
	cfg := appstoreruntime.Config{
		ChainID:         chainID,
		RPCURL:          strings.TrimSpace(getenv("APPSTORE_RPC_URL")),
		IndexerURL:      strings.TrimSpace(getenv("APPSTORE_INDEXER_URL")),
		RegistryAddress: strings.TrimSpace(getenv("APPSTORE_REGISTRY_ADDRESS")),
		CatalogueStore:  strings.TrimSpace(getenv("APPSTORE_CATALOGUE_STORE")),
		ViewInputs:      strings.TrimSpace(getenv("APPSTORE_VIEW_INPUTS")),
		VerifyURL:       strings.TrimSpace(getenv("APPSTORE_VERIFY_URL")),
		ListenAddr:      strings.TrimSpace(getenv("APPSTORE_LISTEN_ADDR")),
	}
	if cfg.ListenAddr == "" {
		cfg.ListenAddr = ":8426"
	}
	if err := cfg.Validate(); err != nil {
		return appstoreruntime.Config{}, err
	}
	return cfg, nil
}

func fatal(err error) { fmt.Fprintln(os.Stderr, err); os.Exit(1) }
