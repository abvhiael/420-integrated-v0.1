package worker

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"math/big"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"sync"
	"time"
)

const (
	ResultEvidenceUploadAuthorizationSchemaV1 = "420-compute-worker-result-evidence-upload-authorization-v1"
	EvidenceManifestSchemaV1                  = "420-compute-worker-evidence-manifest-v1"
	ResultEvidenceUploadRecordSchemaV1        = "420-compute-worker-result-evidence-upload-record-v1"
	EvidenceRootDomainV1                      = "420/COMPUTE/EVIDENCE_SET/V1"
	UploadIdempotencyDomainV1                 = "420/COMPUTE/RESULT_EVIDENCE_UPLOAD/V1"

	UploadObjectResultMaterial   = "result-material"
	UploadObjectSignedReceipt    = "signed-receipt"
	UploadObjectEvidenceManifest = "evidence-manifest"
	UploadObjectEvidence         = "evidence"
)

var (
	ErrInvalidResultEvidenceUpload = errors.New("invalid compute worker result/evidence upload")
	ErrUploadIntegrity              = errors.New("compute worker upload integrity failure")
	ErrUploadConflict               = errors.New("conflicting compute worker result/evidence upload")
)

type EvidenceRequirement struct {
	Ordinal              uint32
	Kind                 string
	SHA256               string
	SizeBytes            uint64
	Encrypted            bool
	AccessPolicyID       string
	RetentionUntil       time.Time
	ProvenanceCommitment string
}

type ResultEvidenceUploadAuthorization struct {
	SchemaVersion    string
	AuthorizationRef string
	UploadPolicyID   string
	EvidenceRoot     string
	MaxObjectBytes   uint64
	MaxTotalBytes    uint64
	Evidence         []EvidenceRequirement
}

type CanonicalResultEvidenceUploadAuthority interface {
	ResolveResultEvidenceUploadAuthorization(context.Context, string) (ResultEvidenceUploadAuthorization, error)
}

type CanonicalResultEvidenceUploadAuthorityFunc func(context.Context, string) (ResultEvidenceUploadAuthorization, error)

func (f CanonicalResultEvidenceUploadAuthorityFunc) ResolveResultEvidenceUploadAuthorization(ctx context.Context, ref string) (ResultEvidenceUploadAuthorization, error) {
	return f(ctx, ref)
}

type EvidenceSource struct {
	Ordinal uint32
	Reader  io.Reader
}

type UploadObjectDescriptor struct {
	Kind                 string
	Ordinal              uint32
	ObjectID             string
	SHA256               string
	SizeBytes            uint64
	ContentType          string
	Encrypted            bool
	AccessPolicyID       string
	RetentionUntil       time.Time
	ProvenanceCommitment string
}

type ResultEvidenceUploadRequest struct {
	SchemaVersion  string
	IdempotencyKey string
	AuthorizationRef string
	ChainID        uint64
	JobID          string
	UnitID         string
	AttemptID      string
	ReceiptNonce   uint64
	UploadPolicyID string
	Object         UploadObjectDescriptor
}

type ResultEvidenceUploadReceipt struct {
	SchemaVersion  string
	IdempotencyKey string
	Object         UploadObjectDescriptor
	TransportRef   string
	RetrievalRef   string
	Authoritative  bool
}

type ResultEvidenceTransport interface {
	Upload(context.Context, ResultEvidenceUploadRequest, io.Reader) (ResultEvidenceUploadReceipt, error)
}

type EvidenceManifest struct {
	SchemaVersion    string
	AuthorizationRef string
	ChainID          uint64
	JobID            string
	UnitID           string
	AttemptID        string
	ReceiptNonce     uint64
	UploadPolicyID   string
	EvidenceRoot     string
	Evidence         []EvidenceRequirement
}

