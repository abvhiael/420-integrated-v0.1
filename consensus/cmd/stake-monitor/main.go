package main

import (
	"context"
	"encoding/json"
	"flag"
	"fmt"
	"github.com/420integrated/420-integrated/consensus/monitoring"
	"github.com/420integrated/420-integrated/consensus/recovery"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"
)

func run() error {
	path := flag.String("config", "", "private operator configuration; never exported")
	initialize := flag.Bool("initialize", false, "explicitly initialize a never-used operational outbox, then exit")
	once := flag.Bool("once", false, "collect and dispatch one cycle")
	publish := flag.String("publish-public-inputs", "", "source-owner public projection directory; never publishes private journals/credentials")
	component := flag.String("publish-component", "", "consensus, indexer, accounting, canary or one runtime health component")
	redrive := flag.Bool("redrive", false, "explicitly requeue dead-letter deliveries with their original IDs")
	flag.Parse()
	raw, err := os.ReadFile(*path)
	if err != nil {
		return fmt.Errorf("MONITOR_CONFIGURATION_UNAVAILABLE")
	}
	var config monitoring.Config
	if recovery.Decode(raw, &config) != nil || config.Validate() != nil {
		return fmt.Errorf("MONITOR_CONFIGURATION_INVALID")
	}
	if *publish != "" {
		if *initialize || *redrive {
			return fmt.Errorf("PUBLICATION_MODE_CONFLICT")
		}
		return monitoring.PublishPublicInputs(config, *publish, *component, time.Now().UTC())
	}
	store, err := monitoring.Open(config, *initialize)
	if err != nil {
		return err
	}
	defer store.Close()
	if *initialize {
		return nil
	}
	if *redrive {
		return store.Redrive()
	}
	collector, err := monitoring.NewCollector(config)
	if err != nil {
		return err
	}
	sender, err := monitoring.NewSender(config)
	if err != nil {
		return err
	}
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	service := monitoring.NewService(store, sender, collector.Collect)
	cycle := func() error {
		limited, cancel := context.WithTimeout(ctx, time.Duration(config.IntervalSeconds)*time.Second)
		defer cancel()
		return service.Cycle(limited, time.Now().UTC())
	}
	if err = cycle(); err != nil {
		return err
	}
	if *once {
		return nil
	}
	server := &http.Server{Addr: config.Listen, Handler: service.Handler(), ReadHeaderTimeout: 5 * time.Second}
	fail := make(chan error, 1)
	go func() { fail <- server.ListenAndServe() }()
	defer server.Close()
	ticker := time.NewTicker(time.Duration(config.IntervalSeconds) * time.Second)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return nil
		case <-fail:
			return fmt.Errorf("MONITOR_HTTP_UNAVAILABLE")
		case <-ticker.C:
			if err = cycle(); err != nil {
				return err
			}
		}
	}
}
func main() {
	if err := run(); err != nil {
		_ = json.NewEncoder(os.Stderr).Encode(struct{ Schema, Code string }{monitoring.Schema, err.Error()})
		os.Exit(1)
	}
}
