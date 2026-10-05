package worker

import (
	"bytes"
	"context"
	"errors"
	"io"
	"os"
	"strings"
	"testing"
	"time"
)

type uploadTransportStub struct {
	requests []ResultEvidenceUploadRequest
	payloads [][]byte
	failAt   int
	badReceipt bool
}

func (s *uploadTransportStub) Upload(_ context.Context, req ResultEvidenceUploadRequest, r io.Reader) (ResultEvidenceUploadReceipt, error) {
	call := len(s.requests) + 1
	if s.failAt != 0 && call == s.failAt {
		return ResultEvidenceUploadReceipt{}, errors.New("transport unavailable")
	}
	body, err := io.ReadAll(r)
	if err != nil {
		return ResultEvidenceUploadReceipt{}, err
	}
	if uint64(len(body)) != req.Object.SizeBytes || sha256Hex(body) != req.Object.SHA256 {
		return ResultEvidenceUploadReceipt{}, errors.New("transport observed invalid object")
	}
	s.requests = append(s.requests, req)
	s.payloads = append(s.payloads, body)
	receipt := ResultEvidenceUploadReceipt{
		SchemaVersion: ResultEvidenceUploadRecordSchemaV1,
		IdempotencyKey: req.IdempotencyKey,
		Object: req.Object,
		TransportRef: "transport-" + req.IdempotencyKey[:8],
		RetrievalRef: "opaque://retrieval/" + req.IdempotencyKey[:8],
		Authoritative: false,
	}
	if s.badReceipt {
		receipt.Object.SHA256 = strings.Repeat("0", 64)
	}
	return receipt, nil
}

func evidenceRequirementsFixture(now time.Time, payloads [][]byte) []EvidenceRequirement {
	out := make([]EvidenceRequirement, len(payloads))
	for i, payload := range payloads {
		out[i] = EvidenceRequirement{
			Ordinal: uint32(i),
			Kind: []string{"execution-log-proof", "metering-attestation"}[i%2],
			SHA256: sha256Hex(payload),
			SizeBytes: uint64(len(payload)),
			Encrypted: i%2 == 0,
			AccessPolicyID: testBytes32("6"),
			RetentionUntil: now.Add(24 * time.Hour),
			ProvenanceCommitment: testBytes32("7"),
		}
	}
	return out
}

func uploadFixture(t *testing.T, payloads [][]byte) (*ResultEvidenceUploader, *uploadTransportStub, ResultMaterial, *ReceiptAuthorization, *ResultEvidenceUploadAuthorization) {
	t.Helper()
	receiptStore, result, _, receiptAuth := signedReceiptFixture(t)
	now := time.Now().UTC()
	reqs := evidenceRequirementsFixture(now, payloads)
	root, err := evidenceRoot(reqs)
	if err != nil {
		t.Fatal(err)
	}
	receiptAuth.EvidenceRoot = root
	if _, err := receiptStore.Sign(context.Background(), result.AuthorizationRef); err != nil {
		t.Fatal(err)
	}
	uploadAuth := ResultEvidenceUploadAuthorization{
		SchemaVersion: ResultEvidenceUploadAuthorizationSchemaV1,
		AuthorizationRef: result.AuthorizationRef,
		UploadPolicyID: testBytes32("5"),
		EvidenceRoot: root,
		MaxObjectBytes: 1 << 20,
		MaxTotalBytes: 4 << 20,
		Evidence: reqs,
	}
	authority := CanonicalResultEvidenceUploadAuthorityFunc(func(_ context.Context, ref string) (ResultEvidenceUploadAuthorization, error) {
		if ref != result.AuthorizationRef {
			return ResultEvidenceUploadAuthorization{}, errors.New("unknown upload authorization")
		}
		return uploadAuth, nil
	})
	transport := &uploadTransportStub{}
	uploader, err := NewResultEvidenceUploader(receiptStore.config, receiptStore.results, receiptStore, authority, transport)
	if err != nil {
		t.Fatal(err)
	}
	return uploader, transport, result, receiptAuth, &uploadAuth
}

func evidenceSources(payloads [][]byte) []EvidenceSource {
	out := make([]EvidenceSource, len(payloads))
	for i, payload := range payloads {
		out[i] = EvidenceSource{Ordinal: uint32(i), Reader: bytes.NewReader(payload)}
	}
	return out
}

func TestEvidenceRootIsOrderedDomainSeparatedAndStable(t *testing.T) {
	now := time.Unix(1700000000, 0).UTC()
	reqs := evidenceRequirementsFixture(now, [][]byte{[]byte("proof-a"), []byte("proof-b")})
	reqs[0].RetentionUntil = time.Unix(1700086400, 0).UTC()
	reqs[1].RetentionUntil = time.Unix(1700086400, 0).UTC()
	root, err := evidenceRoot(reqs)
	if err != nil {
		t.Fatal(err)
	}
	if root != "0xbf901f40e484816156836c5ca0d812b15d45235c922ad81b6d67e34964630599" {
		t.Fatalf("evidence root=%s", root)
	}
	swapped := append([]EvidenceRequirement(nil), reqs...)
	swapped[0], swapped[1] = swapped[1], swapped[0]
	swapped[0].Ordinal = 0
	swapped[1].Ordinal = 1
	other, err := evidenceRoot(swapped)
	if err != nil {
		t.Fatal(err)
	}
	if other == root {
		t.Fatal("ordered evidence set did not change root")
	}
}