type ResultEvidenceUploadRecord struct {
	SchemaVersion             string
	AuthorizationRef          string
	ChainID                   uint64
	JobID                     string
	UnitID                    string
	AttemptID                 string
	ReceiptNonce              uint64
	UploadPolicyID            string
	EvidenceRoot              string
	ResultCommitment          string
	ReceiptHash               string
	EvidenceManifestSHA256     string
	Objects                   []ResultEvidenceUploadReceipt
	UploadedAt                time.Time
	Authoritative             bool
	ResultCorrectnessEvidence bool
	CanonicalResultCommitted  bool
}

type ResultEvidenceUploader struct {
	config    Config
	root      string
	staging   string
	results   *ResultStore
	receipts  *ReceiptStore
	authority CanonicalResultEvidenceUploadAuthority
	transport ResultEvidenceTransport
	bandwidth *ByteRateLimiter
	now       func() time.Time
	mu        sync.Mutex
}

func NewResultEvidenceUploader(
	config Config,
	results *ResultStore,
	receipts *ReceiptStore,
	authority CanonicalResultEvidenceUploadAuthority,
	transport ResultEvidenceTransport,
) (*ResultEvidenceUploader, error) {
	if results == nil || receipts == nil || authority == nil || transport == nil {
		return nil, fmt.Errorf("%w: result store, receipt store, authority and transport required", ErrInvalidResultEvidenceUpload)
	}
	stateRoot, err := config.PrepareStateDir()
	if err != nil {
		return nil, err
	}
	root := filepath.Join(stateRoot, "uploads")
	staging := filepath.Join(stateRoot, "upload-staging")
	for _, dir := range []string{root, staging} {
		if err := os.MkdirAll(dir, 0o700); err != nil {
			return nil, err
		}
		if err := os.Chmod(dir, 0o700); err != nil {
			return nil, err
		}
	}
	return &ResultEvidenceUploader{
		config: config, root: root, staging: staging,
		results: results, receipts: receipts,
		authority: authority, transport: transport, now: time.Now,
	}, nil
}

func NewResultEvidenceUploaderWithBandwidth(
	config Config,
	results *ResultStore,
	receipts *ReceiptStore,
	authority CanonicalResultEvidenceUploadAuthority,
	transport ResultEvidenceTransport,
	bandwidth *ByteRateLimiter,
) (*ResultEvidenceUploader, error) {
	uploader, err := NewResultEvidenceUploader(config, results, receipts, authority, transport)
	if err != nil {
		return nil, err
	}
	uploader.bandwidth = bandwidth
	return uploader, nil
}

