package worker

import (
	"context"
	"encoding/hex"
	"errors"
	"math/big"
	"os"
	"strings"
	"testing"
)

func receiptKeyOne(t *testing.T) *Secp256k1ExecutionKey {
	t.Helper()
	raw := make([]byte, 32)
	raw[31] = 1
	key, err := NewSecp256k1ExecutionKey(raw)
	if err != nil {
		t.Fatal(err)
	}
	return key
}

func receiptAuthorizationFixture(result ResultMaterial, signer string) ReceiptAuthorization {
	return ReceiptAuthorization{
		SchemaVersion: ReceiptAuthorizationSchemaV1,
		AuthorizationRef: result.AuthorizationRef,
		RequestID: testBytes32("8"),
		MatchID: testBytes32("9"),
		VerifyingRegistry: "0x" + strings.Repeat("1", 40),
		WorkerSigner: signer,
		SignerGrantID: testBytes32("a"),
		PartitionPlanHash: testBytes32("6"),
		PartitionIndex: 2,
		ReplicaIndex: 3,
		MeteringProfileID: testBytes32("7"),
		MeteringProfileVersion: 4,
		MeasuredUnits: "42",
		MeasurementCommitment: testBytes32("8"),
		InputSliceCommitment: testBytes32("9"),
		OutputCommitment: result.OutputHash,
		OutputSourceSHA256: result.OutputSHA256,
		EvidenceRoot: testBytes32("e"),
		ResultCode: testBytes32("f"),
		ResultAdapter: "0x" + strings.Repeat("2", 40),
		SnapshotCommitment: testBytes32("9"),
		WorkerRevision: 7,
	}
}

func signedReceiptFixture(t *testing.T) (*ReceiptStore, ResultMaterial, *Secp256k1ExecutionKey, *ReceiptAuthorization) {
	t.Helper()
	runner := &inputCapturingRunner{}
	lifecycle, results, plan, _ := resultFixture(t, runner)
	outcome, err := lifecycle.Execute(context.Background(), plan)
	if err != nil {
		t.Fatal(err)
	}
	result, err := results.Commit(context.Background(), outcome)
	if err != nil {
		t.Fatal(err)
	}
	key := receiptKeyOne(t)
	current := receiptAuthorizationFixture(result, key.Address())
	authority := CanonicalReceiptAuthorityFunc(func(_ context.Context, ref string) (ReceiptAuthorization, error) {
		if ref != result.AuthorizationRef {
			return ReceiptAuthorization{}, errors.New("unknown receipt authorization")
		}
		return current, nil
	})
	store, err := NewReceiptStore(lifecycle.config, results, authority, key)
	if err != nil {
		t.Fatal(err)
	}
	return store, result, key, &current
}

func TestEthereumPrimitivesKnownVectors(t *testing.T) {
	empty := keccak256(nil)
	if got := hex.EncodeToString(empty[:]); got != "c5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470" {
		t.Fatalf("keccak-256 empty=%s", got)
	}
	key := receiptKeyOne(t)
	if key.Address() != "0x7e5f4552091a69125d5dfcb7b8c2659029395bdf" {
		t.Fatalf("private-key-1 address=%s", key.Address())
	}
	digest := keccak256([]byte("cmp-3.9-signature-vector"))
	sig, err := key.SignDigest(digest)
	if err != nil {
		t.Fatal(err)
	}
	if len(sig) != 65 || (sig[64] != 27 && sig[64] != 28) {
		t.Fatalf("bad ethereum signature: %x", sig)
	}
	if newBigFromBytes(sig[32:64]).Cmp(secp256k1HalfN) > 0 {
		t.Fatal("signature not canonical low-s")
	}
	if !key.VerifyDigest(digest, sig) {
		t.Fatal("self-verification failed")
	}
	other := digest
	other[0] ^= 1
	if key.VerifyDigest(other, sig) {
		t.Fatal("signature verified for different digest")
	}
}

