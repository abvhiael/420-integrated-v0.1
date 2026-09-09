package storage

import (
	"bytes"
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"sync"
	"testing"
	"time"
)

func TestTransportRejectsOversizedFixedAndChunkedBodies(t *testing.T) {
	s, data, a := transportFixture(t, true)
	h := NewTransportHandler(s)

	fixed := httptest.NewRequest(http.MethodPut, "/v1/shards/"+a.CommitmentID, bytes.NewReader(append(data, 'x')))
	fixed.ContentLength = int64(len(data) + 1)
	fw := httptest.NewRecorder()
	h.ServeHTTP(fw, fixed)
	if fw.Code != http.StatusRequestEntityTooLarge {
		t.Fatalf("fixed oversized status=%d body=%s", fw.Code, fw.Body.String())
	}

	chunked := httptest.NewRequest(http.MethodPut, "/v1/shards/"+a.CommitmentID, bytes.NewReader(append(data, 'x', 'y')))
	chunked.ContentLength = -1
	cw := httptest.NewRecorder()
	h.ServeHTTP(cw, chunked)
	if cw.Code != http.StatusRequestEntityTooLarge {
		t.Fatalf("chunked oversized status=%d body=%s", cw.Code, cw.Body.String())
	}
	if s.runtime.Capacity().UsedBytes != 0 {
		t.Fatal("oversized upload consumed capacity")
	}
}

func TestTransportDuplicatePutIsIdempotent(t *testing.T) {
	s, data, a := transportFixture(t, true)
	h := NewTransportHandler(s)

	first := httptest.NewRequest(http.MethodPut, "/v1/shards/"+a.CommitmentID, bytes.NewReader(data))
	first.ContentLength = int64(len(data))
	firstW := httptest.NewRecorder()
	h.ServeHTTP(firstW, first)
	if firstW.Code != http.StatusCreated {
		t.Fatalf("first status=%d body=%s", firstW.Code, firstW.Body.String())
	}
	used := s.runtime.Capacity().UsedBytes

	second := httptest.NewRequest(http.MethodPut, "/v1/shards/"+a.CommitmentID, bytes.NewReader(data))
	second.ContentLength = int64(len(data))
	secondW := httptest.NewRecorder()
	h.ServeHTTP(secondW, second)
	if secondW.Code != http.StatusOK {
		t.Fatalf("retry status=%d body=%s", secondW.Code, secondW.Body.String())
	}
	if s.runtime.Capacity().UsedBytes != used {
		t.Fatalf("retry changed capacity: before=%d after=%d", used, s.runtime.Capacity().UsedBytes)
	}
}

type cancelReader struct {
	cancel context.CancelFunc
	done   bool
}

func (r *cancelReader) Read(p []byte) (int, error) {
	if r.done {
		return 0, context.Canceled
	}
	r.done = true
	r.cancel()
	copy(p, []byte("abc"))
	return 3, nil
}

func TestCancelledUploadReleasesReservationAndPersistsNothing(t *testing.T) {
	data := []byte("abcdef")
	a := assignmentFor(data, "commitment-cancel", "node-cancel")
	store, err := OpenFileStore(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	r, err := NewRuntime(a.NodeID, uint64(len(data)), store, fakeChain{assignments: map[string]Assignment{a.CommitmentID: a}}, nil)
	if err != nil {
		t.Fatal(err)
	}
	ctx, cancel := context.WithCancel(context.Background())
	_, err = r.StoreShard(ctx, a.CommitmentID, &cancelReader{cancel: cancel})
	if !errors.Is(err, context.Canceled) {
		t.Fatalf("got %v", err)
	}
	if r.Capacity().UsedBytes != 0 {
		t.Fatal("cancelled upload consumed capacity")
	}
	if _, _, err := r.Retrieve(context.Background(), a.CommitmentID, 0, 0); !errors.Is(err, ErrShardNotFound) {
		t.Fatalf("cancelled upload persisted shard: %v", err)
	}
}

type gateReader struct {
	started chan<- struct{}
	release <-chan struct{}
	data    []byte
	once    sync.Once
}

func (r *gateReader) Read(p []byte) (int, error) {
	r.once.Do(func() { r.started <- struct{}{} })
	<-r.release
	if len(r.data) == 0 {
		return 0, context.Canceled
	}
	n := copy(p, r.data)
	r.data = r.data[n:]
	if len(r.data) == 0 {
		return n, nil
	}
	return n, nil
}

func TestConcurrentUploadsCannotOversubscribeCapacity(t *testing.T) {
	data1 := []byte("abcdef")
	data2 := []byte("ghijkl")
	a1 := assignmentFor(data1, "commitment-race-1", "node-race")
	a2 := assignmentFor(data2, "commitment-race-2", "node-race")
	chain := fakeChain{assignments: map[string]Assignment{a1.CommitmentID: a1, a2.CommitmentID: a2}}
	store, err := OpenFileStore(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	r, err := NewRuntime("node-race", uint64(len(data1)), store, chain, nil)
	if err != nil {
		t.Fatal(err)
	}
	started := make(chan struct{}, 1)
	release := make(chan struct{})
	firstDone := make(chan error, 1)
	go func() {
		_, err := r.StoreShard(context.Background(), a1.CommitmentID, &gateReader{started: started, release: release, data: append([]byte(nil), data1...)})
		firstDone <- err
	}()

	select {
	case <-started:
	case <-time.After(time.Second):
		t.Fatal("first upload did not reserve capacity")
	}
	if _, err := r.StoreShard(context.Background(), a2.CommitmentID, bytes.NewReader(data2)); !errors.Is(err, ErrCapacityExceeded) {
		t.Fatalf("second upload got %v", err)
	}
	close(release)
	if err := <-firstDone; err != nil {
		t.Fatal(err)
	}
	if r.Capacity().UsedBytes != uint64(len(data1)) {
		t.Fatalf("used=%d", r.Capacity().UsedBytes)
	}
}