func ValidateResultEvidenceUploadAuthorization(auth ResultEvidenceUploadAuthorization, now time.Time) error {
	if auth.SchemaVersion != ResultEvidenceUploadAuthorizationSchemaV1 {
		return fmt.Errorf("%w: unsupported authorization schema", ErrInvalidResultEvidenceUpload)
	}
	if err := validateBytes32("authorization ref", auth.AuthorizationRef); err != nil {
		return fmt.Errorf("%w: %v", ErrInvalidResultEvidenceUpload, err)
	}
	for name, value := range map[string]string{
		"upload policy id": auth.UploadPolicyID,
		"evidence root": auth.EvidenceRoot,
	} {
		if err := validateBytes32(name, value); err != nil || isZeroBytes32(value) {
			return fmt.Errorf("%w: invalid %s", ErrInvalidResultEvidenceUpload, name)
		}
	}
	if auth.MaxObjectBytes == 0 || auth.MaxTotalBytes == 0 || auth.MaxObjectBytes > auth.MaxTotalBytes {
		return fmt.Errorf("%w: invalid upload byte limits", ErrInvalidResultEvidenceUpload)
	}
	if len(auth.Evidence) == 0 {
		return fmt.Errorf("%w: accepted evidence set must not be empty", ErrInvalidResultEvidenceUpload)
	}
	seen := make(map[uint32]struct{}, len(auth.Evidence))
	var total uint64
	for i, req := range auth.Evidence {
		if req.Ordinal != uint32(i) {
			return fmt.Errorf("%w: evidence ordinals must be contiguous and ordered", ErrInvalidResultEvidenceUpload)
		}
		if _, ok := seen[req.Ordinal]; ok {
			return fmt.Errorf("%w: duplicate evidence ordinal", ErrInvalidResultEvidenceUpload)
		}
		seen[req.Ordinal] = struct{}{}
		if strings.TrimSpace(req.Kind) == "" || len(req.Kind) > 128 {
			return fmt.Errorf("%w: invalid evidence kind", ErrInvalidResultEvidenceUpload)
		}
		if !sha256HexPattern.MatchString(req.SHA256) || req.SizeBytes == 0 || req.SizeBytes > auth.MaxObjectBytes {
			return fmt.Errorf("%w: invalid evidence digest/size", ErrInvalidResultEvidenceUpload)
		}
		if err := validateBytes32("evidence access policy id", req.AccessPolicyID); err != nil || isZeroBytes32(req.AccessPolicyID) {
			return fmt.Errorf("%w: invalid evidence access policy", ErrInvalidResultEvidenceUpload)
		}
		if err := validateBytes32("evidence provenance commitment", req.ProvenanceCommitment); err != nil || isZeroBytes32(req.ProvenanceCommitment) {
			return fmt.Errorf("%w: invalid evidence provenance", ErrInvalidResultEvidenceUpload)
		}
		if req.RetentionUntil.IsZero() || !req.RetentionUntil.After(now) {
			return fmt.Errorf("%w: evidence retention already expired", ErrInvalidResultEvidenceUpload)
		}
		if total > auth.MaxTotalBytes-req.SizeBytes {
			return fmt.Errorf("%w: evidence byte total overflow", ErrInvalidResultEvidenceUpload)
		}
		total += req.SizeBytes
	}
	root, err := evidenceRoot(auth.Evidence)
	if err != nil {
		return err
	}
	if root != strings.ToLower(auth.EvidenceRoot) {
		return fmt.Errorf("%w: canonical evidence root mismatch", ErrInvalidResultEvidenceUpload)
	}
	return nil
}

func evidenceRoot(requirements []EvidenceRequirement) (string, error) {
	if len(requirements) == 0 {
		return "", fmt.Errorf("%w: empty evidence set", ErrInvalidResultEvidenceUpload)
	}
	domain := keccak256([]byte(EvidenceRootDomainV1))
	parts := make([][32]byte, 0, len(requirements)+2)
	parts = append(parts, domain, uintWord(new(big.Int).SetUint64(uint64(len(requirements)))))
	for i, req := range requirements {
		if req.Ordinal != uint32(i) {
			return "", fmt.Errorf("%w: evidence order drift", ErrInvalidResultEvidenceUpload)
		}
		digestBytes, err := hex.DecodeString(req.SHA256)
		if err != nil || len(digestBytes) != 32 {
			return "", fmt.Errorf("%w: invalid evidence SHA-256", ErrInvalidResultEvidenceUpload)
		}
		var digestWord [32]byte
		copy(digestWord[:], digestBytes)
		access, err := bytes32Word(req.AccessPolicyID)
		if err != nil {
			return "", err
		}
		prov, err := bytes32Word(req.ProvenanceCommitment)
		if err != nil {
			return "", err
		}
		kindHash := keccak256([]byte(req.Kind))
		boolWord := uintWord(big.NewInt(0))
		if req.Encrypted {
			boolWord = uintWord(big.NewInt(1))
		}
		itemPayload := make([]byte, 0, 32*9)
		for _, word := range [][32]byte{
			uintWord(new(big.Int).SetUint64(uint64(req.Ordinal))),
			kindHash,
			digestWord,
			uintWord(new(big.Int).SetUint64(req.SizeBytes)),
			boolWord,
			access,
			uintWord(new(big.Int).SetUint64(uint64(req.RetentionUntil.UTC().Unix()))),
			prov,
		} {
			itemPayload = append(itemPayload, word[:]...)
		}
		parts = append(parts, keccak256(itemPayload))
	}
	payload := make([]byte, 0, 32*len(parts))
	for _, part := range parts {
		payload = append(payload, part[:]...)
	}
	return hex32(keccak256(payload)), nil
}