func TestReceiptV1PinnedABIEIP712AndSignatureVector(t *testing.T) {
	receipt := ReceiptV1{
		ReceiptSchemaVersion: 1,
		ChainID: 420,
		VerifyingRegistry: "0x" + strings.Repeat("1", 40),
		JobID: testBytes32("b"),
		RequestID: testBytes32("8"),
		MatchID: testBytes32("9"),
		UnitID: testBytes32("c"),
		AttemptID: testBytes32("e"),
		ProviderID: testBytes32("1"),
		NodeID: testBytes32("2"),
		ResourceID: testBytes32("3"),
		WorkerSigner: "0x7e5f4552091a69125d5dfcb7b8c2659029395bdf",
		SignerGrantID: testBytes32("a"),
		ManifestHash: testBytes32("5"),
		PartitionPlanHash: testBytes32("6"),
		PartitionIndex: 2,
		ReplicaIndex: 3,
		AttemptNonce: 1,
		ExecutionStartedAt: 1700000000,
		ExecutionEndedAt: 1700000123,
		MeteringProfileID: testBytes32("7"),
		MeteringProfileVersion: 4,
		MeasuredUnits: "42",
		MeasurementCommitment: testBytes32("8"),
		InputSliceCommitment: testBytes32("9"),
		OutputCommitment: testBytes32("d"),
		EvidenceRoot: testBytes32("e"),
		ResultCode: testBytes32("f"),
		ReceiptNonce: 1,
	}
	words, err := receiptABIWords(receipt)
	if err != nil {
		t.Fatal(err)
	}
	if len(words) != 29 {
		t.Fatalf("ABI word count=%d", len(words))
	}
	receiptHash, structHash, domainSeparator, digest, err := receiptDigests(receipt)
	if err != nil {
		t.Fatal(err)
	}
	if hex32(receiptHash) != "0x3462fa3dc5c82d7974ffe95e535314d5661aa9b03a1e2b3e65d0b99f8f69c4ac" {
		t.Fatalf("receipt hash=%s", hex32(receiptHash))
	}
	if hex32(structHash) != "0x5f6f06631f2c74b4aecc13dffd923cbbd8a75ae1c1ae5da1bd57fa07d938c3ae" {
		t.Fatalf("struct hash=%s", hex32(structHash))
	}
	if hex32(domainSeparator) != "0x363e7a10ea9b0cbf244fed3b76a3cd3baeaadb0d3a105fe973592e06951cb624" {
		t.Fatalf("domain separator=%s", hex32(domainSeparator))
	}
	if hex32(digest) != "0x98be775ebe6ab11d88a18bd7f1454be7b61786909caec45e2e0751c894c7a79c" {
		t.Fatalf("signing digest=%s", hex32(digest))
	}
	key := receiptKeyOne(t)
	sig, err := key.SignDigest(digest)
	if err != nil {
		t.Fatal(err)
	}
	if "0x"+hex.EncodeToString(sig) != "0x3558519636a779174dad39912e26b1464a5e2bdab1bab5a084afe930b73cfbf7249a059c52d06e4f0e4a355479e704b37c476973ce245a8d3e23c2856bd3a3171c" {
		t.Fatalf("receipt signature=%x", sig)
	}
	contractDigest, err := contractResultDigest(
		420, "0x"+strings.Repeat("2", 40), receipt.JobID, receipt.RequestID,
		receipt.ManifestHash, receipt.AttemptID, testBytes32("9"), testBytes32("4"),
		7, 1, hex32(receiptHash), receipt.OutputCommitment,
	)
	if err != nil {
		t.Fatal(err)
	}
	if hex32(contractDigest) != "0xbf2f31026a9d7151263915c68efb47078e96f83c22d405cd41be9ed6d40673d0" {
		t.Fatalf("contract result digest=%s", hex32(contractDigest))
	}
	contractSig, err := key.SignDigest(contractDigest)
	if err != nil {
		t.Fatal(err)
	}
	if "0x"+hex.EncodeToString(contractSig) != "0xf7c7a19efffb933bc91d8acfe4ad0b7fd34566553630dcd54451e7568d2b463c3c8e46bda8cdc62c8f7aa1058bc44ab5b74f5012a49e25cc409b5ab615ee07fb1b" {
		t.Fatalf("contract signature=%x", contractSig)
	}
}

func TestSignedReceiptBindsCanonicalResultAndExecutionKey(t *testing.T) {
	store, result, key, _ := signedReceiptFixture(t)
	signed, err := store.Sign(context.Background(), result.AuthorizationRef)
	if err != nil {
		t.Fatal(err)
	}
	if !signed.Signed || signed.Authoritative || signed.ResultCorrectnessEvidence || signed.CanonicalResultCommitted {
		t.Fatalf("receipt authority boundary violated: %+v", signed)
	}
	if signed.SignerAddress != key.Address() || signed.Receipt.WorkerSigner != key.Address() {
		t.Fatal("receipt not bound to execution signer")
	}
	if signed.Receipt.JobID != result.JobID ||
		signed.Receipt.UnitID != result.UnitID ||
		signed.Receipt.AttemptID != result.AttemptRef ||
		signed.Receipt.AttemptNonce != result.AttemptNonce ||
		signed.ResultMaterialCommitment != result.ResultCommitment ||
		signed.OutputSourceSHA256 != result.OutputSHA256 {
		t.Fatal("receipt/result binding drift")
	}
	if _, err := decodeSignature(signed.Signature); err != nil {
		t.Fatal(err)
	}
	if _, err := decodeSignature(signed.ContractResultSignature); err != nil {
		t.Fatal(err)
	}
	loaded, err := store.Load(context.Background(), result.AuthorizationRef)
	if err != nil {
		t.Fatal(err)
	}
	if loaded.ReceiptHash != signed.ReceiptHash {
		t.Fatal("persisted signed receipt changed")
	}
}