func TestResultEvidenceUploadUploadsResultReceiptManifestAndEvidence(t *testing.T) {
	payloads := [][]byte{[]byte("encrypted proof bytes"), []byte("metering attestation")}
	uploader, transport, result, _, auth := uploadFixture(t, payloads)
	record, err := uploader.Upload(context.Background(), result.AuthorizationRef, evidenceSources(payloads))
	if err != nil {
		t.Fatal(err)
	}
	if record.SchemaVersion != ResultEvidenceUploadRecordSchemaV1 ||
		record.ResultCommitment != result.ResultCommitment ||
		record.EvidenceRoot != auth.EvidenceRoot ||
		record.Authoritative || record.ResultCorrectnessEvidence || record.CanonicalResultCommitted {
		t.Fatalf("bad upload record: %+v", record)
	}
	if len(transport.requests) != 3+len(payloads) || len(record.Objects) != 3+len(payloads) {
		t.Fatalf("unexpected upload count requests=%d objects=%d", len(transport.requests), len(record.Objects))
	}
	kinds := []string{
		UploadObjectResultMaterial,
		UploadObjectSignedReceipt,
		UploadObjectEvidenceManifest,
		UploadObjectEvidence,
		UploadObjectEvidence,
	}
	for i, kind := range kinds {
		if transport.requests[i].Object.Kind != kind {
			t.Fatalf("object %d kind=%s", i, transport.requests[i].Object.Kind)
		}
		if transport.requests[i].IdempotencyKey == "" || transport.requests[i].AuthorizationRef != result.AuthorizationRef {
			t.Fatalf("upload request binding missing: %+v", transport.requests[i])
		}
	}
	if record.EvidenceManifestSHA256 != transport.requests[2].Object.SHA256 {
		t.Fatal("manifest digest not bound to upload record")
	}
}

func TestResultEvidenceUploadStagesAllEvidenceBeforeAnyTransport(t *testing.T) {
	payloads := [][]byte{[]byte("proof-a"), []byte("proof-b")}
	uploader, transport, result, _, _ := uploadFixture(t, payloads)
	bad := evidenceSources(payloads)
	bad[1].Reader = bytes.NewReader([]byte("wrong"))
	if _, err := uploader.Upload(context.Background(), result.AuthorizationRef, bad); !errors.Is(err, ErrUploadIntegrity) {
		t.Fatalf("expected integrity failure, got %v", err)
	}
	if len(transport.requests) != 0 {
		t.Fatalf("transport side effect occurred before complete evidence validation: %d", len(transport.requests))
	}
}

func TestResultEvidenceUploadRejectsCanonicalRootDriftBeforeTransport(t *testing.T) {
	payloads := [][]byte{[]byte("proof")}
	uploader, transport, result, receiptAuth, auth := uploadFixture(t, payloads)
	auth.Evidence[0].ProvenanceCommitment = testBytes32("8")
	// Preserve the receipt root so the changed accepted descriptor set must fail.
	_ = receiptAuth
	if _, err := uploader.Upload(context.Background(), result.AuthorizationRef, evidenceSources(payloads)); err == nil {
		t.Fatal("evidence-root drift accepted")
	}
	if len(transport.requests) != 0 {
		t.Fatal("transport called for invalid canonical evidence root")
	}
}

func TestResultEvidenceUploadRejectsTransportReceiptMismatch(t *testing.T) {
	payloads := [][]byte{[]byte("proof")}
	uploader, transport, result, _, _ := uploadFixture(t, payloads)
	transport.badReceipt = true
	if _, err := uploader.Upload(context.Background(), result.AuthorizationRef, evidenceSources(payloads)); !errors.Is(err, ErrUploadIntegrity) {
		t.Fatalf("bad transport receipt accepted: %v", err)
	}
	if _, err := os.Stat(uploader.recordPath(result.AttemptRef)); !errors.Is(err, os.ErrNotExist) {
		t.Fatal("failed upload created durable completion record")
	}
}

func TestResultEvidenceUploadIsIdempotentAfterDurableSuccess(t *testing.T) {
	payloads := [][]byte{[]byte("proof")}
	uploader, transport, result, _, _ := uploadFixture(t, payloads)
	first, err := uploader.Upload(context.Background(), result.AuthorizationRef, evidenceSources(payloads))
	if err != nil {
		t.Fatal(err)
	}
	calls := len(transport.requests)
	second, err := uploader.Upload(context.Background(), result.AuthorizationRef, nil)
	if err != nil {
		t.Fatal(err)
	}
	if first.EvidenceManifestSHA256 != second.EvidenceManifestSHA256 || len(transport.requests) != calls {
		t.Fatal("durable idempotent replay re-uploaded or changed record")
	}
}