func (u *ResultEvidenceUploader) Upload(ctx context.Context, authorizationRef string, sources []EvidenceSource) (ResultEvidenceUploadRecord, error) {
	if u == nil || u.results == nil || u.receipts == nil || u.authority == nil || u.transport == nil {
		return ResultEvidenceUploadRecord{}, ErrInvalidResultEvidenceUpload
	}
	if err := validateBytes32("authorization ref", authorizationRef); err != nil {
		return ResultEvidenceUploadRecord{}, fmt.Errorf("%w: %v", ErrInvalidResultEvidenceUpload, err)
	}

	result, err := u.results.Load(ctx, authorizationRef)
	if err != nil {
		return ResultEvidenceUploadRecord{}, fmt.Errorf("%w: load result: %v", ErrInvalidResultEvidenceUpload, err)
	}
	signed, err := u.receipts.Load(ctx, authorizationRef)
	if err != nil {
		return ResultEvidenceUploadRecord{}, fmt.Errorf("%w: load signed receipt: %v", ErrInvalidResultEvidenceUpload, err)
	}
	auth, err := u.authority.ResolveResultEvidenceUploadAuthorization(ctx, authorizationRef)
	if err != nil {
		return ResultEvidenceUploadRecord{}, fmt.Errorf("%w: resolve upload authorization: %v", ErrInvalidResultEvidenceUpload, err)
	}
	now := u.now().UTC()
	if err := ValidateResultEvidenceUploadAuthorization(auth, now); err != nil {
		return ResultEvidenceUploadRecord{}, err
	}
	if auth.AuthorizationRef != authorizationRef ||
		auth.EvidenceRoot != signed.Receipt.EvidenceRoot ||
		result.AuthorizationRef != authorizationRef ||
		result.JobID != signed.Receipt.JobID ||
		result.UnitID != signed.Receipt.UnitID ||
		result.AttemptRef != signed.Receipt.AttemptID ||
		result.AttemptNonce != signed.Receipt.AttemptNonce ||
		result.ResultCommitment != signed.ResultMaterialCommitment {
		return ResultEvidenceUploadRecord{}, fmt.Errorf("%w: result/receipt/upload authority binding mismatch", ErrInvalidResultEvidenceUpload)
	}

	u.mu.Lock()
	defer u.mu.Unlock()
	recordPath := u.recordPath(result.AttemptRef)
	if existing, err := u.read(recordPath); err == nil {
		if existing.AuthorizationRef == authorizationRef &&
			existing.ResultCommitment == result.ResultCommitment &&
			existing.ReceiptHash == signed.ReceiptHash &&
			existing.EvidenceRoot == auth.EvidenceRoot &&
			existing.UploadPolicyID == auth.UploadPolicyID {
			return existing, nil
		}
		return ResultEvidenceUploadRecord{}, ErrUploadConflict
	} else if !errors.Is(err, os.ErrNotExist) {
		return ResultEvidenceUploadRecord{}, err
	}

	sourceByOrdinal := make(map[uint32]io.Reader, len(sources))
	for _, source := range sources {
		if source.Reader == nil {
			return ResultEvidenceUploadRecord{}, fmt.Errorf("%w: nil evidence reader", ErrInvalidResultEvidenceUpload)
		}
		if _, exists := sourceByOrdinal[source.Ordinal]; exists {
			return ResultEvidenceUploadRecord{}, fmt.Errorf("%w: duplicate evidence source", ErrInvalidResultEvidenceUpload)
		}
		sourceByOrdinal[source.Ordinal] = source.Reader
	}
	if len(sourceByOrdinal) != len(auth.Evidence) {
		return ResultEvidenceUploadRecord{}, fmt.Errorf("%w: evidence source count mismatch", ErrInvalidResultEvidenceUpload)
	}

	resultBytes, err := json.Marshal(result)
	if err != nil {
		return ResultEvidenceUploadRecord{}, err
	}
	receiptBytes, err := json.Marshal(signed)
	if err != nil {
		return ResultEvidenceUploadRecord{}, err
	}
	manifest := EvidenceManifest{
		SchemaVersion: EvidenceManifestSchemaV1,
		AuthorizationRef: authorizationRef,
		ChainID: result.ChainID,
		JobID: result.JobID,
		UnitID: result.UnitID,
		AttemptID: result.AttemptRef,
		ReceiptNonce: signed.Receipt.ReceiptNonce,
		UploadPolicyID: auth.UploadPolicyID,
		EvidenceRoot: auth.EvidenceRoot,
		Evidence: append([]EvidenceRequirement(nil), auth.Evidence...),
	}
	manifestBytes, err := json.Marshal(manifest)
	if err != nil {
		return ResultEvidenceUploadRecord{}, err
	}
	manifestDigest := sha256Hex(manifestBytes)

	// Stage and verify every accepted evidence object before any transport side effect.
	staged := make(map[uint32]string, len(auth.Evidence))
	cleanupStaged := func() {
		for _, path := range staged {
			_ = os.Remove(path)
		}
	}
	defer cleanupStaged()
	for _, req := range auth.Evidence {
		path, err := u.stageEvidence(sourceByOrdinal[req.Ordinal], req)
		if err != nil {
			return ResultEvidenceUploadRecord{}, err
		}
		staged[req.Ordinal] = path
	}

	staticTotal := uint64(len(resultBytes)) + uint64(len(receiptBytes)) + uint64(len(manifestBytes))
	var evidenceTotal uint64
	for _, req := range auth.Evidence {
		if evidenceTotal > auth.MaxTotalBytes-req.SizeBytes {
			return ResultEvidenceUploadRecord{}, fmt.Errorf("%w: upload byte total overflow", ErrInvalidResultEvidenceUpload)
		}
		evidenceTotal += req.SizeBytes
	}
	if staticTotal > auth.MaxTotalBytes || evidenceTotal > auth.MaxTotalBytes-staticTotal {
		return ResultEvidenceUploadRecord{}, fmt.Errorf("%w: complete upload exceeds max total bytes", ErrInvalidResultEvidenceUpload)
	}

	var uploaded []ResultEvidenceUploadReceipt
	uploadStatic := func(kind string, ordinal uint32, payload []byte, contentType string) error {
		if uint64(len(payload)) > auth.MaxObjectBytes {
			return fmt.Errorf("%w: %s exceeds max object bytes", ErrInvalidResultEvidenceUpload, kind)
		}
		digest := sha256Hex(payload)
		desc := UploadObjectDescriptor{
			Kind: kind, Ordinal: ordinal,
			ObjectID: "sha256:" + digest,
			SHA256: digest, SizeBytes: uint64(len(payload)),
			ContentType: contentType,
		}
		receipt, err := u.uploadObject(ctx, auth, result, signed, desc, bytes.NewReader(payload))
		if err != nil {
			return err
		}
		uploaded = append(uploaded, receipt)
		return nil
	}
	if err := uploadStatic(UploadObjectResultMaterial, 0, resultBytes, "application/json"); err != nil {
		return ResultEvidenceUploadRecord{}, err
	}
	if err := uploadStatic(UploadObjectSignedReceipt, 0, receiptBytes, "application/json"); err != nil {
		return ResultEvidenceUploadRecord{}, err
	}
	if err := uploadStatic(UploadObjectEvidenceManifest, 0, manifestBytes, "application/json"); err != nil {
		return ResultEvidenceUploadRecord{}, err
	}

	for _, req := range auth.Evidence {
		file, err := os.Open(staged[req.Ordinal])
		if err != nil {
			return ResultEvidenceUploadRecord{}, err
		}
		desc := UploadObjectDescriptor{
			Kind: UploadObjectEvidence, Ordinal: req.Ordinal,
			ObjectID: "sha256:" + req.SHA256,
			SHA256: req.SHA256, SizeBytes: req.SizeBytes,
			ContentType: "application/octet-stream",
			Encrypted: req.Encrypted,
			AccessPolicyID: req.AccessPolicyID,
			RetentionUntil: req.RetentionUntil.UTC(),
			ProvenanceCommitment: req.ProvenanceCommitment,
		}
		receipt, uploadErr := u.uploadObject(ctx, auth, result, signed, desc, file)
		closeErr := file.Close()
		if uploadErr != nil {
			return ResultEvidenceUploadRecord{}, uploadErr
		}
		if closeErr != nil {
			return ResultEvidenceUploadRecord{}, closeErr
		}
		uploaded = append(uploaded, receipt)
	}

	record := ResultEvidenceUploadRecord{
		SchemaVersion: ResultEvidenceUploadRecordSchemaV1,
		AuthorizationRef: authorizationRef,
		ChainID: result.ChainID,
		JobID: result.JobID,
		UnitID: result.UnitID,
		AttemptID: result.AttemptRef,
		ReceiptNonce: signed.Receipt.ReceiptNonce,
		UploadPolicyID: auth.UploadPolicyID,
		EvidenceRoot: auth.EvidenceRoot,
		ResultCommitment: result.ResultCommitment,
		ReceiptHash: signed.ReceiptHash,
		EvidenceManifestSHA256: manifestDigest,
		Objects: uploaded,
		UploadedAt: now,
		Authoritative: false,
		ResultCorrectnessEvidence: false,
		CanonicalResultCommitted: false,
	}
	if err := u.persist(recordPath, record); err != nil {
		return ResultEvidenceUploadRecord{}, err
	}
	return record, nil
}