func TestSignedReceiptIsIdempotentAndConflictsFailClosed(t *testing.T) {
	store, result, _, auth := signedReceiptFixture(t)
	first, err := store.Sign(context.Background(), result.AuthorizationRef)
	if err != nil {
		t.Fatal(err)
	}
	second, err := store.Sign(context.Background(), result.AuthorizationRef)
	if err != nil {
		t.Fatal(err)
	}
	if first.ReceiptHash != second.ReceiptHash || first.Signature != second.Signature {
		t.Fatal("identical receipt was not idempotent")
	}
	auth.EvidenceRoot = testBytes32("d")
	if _, err := store.Sign(context.Background(), result.AuthorizationRef); !errors.Is(err, ErrConflictingReceipt) {
		t.Fatalf("conflicting second receipt not rejected: %v", err)
	}
}

func TestSignedReceiptRejectsWrongSignerAndOutputSourceDrift(t *testing.T) {
	store, result, _, auth := signedReceiptFixture(t)
	wrongRaw := make([]byte, 32)
	wrongRaw[31] = 2
	wrongKey, err := NewSecp256k1ExecutionKey(wrongRaw)
	if err != nil {
		t.Fatal(err)
	}
	badStore, err := NewReceiptStore(store.config, store.results, store.authority, wrongKey)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := badStore.Sign(context.Background(), result.AuthorizationRef); err == nil {
		t.Fatal("wrong execution key signed canonical receipt")
	}
	auth.OutputSourceSHA256 = digestBytes([]byte("different-source"))
	if _, err := store.Sign(context.Background(), result.AuthorizationRef); err == nil {
		t.Fatal("output source drift accepted")
	}
}

func TestSignedReceiptAllowsProfileDefinedOutputCommitment(t *testing.T) {
	store, result, _, auth := signedReceiptFixture(t)
	if auth.OutputCommitment != result.OutputHash {
		t.Fatal("fixture assumption changed")
	}
	auth.OutputCommitment = testBytes32("d")
	signed, err := store.Sign(context.Background(), result.AuthorizationRef)
	if err != nil {
		t.Fatal(err)
	}
	if signed.Receipt.OutputCommitment != testBytes32("d") ||
		signed.OutputSourceSHA256 != result.OutputSHA256 {
		t.Fatal("profile-defined output commitment not bound to source result")
	}
}

func TestSignedReceiptTamperingAndCrossContextFailVerification(t *testing.T) {
	store, result, key, auth := signedReceiptFixture(t)
	signed, err := store.Sign(context.Background(), result.AuthorizationRef)
	if err != nil {
		t.Fatal(err)
	}
	tampered := signed
	tampered.Receipt.EvidenceRoot = testBytes32("d")
	if err := VerifySignedReceipt(result, *auth, tampered, key); err == nil {
		t.Fatal("tampered receipt verified")
	}
	crossChain := signed.Receipt
	crossChain.ChainID++
	_, _, _, changed, err := receiptDigests(crossChain)
	if err != nil {
		t.Fatal(err)
	}
	if hex32(changed) == signed.SigningDigest {
		t.Fatal("cross-chain receipt digest replayable")
	}
	crossRegistry := signed.Receipt
	crossRegistry.VerifyingRegistry = "0x" + strings.Repeat("3", 40)
	_, _, _, changed, err = receiptDigests(crossRegistry)
	if err != nil {
		t.Fatal(err)
	}
	if hex32(changed) == signed.SigningDigest {
		t.Fatal("cross-registry receipt digest replayable")
	}
}

func TestSignedReceiptPrivatePersistenceContainsNoKeyOrRawOutput(t *testing.T) {
	store, result, _, _ := signedReceiptFixture(t)
	signed, err := store.Sign(context.Background(), result.AuthorizationRef)
	if err != nil {
		t.Fatal(err)
	}
	path := store.path(result.AttemptRef)
	info, err := os.Stat(path)
	if err != nil {
		t.Fatal(err)
	}
	if info.Mode().Perm() != 0o600 {
		t.Fatalf("receipt mode=%o", info.Mode().Perm())
	}
	raw, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	if strings.Contains(string(raw), "sandbox-output-not-persisted") ||
		strings.Contains(string(raw), "result-work-unit") ||
		strings.Contains(string(raw), strings.Repeat("00", 31)+"01") {
		t.Fatal("receipt persistence leaked raw output/input/private key")
	}
	if !strings.Contains(string(raw), strings.TrimPrefix(signed.ReceiptHash, "0x")) {
		t.Fatal("receipt commitment not persisted")
	}
}

func TestReceiptAuthorizationRejectsZeroCriticalBindingsAndUint256Overflow(t *testing.T) {
	_, result, key, auth := signedReceiptFixture(t)
	_ = result
	cases := []ReceiptAuthorization{*auth, *auth}
	cases[0].SignerGrantID = testBytes32("0")
	cases[1].MeasuredUnits = "1" + strings.Repeat("0", 78)
	for _, candidate := range cases {
		if err := ValidateReceiptAuthorization(candidate); err == nil {
			t.Fatal("invalid receipt authorization accepted")
		}
	}
	_ = key
}

func newBigFromBytes(b []byte) *big.Int {
	return new(big.Int).SetBytes(b)
}
