package worker

import (
	"bytes"
	"context"
	"errors"
	"io"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

func checkpointFixture(t *testing.T) (*CheckpointStore, ExecutionAuthorization) {
	t.Helper()
	cfg := lifecycleConfig(t)
	artifact := writeLifecycleArtifact(t, cfg, []byte("checkpoint-work-unit"))
	image := "sha256:" + strings.Repeat("8", 64)
	command := []string{"/worker"}
	auth := executionFixture(t, cfg, artifact, image, command)
	authority := CanonicalExecutionAuthorityFunc(func(_ context.Context, ref string) (ExecutionAuthorization, error) {
		if ref != auth.AuthorizationRef {
			return ExecutionAuthorization{}, errors.New("unknown")
		}
		return auth, nil
	})
	store, err := NewCheckpointStore(cfg, authority, 1<<20)
	if err != nil {
		t.Fatal(err)
	}
	return store, auth
}

func TestCheckpointStorePersistsContentAddressedPrivateState(t *testing.T) {
	store, auth := checkpointFixture(t)
	payload := []byte("checkpoint-state-v1")
	checkpoint, err := store.Save(context.Background(), auth.AuthorizationRef, 1, bytes.NewReader(payload))
	if err != nil {
		t.Fatal(err)
	}
	if checkpoint.Metadata.Sequence != 1 || checkpoint.Metadata.AttemptRef != auth.AttemptRef ||
		checkpoint.Metadata.AttemptNonce != auth.AttemptNonce || checkpoint.Metadata.WorkUnitSHA256 != auth.WorkUnitSHA256 {
		t.Fatalf("bad checkpoint metadata: %+v", checkpoint.Metadata)
	}
	if checkpoint.Metadata.PayloadSHA256 != digestBytes(payload) {
		t.Fatalf("payload digest=%q", checkpoint.Metadata.PayloadSHA256)
	}
	if len(checkpoint.Metadata.CheckpointCommitment) != 66 || !strings.HasPrefix(checkpoint.Metadata.CheckpointCommitment, "0x") {
		t.Fatalf("checkpoint commitment=%q", checkpoint.Metadata.CheckpointCommitment)
	}
	info, err := os.Stat(checkpoint.Path)
	if err != nil {
		t.Fatal(err)
	}
	if info.Mode().Perm() != 0o600 {
		t.Fatalf("checkpoint mode=%o", info.Mode().Perm())
	}
	loaded, err := store.LoadLatest(context.Background(), auth.AuthorizationRef)
	if err != nil {
		t.Fatal(err)
	}
	if loaded.Metadata.PayloadSHA256 != checkpoint.Metadata.PayloadSHA256 {
		t.Fatal("loaded checkpoint commitment changed")
	}
}

func TestCheckpointSequenceIsStrictlyMonotonic(t *testing.T) {
	store, auth := checkpointFixture(t)
	if _, err := store.Save(context.Background(), auth.AuthorizationRef, 2, bytes.NewReader([]byte("skip"))); err == nil {
		t.Fatal("first checkpoint skipped sequence one")
	}
	if _, err := store.Save(context.Background(), auth.AuthorizationRef, 1, bytes.NewReader([]byte("one"))); err != nil {
		t.Fatal(err)
	}
	if _, err := store.Save(context.Background(), auth.AuthorizationRef, 1, bytes.NewReader([]byte("replay"))); !errors.Is(err, ErrCheckpointReplay) {
		t.Fatalf("checkpoint replay accepted: %v", err)
	}
	if _, err := store.Save(context.Background(), auth.AuthorizationRef, 3, bytes.NewReader([]byte("skip-two"))); err == nil {
		t.Fatal("checkpoint sequence gap accepted")
	}
	if _, err := store.Save(context.Background(), auth.AuthorizationRef, 2, bytes.NewReader([]byte("two"))); err != nil {
		t.Fatal(err)
	}
}

func TestCheckpointStoreRejectsOversizeEmptyAndTamperedPayload(t *testing.T) {
	store, auth := checkpointFixture(t)
	store.maxBytes = 8
	if _, err := store.Save(context.Background(), auth.AuthorizationRef, 1, bytes.NewReader(nil)); err == nil {
		t.Fatal("empty checkpoint accepted")
	}
	if _, err := store.Save(context.Background(), auth.AuthorizationRef, 1, bytes.NewReader([]byte("123456789"))); err == nil {
		t.Fatal("oversize checkpoint accepted")
	}
	store.maxBytes = 1 << 20
	checkpoint, err := store.Save(context.Background(), auth.AuthorizationRef, 1, bytes.NewReader([]byte("valid-state")))
	if err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(checkpoint.Path, []byte("tampered-state"), 0o600); err != nil {
		t.Fatal(err)
	}
	if _, err := store.LoadLatest(context.Background(), auth.AuthorizationRef); err == nil {
		t.Fatal("tampered checkpoint accepted")
	}
}

func TestCheckpointStoreRejectsCrossAttemptOrExpiredAuthorization(t *testing.T) {
	cfg := lifecycleConfig(t)
	artifact := writeLifecycleArtifact(t, cfg, []byte("payload"))
	image := "sha256:" + strings.Repeat("8", 64)
	command := []string{"/worker"}
	auth := executionFixture(t, cfg, artifact, image, command)
	current := auth
	authority := CanonicalExecutionAuthorityFunc(func(context.Context, string) (ExecutionAuthorization, error) {
		return current, nil
	})
	store, err := NewCheckpointStore(cfg, authority, 1<<20)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := store.Save(context.Background(), auth.AuthorizationRef, 1, bytes.NewReader([]byte("state"))); err != nil {
		t.Fatal(err)
	}
	current.AttemptRef = testBytes32("f")
	if _, err := store.LoadLatest(context.Background(), auth.AuthorizationRef); !errors.Is(err, os.ErrNotExist) {
		t.Fatalf("cross-attempt checkpoint visible: %v", err)
	}
	current = auth
	current.LeaseExpiresAt = time.Now().Add(-time.Second)
	if _, err := store.LoadLatest(context.Background(), auth.AuthorizationRef); err == nil {
		t.Fatal("expired canonical authorization resumed")
	}
}

func TestCheckpointStoreRejectsSymlinkPayloadAndMetadata(t *testing.T) {
	store, auth := checkpointFixture(t)
	checkpoint, err := store.Save(context.Background(), auth.AuthorizationRef, 1, bytes.NewReader([]byte("state")))
	if err != nil {
		t.Fatal(err)
	}
	outside := filepath.Join(t.TempDir(), "outside")
	if err := os.WriteFile(outside, []byte("state"), 0o600); err != nil {
		t.Fatal(err)
	}
	if err := os.Remove(checkpoint.Path); err != nil {
		t.Fatal(err)
	}
	if err := os.Symlink(outside, checkpoint.Path); err != nil {
		t.Skipf("symlink unavailable: %v", err)
	}
	if _, err := store.LoadLatest(context.Background(), auth.AuthorizationRef); err == nil {
		t.Fatal("symlink checkpoint payload trusted")
	}
}

func TestResumeInputRoundTripAndBounds(t *testing.T) {
	work := []byte("work-unit")
	state := []byte("checkpoint")
	reader, err := NewResumeInput(bytes.NewReader(work), uint64(len(work)), bytes.NewReader(state), uint64(len(state)))
	if err != nil {
		t.Fatal(err)
	}
	gotWork, gotState, err := ParseResumeInput(reader, 1024, 1024)
	if err != nil {
		t.Fatal(err)
	}
	if !bytes.Equal(gotWork, work) || !bytes.Equal(gotState, state) {
		t.Fatal("resume input framing changed content")
	}

	reader, _ = NewResumeInput(bytes.NewReader(work), uint64(len(work)), bytes.NewReader(state), uint64(len(state)))
	if _, _, err := ParseResumeInput(reader, 1, 1024); err == nil {
		t.Fatal("oversize work-unit framing accepted")
	}
}

func TestOpenVerifiedCheckpointReturnsExactBytes(t *testing.T) {
	store, auth := checkpointFixture(t)
	payload := []byte("resume-state")
	checkpoint, err := store.Save(context.Background(), auth.AuthorizationRef, 1, bytes.NewReader(payload))
	if err != nil {
		t.Fatal(err)
	}
	file, err := store.OpenVerified(checkpoint)
	if err != nil {
		t.Fatal(err)
	}
	defer file.Close()
	got, err := io.ReadAll(file)
	if err != nil {
		t.Fatal(err)
	}
	if !bytes.Equal(got, payload) {
		t.Fatal("checkpoint bytes changed")
	}
}