func (u *ResultEvidenceUploader) uploadObject(
	ctx context.Context,
	auth ResultEvidenceUploadAuthorization,
	result ResultMaterial,
	signed SignedReceipt,
	desc UploadObjectDescriptor,
	reader io.Reader,
) (ResultEvidenceUploadReceipt, error) {
	if err := ctx.Err(); err != nil {
		return ResultEvidenceUploadReceipt{}, err
	}
	request := ResultEvidenceUploadRequest{
		SchemaVersion: ResultEvidenceUploadRecordSchemaV1,
		IdempotencyKey: uploadIdempotencyKey(result, signed, auth.UploadPolicyID, desc),
		AuthorizationRef: result.AuthorizationRef,
		ChainID: result.ChainID,
		JobID: result.JobID,
		UnitID: result.UnitID,
		AttemptID: result.AttemptRef,
		ReceiptNonce: signed.Receipt.ReceiptNonce,
		UploadPolicyID: auth.UploadPolicyID,
		Object: desc,
	}
	if u.bandwidth != nil {
		reader = u.bandwidth.WrapReader(ctx, reader)
	}
	receipt, err := u.transport.Upload(ctx, request, reader)
	if err != nil {
		return ResultEvidenceUploadReceipt{}, err
	}
	if receipt.SchemaVersion != ResultEvidenceUploadRecordSchemaV1 ||
		receipt.IdempotencyKey != request.IdempotencyKey ||
		receipt.Object != desc ||
		receipt.Authoritative {
		return ResultEvidenceUploadReceipt{}, fmt.Errorf("%w: transport receipt mismatch", ErrUploadIntegrity)
	}
	return receipt, nil
}