func TestResultEvidenceUploadRetryUsesStableIdempotencyAfterTransportFailure(t *testing.T) {
	payloads := [][]byte{[]byte("proof")}
	uploader, transport, result, _, _ := uploadFixture(t, payloads)
	transport.failAt = 2
	if _, err := uploader.Upload(context.Background(), result.AuthorizationRef, evidenceSources(payloads)); err == nil {
		t.Fatal("expected transport failure")
	}
	if len(transport.requests) != 1 {
		t.Fatalf("unexpected successful request count after failure: %d", len(transport.requests))
	}
	firstKey := transport.requests[0].IdempotencyKey
	transport.failAt = 0
	if _, err := uploader.Upload(context.Background(), result.AuthorizationRef, evidenceSources(payloads)); err != nil {
		t.Fatal(err)
	}
	if len(transport.requests) < 2 || transport.requests[1].IdempotencyKey != firstKey {
		t.Fatal("retry did not preserve result object idempotency identity")
	}
}

func TestResultEvidenceUploadRecordIsPrivateAndDoesNotPersistEvidenceBytes(t *testing.T) {
	secret := []byte("private encrypted evidence body")
	uploader, _, result, _, _ := uploadFixture(t, [][]byte{secret})
	if _, err := uploader.Upload(context.Background(), result.AuthorizationRef, evidenceSources([][]byte{secret})); err != nil {
		t.Fatal(err)
	}
	path := uploader.recordPath(result.AttemptRef)
	info, err := os.Stat(path)
	if err != nil {
		t.Fatal(err)
	}
	if info.Mode().Perm() != 0o600 {
		t.Fatalf("upload record mode=%o", info.Mode().Perm())
	}
	raw, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	if bytes.Contains(raw, secret) || bytes.Contains(raw, []byte("sandbox-output-not-persisted")) {
		t.Fatal("upload record persisted raw evidence/output bytes")
	}
	entries, err := os.ReadDir(uploader.staging)
	if err != nil {
		t.Fatal(err)
	}
	if len(entries) != 0 {
		t.Fatalf("staging files retained after upload: %d", len(entries))
	}
}

func TestResultEvidenceUploadAuthorizationFailsClosed(t *testing.T) {
	now := time.Now().UTC()
	payload := []byte("proof")
	reqs := evidenceRequirementsFixture(now, [][]byte{payload})
	root, err := evidenceRoot(reqs)
	if err != nil {
		t.Fatal(err)
	}
	base := ResultEvidenceUploadAuthorization{
		SchemaVersion: ResultEvidenceUploadAuthorizationSchemaV1,
		AuthorizationRef: testBytes32("a"),
		UploadPolicyID: testBytes32("5"),
		EvidenceRoot: root,
		MaxObjectBytes: 1024,
		MaxTotalBytes: 2048,
		Evidence: reqs,
	}
	clone := func() ResultEvidenceUploadAuthorization {
		candidate := base
		candidate.Evidence = append([]EvidenceRequirement(nil), base.Evidence...)
		return candidate
	}
	cases := []ResultEvidenceUploadAuthorization{clone(), clone(), clone(), clone()}
	cases[0].UploadPolicyID = testBytes32("0")
	cases[1].Evidence[0].RetentionUntil = now.Add(-time.Second)
	cases[2].MaxObjectBytes = 0
	cases[3].Evidence[0].AccessPolicyID = testBytes32("0")
	for i, candidate := range cases {
		if err := ValidateResultEvidenceUploadAuthorization(candidate, now); err == nil {
			t.Fatalf("invalid authorization case %d accepted", i)
		}
	}
}

func TestResultEvidenceUploadCompleteByteLimitIncludesMetadata(t *testing.T) {
	payloads := [][]byte{[]byte("proof")}
	uploader, transport, result, _, auth := uploadFixture(t, payloads)
	auth.MaxTotalBytes = uint64(len(payloads[0])) + 1
	if _, err := uploader.Upload(context.Background(), result.AuthorizationRef, evidenceSources(payloads)); err == nil {
		t.Fatal("metadata escaped total-byte ceiling")
	}
	if len(transport.requests) != 0 {
		t.Fatal("transport called despite total-byte violation")
	}
}

func TestResultEvidenceUploadCancellationHasNoDurableCompletion(t *testing.T) {
	payloads := [][]byte{[]byte("proof")}
	uploader, transport, result, _, _ := uploadFixture(t, payloads)
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	if _, err := uploader.Upload(ctx, result.AuthorizationRef, evidenceSources(payloads)); !errors.Is(err, context.Canceled) {
		t.Fatalf("expected cancellation, got %v", err)
	}
	if len(transport.requests) != 0 {
		t.Fatal("cancelled upload reached transport")
	}
	if _, err := os.Stat(uploader.recordPath(result.AttemptRef)); !errors.Is(err, os.ErrNotExist) {
		t.Fatal("cancelled upload created completion record")
	}
}
