package main

import (
	"context"
	"errors"
	"testing"
	"time"
)

type groupRunnerStub struct {
	started chan struct{}
	err     error
	exitNow bool
}

func (s groupRunnerStub) Run(ctx context.Context) error {
	if s.started != nil {
		select {
		case s.started <- struct{}{}:
		default:
		}
	}
	if s.exitNow { return s.err }
	<-ctx.Done()
	return nil
}

func TestServiceGroupCancelsWithParent(t *testing.T) {
	started := make(chan struct{}, 2)
	group := serviceGroup{services: []serviceRunner{
		groupRunnerStub{started:started},
		groupRunnerStub{started:started},
	}}
	ctx, cancel := context.WithCancel(context.Background())
	done := make(chan error, 1)
	go func() { done <- group.Run(ctx) }()
	for i := 0; i < 2; i++ {
		select {
		case <-started:
		case <-time.After(time.Second):
			t.Fatal("service did not start")
		}
	}
	cancel()
	select {
	case err := <-done:
		if err != nil { t.Fatalf("group err=%v", err) }
	case <-time.After(time.Second):
		t.Fatal("group did not stop")
	}
}

func TestServiceGroupPropagatesChildFailure(t *testing.T) {
	boom := errors.New("boom")
	group := serviceGroup{services: []serviceRunner{
		groupRunnerStub{exitNow:true, err:boom},
		groupRunnerStub{},
	}}
	err := group.Run(context.Background())
	if !errors.Is(err, boom) { t.Fatalf("expected boom, got %v", err) }
}

func TestServiceGroupTreatsUnexpectedCleanExitAsFailure(t *testing.T) {
	group := serviceGroup{services: []serviceRunner{
		groupRunnerStub{exitNow:true},
		groupRunnerStub{},
	}}
	if err := group.Run(context.Background()); err == nil {
		t.Fatal("expected unexpected-exit error")
	}
}