func uploadIdempotencyKey(result ResultMaterial, signed SignedReceipt, policyID string, desc UploadObjectDescriptor) string {
	payload := strings.Join([]string{
		UploadIdempotencyDomainV1,
		fmt.Sprint(result.ChainID),
		result.JobID,
		result.UnitID,
		result.AttemptRef,
		fmt.Sprint(signed.Receipt.ReceiptNonce),
		policyID,
		desc.Kind,
		fmt.Sprint(desc.Ordinal),
		desc.SHA256,
	}, "\n")
	sum := sha256.Sum256([]byte(payload))
	return hex.EncodeToString(sum[:])
}

func (u *ResultEvidenceUploader) stageEvidence(reader io.Reader, req EvidenceRequirement) (string, error) {
	tmp, err := os.CreateTemp(u.staging, ".evidence-*")
	if err != nil {
		return "", err
	}
	name := tmp.Name()
	cleanup := func() {
		_ = tmp.Close()
		_ = os.Remove(name)
	}
	if err := tmp.Chmod(0o600); err != nil {
		cleanup()
		return "", err
	}
	hash := sha256.New()
	limit := int64(req.SizeBytes) + 1
	written, err := io.Copy(io.MultiWriter(tmp, hash), io.LimitReader(reader, limit))
	if err != nil {
		cleanup()
		return "", err
	}
	if written != int64(req.SizeBytes) {
		cleanup()
		return "", fmt.Errorf("%w: evidence size mismatch", ErrUploadIntegrity)
	}
	if got := hex.EncodeToString(hash.Sum(nil)); got != req.SHA256 {
		cleanup()
		return "", fmt.Errorf("%w: evidence digest mismatch", ErrUploadIntegrity)
	}
	if err := tmp.Sync(); err != nil {
		cleanup()
		return "", err
	}
	if err := tmp.Close(); err != nil {
		_ = os.Remove(name)
		return "", err
	}
	return name, nil
}

