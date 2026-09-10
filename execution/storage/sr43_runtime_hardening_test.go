package storage

import (
	"bytes"
	"context"
	"io"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"sync"
	"testing"
	"time"
)

func TestRetrieveStreamReturnsBoundedRangeWithoutBufferingAPI(t *testing.T) {
	ctx := context.Background()
	data := bytes.Repeat([]byte("420"), 4096)
	a := assignmentFor(data, "stream-1", "node-1")
	store, err := OpenFileStore(t.TempDir())
	if err != nil { t.Fatal(err) }
	r, err := NewRuntime("node-1", uint64(len(data))*2, store, fakeChain{assignments: map[string]Assignment{a.CommitmentID:a}}, nil)
	if err != nil { t.Fatal(err) }
	if _, err := r.StoreShard(ctx, a.CommitmentID, bytes.NewReader(data)); err != nil { t.Fatal(err) }
	rc, rec, n, err := r.RetrieveStream(ctx, a.CommitmentID, 7, 19)
	if err != nil { t.Fatal(err) }
	defer rc.Close()
	got, err := io.ReadAll(rc)
	if err != nil { t.Fatal(err) }
	if n != 19 || rec.SizeBytes != uint64(len(data)) || !bytes.Equal(got, data[7:26]) { t.Fatalf("n=%d len=%d", n, len(got)) }
}

func TestStreamingRootMismatchPersistsNothing(t *testing.T) {
	ctx := context.Background()
	data := []byte("stream-integrity")
	a := assignmentFor(data, "stream-bad", "node-1")
	a.ShardRoot = "00"
	store, err := OpenFileStore(t.TempDir())
	if err != nil { t.Fatal(err) }
	r, err := NewRuntime("node-1", 1024, store, fakeChain{assignments: map[string]Assignment{a.CommitmentID:a}}, nil)
	if err != nil { t.Fatal(err) }
	if _, err := r.StoreShard(ctx, a.CommitmentID, bytes.NewReader(data)); err != ErrCommitmentMismatch { t.Fatalf("got %v", err) }
	if _, _, err := store.Open(ctx, a.CommitmentID); err != ErrShardNotFound { t.Fatalf("stored invalid shard: %v", err) }
	if r.Capacity().UsedBytes != 0 { t.Fatalf("used=%d", r.Capacity().UsedBytes) }
}

type blockingReader struct {
	started chan struct{}
	release chan struct{}
	data []byte
	once sync.Once
}
func (r *blockingReader) Read(p []byte) (int,error) {
	r.once.Do(func(){ close(r.started) })
	<-r.release
	if len(r.data)==0 { return 0, io.EOF }
	n:=copy(p,r.data); r.data=r.data[n:]; return n,nil
}

func TestConcurrentSameCommitmentCollapsesToOneWrite(t *testing.T) {
	ctx := context.Background()
	data := []byte("same-commitment-stream")
	a := assignmentFor(data, "same-1", "node-1")
	store, err := OpenFileStore(t.TempDir())
	if err != nil { t.Fatal(err) }
	r, err := NewRuntime("node-1", 1024, store, fakeChain{assignments: map[string]Assignment{a.CommitmentID:a}}, nil)
	if err != nil { t.Fatal(err) }
	br := &blockingReader{started:make(chan struct{}),release:make(chan struct{}),data:append([]byte(nil),data...)}
	err1 := make(chan error,1)
	go func(){ _, e := r.StoreShard(ctx,a.CommitmentID,br); err1<-e }()
	<-br.started
	err2 := make(chan error,1)
	go func(){ _, e := r.StoreShard(ctx,a.CommitmentID,bytes.NewReader(data)); err2<-e }()
	close(br.release)
	if e:=<-err1; e!=nil { t.Fatal(e) }
	if e:=<-err2; e!=nil { t.Fatal(e) }
	if r.Capacity().UsedBytes != uint64(len(data)) { t.Fatalf("used=%d",r.Capacity().UsedBytes) }
}

func TestTransportBearerAuthorizationAndHeaders(t *testing.T) {
	s := &Service{cfg:ServiceConfig{AuthToken:"secret"}}
	h := NewTransportHandler(s)
	req := httptest.NewRequest(http.MethodGet,"/v1/capacity",nil)
	rr := httptest.NewRecorder()
	h.ServeHTTP(rr,req)
	if rr.Code != http.StatusUnauthorized { t.Fatalf("status=%d",rr.Code) }
	if rr.Header().Get("X-Content-Type-Options") != "nosniff" { t.Fatal("missing security header") }

	req2 := httptest.NewRequest(http.MethodGet,"/v1/capacity",nil)
	req2.Header.Set("Authorization","Bearer secret")
	rr2 := httptest.NewRecorder()
	h.ServeHTTP(rr2,req2)
	if rr2.Code != http.StatusServiceUnavailable { t.Fatalf("authorized status=%d",rr2.Code) }
}

func TestNonLoopbackTransportRequiresAuthToken(t *testing.T) {
	if loopbackListen("0.0.0.0:8420") { t.Fatal("wildcard considered loopback") }
	if !loopbackListen("127.0.0.1:8420") { t.Fatal("loopback rejected") }
}

func TestServiceProofSchedulerAdvancesOnlyAfterSubmission(t *testing.T) {
	ctx := context.Background()
	now := time.Now().UTC()
	data := []byte("proof-stream")
	a := assignmentFor(data,"proof-stream-1","node-1")	a.AgreementID = "0xaaa"
	a.StartTime = now.Add(-time.Hour)
	a.EndTime = now.Add(time.Hour)
	reader := fakeCanonicalReader{
		snapshots:map[string]AssignmentSnapshot{"0xaaa":{Assignment:a,WindowCount:1,NextWindow:0}},
		windows:map[string]map[uint32]struct{ ch Challenge; deadline time.Time }{
			"0xaaa":{0:{ch:Challenge{AgreementID:"0xaaa",CommitmentID:a.CommitmentID,ChallengeID:"0xproof",Epoch:now.Add(-time.Minute)},deadline:now.Add(time.Minute)}},
		},
	}
	state, err := NewFileProjectionStateStore(filepath.Join(t.TempDir(),"projection.json"))
	if err != nil { t.Fatal(err) }
	p, err := NewStorageProjection(StorageContracts{Agreement:"0xagreement"},StorageEventTopics{AgreementActivated:"0xactivated"},reader,state)
	if err != nil { t.Fatal(err) }
	if err := p.Apply(ctx,ChainLog{Address:"0xagreement",Topics:[]string{"0xactivated","0xaaa",a.CommitmentID,a.NodeID},BlockHash:"0x1"}); err != nil { t.Fatal(err) }
	store, err := OpenFileStore(t.TempDir())
	if err != nil { t.Fatal(err) }
	sub := &fakeSubmitter{}
	r, err := NewRuntime("node-1",1024,store,p,sub)
	if err != nil { t.Fatal(err) }
	if _, err := r.StoreShard(ctx,a.CommitmentID,bytes.NewReader(data)); err != nil { t.Fatal(err) }
	s := &Service{cfg:ServiceConfig{ProofSubmitter:sub},projection:p,runtime:r,scheduler:ProofScheduler{Projection:p}}
	if err := s.proveOnce(ctx,now); err != nil { t.Fatal(err) }
	if len(sub.proofs)!=1 { t.Fatalf("proofs=%d",len(sub.proofs)) }
	p.mu.RLock(); next:=p.snapshots["0xaaa"].NextWindow; p.mu.RUnlock()
	if next!=1 { t.Fatalf("next=%d",next) }
}