func sha256Hex(payload []byte) string {
	sum := sha256.Sum256(payload)
	return hex.EncodeToString(sum[:])
}

func (u *ResultEvidenceUploader) recordPath(attemptRef string) string {
	return filepath.Join(u.root, strings.ToLower(strings.TrimPrefix(attemptRef, "0x"))+".json")
}

func (u *ResultEvidenceUploader) persist(path string, record ResultEvidenceUploadRecord) error {
	payload, err := json.MarshalIndent(record, "", "  ")
	if err != nil {
		return err
	}
	tmp, err := os.CreateTemp(u.root, ".upload-*")
	if err != nil {
		return err
	}
	name := tmp.Name()
	cleanup := func() {
		_ = tmp.Close()
		_ = os.Remove(name)
	}
	if err := tmp.Chmod(0o600); err != nil {
		cleanup()
		return err
	}
	if _, err := tmp.Write(payload); err != nil {
		cleanup()
		return err
	}
	if err := tmp.Sync(); err != nil {
		cleanup()
		return err
	}
	if err := tmp.Close(); err != nil {
		_ = os.Remove(name)
		return err
	}
	if err := os.Rename(name, path); err != nil {
		_ = os.Remove(name)
		return err
	}
	return syncDirectory(u.root)
}

func (u *ResultEvidenceUploader) read(path string) (ResultEvidenceUploadRecord, error) {
	info, err := os.Lstat(path)
	if err != nil {
		return ResultEvidenceUploadRecord{}, err
	}
	if !info.Mode().IsRegular() || info.Mode()&os.ModeSymlink != 0 || info.Mode().Perm()&0o077 != 0 {
		return ResultEvidenceUploadRecord{}, ErrInvalidResultEvidenceUpload
	}
	raw, err := os.ReadFile(path)
	if err != nil {
		return ResultEvidenceUploadRecord{}, err
	}
	var record ResultEvidenceUploadRecord
	if err := json.Unmarshal(raw, &record); err != nil {
		return ResultEvidenceUploadRecord{}, err
	}
	if record.SchemaVersion != ResultEvidenceUploadRecordSchemaV1 || record.Authoritative || record.ResultCorrectnessEvidence || record.CanonicalResultCommitted {
		return ResultEvidenceUploadRecord{}, ErrInvalidResultEvidenceUpload
	}
	if err := validateBytes32("attempt id", record.AttemptID); err != nil {
		return ResultEvidenceUploadRecord{}, ErrInvalidResultEvidenceUpload
	}
	if filepath.Base(path) != strings.ToLower(strings.TrimPrefix(record.AttemptID, "0x"))+".json" {
		return ResultEvidenceUploadRecord{}, ErrInvalidResultEvidenceUpload
	}
	return record, nil
}

func CanonicalizeEvidenceRequirements(reqs []EvidenceRequirement) []EvidenceRequirement {
	out := append([]EvidenceRequirement(nil), reqs...)
	sort.Slice(out, func(i, j int) bool { return out[i].Ordinal < out[j].Ordinal })
	return out
}
