package worker

import (
	"context"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"math/big"
	"os"
	"path/filepath"
	"strings"
	"sync"
)

const (
	ReceiptAuthorizationSchemaV1 = "420-compute-worker-receipt-authorization-v1"
	ReceiptSchemaVersionV1       = uint32(1)
	ReceiptNonceV1               = uint64(1)
	ReceiptDomainNameV1          = "420Integrated Compute Receipt"
	ReceiptDomainVersionV1       = "1"
	ReceiptPayloadDomainLabelV1  = "420/COMPUTE/RECEIPT_PAYLOAD/V1"
	ReceiptResultDomainLabelV1   = "420/COMPUTE/WORKER_EXECUTION_RESULT/V1"
	ReceiptSigningPolicyLabelV1  = "420/COMPUTE/WORKER_EXECUTION_SIGNING/V1"
	ReceiptTypeStringV1          = "ComputeReceiptV1(uint32 receiptSchemaVersion,uint256 chainId,address verifyingRegistry,bytes32 jobId,bytes32 requestId,bytes32 matchId,bytes32 unitId,bytes32 attemptId,bytes32 providerId,bytes32 nodeId,bytes32 resourceId,address workerSigner,bytes32 signerGrantId,bytes32 manifestHash,bytes32 partitionPlanHash,uint32 partitionIndex,uint32 replicaIndex,uint64 attemptNonce,uint64 executionStartedAt,uint64 executionEndedAt,bytes32 meteringProfileId,uint32 meteringProfileVersion,uint256 measuredUnits,bytes32 measurementCommitment,bytes32 inputSliceCommitment,bytes32 outputCommitment,bytes32 evidenceRoot,bytes32 resultCode,uint64 receiptNonce)"
)

var (
	ErrInvalidReceiptAuthorization = errors.New("invalid compute worker receipt authorization")
	ErrInvalidReceipt              = errors.New("invalid compute worker signed receipt")
	ErrConflictingReceipt          = errors.New("conflicting compute worker receipt")
)

type ExecutionKeySigner interface {
	Address() string
	SignDigest([32]byte) ([]byte, error)
	VerifyDigest([32]byte, []byte) bool
}

type ReceiptAuthorization struct {
	SchemaVersion          string
	AuthorizationRef       string
	RequestID              string
	MatchID                string
	VerifyingRegistry      string
	WorkerSigner           string
	SignerGrantID          string
	PartitionPlanHash      string
	PartitionIndex         uint32
	ReplicaIndex           uint32
	MeteringProfileID      string
	MeteringProfileVersion uint32
	MeasuredUnits          string
	MeasurementCommitment  string
	InputSliceCommitment   string
	OutputCommitment       string
	OutputSourceSHA256     string
	EvidenceRoot           string
	ResultCode             string
	ResultAdapter          string
	SnapshotCommitment     string
	WorkerRevision         uint64
}

type CanonicalReceiptAuthority interface {
	ResolveReceiptAuthorization(context.Context, string) (ReceiptAuthorization, error)
}

type CanonicalReceiptAuthorityFunc func(context.Context, string) (ReceiptAuthorization, error)

func (f CanonicalReceiptAuthorityFunc) ResolveReceiptAuthorization(ctx context.Context, ref string) (ReceiptAuthorization, error) {
	return f(ctx, ref)
}

type ReceiptV1 struct {
	ReceiptSchemaVersion   uint32
	ChainID                uint64
	VerifyingRegistry      string
	JobID                  string
	RequestID              string
	MatchID                string
	UnitID                 string
	AttemptID              string
	ProviderID             string
	NodeID                 string
	ResourceID             string
	WorkerSigner           string
	SignerGrantID          string
	ManifestHash           string
	PartitionPlanHash      string
	PartitionIndex         uint32
	ReplicaIndex           uint32
	AttemptNonce           uint64
	ExecutionStartedAt     uint64
	ExecutionEndedAt       uint64
	MeteringProfileID      string
	MeteringProfileVersion uint32
	MeasuredUnits          string
	MeasurementCommitment  string
	InputSliceCommitment   string
	OutputCommitment       string
	EvidenceRoot           string
	ResultCode             string
	ReceiptNonce           uint64
}

type SignedReceipt struct {
	SchemaVersion             string
	Receipt                   ReceiptV1
	ReceiptHash               string
	StructHash                string
	DomainSeparator           string
	SigningDigest             string
	Signature                 string
	SignerAddress             string
	ResultAdapter             string
	SnapshotCommitment        string
	WorkerRevision            uint64
	ContractResultDigest      string
	ContractResultSignature   string
	ResultMaterialCommitment  string
	OutputSourceSHA256        string
	Signed                    bool
	Authoritative             bool
	ResultCorrectnessEvidence bool
	CanonicalResultCommitted  bool
}

type ReceiptStore struct {
	config    Config
	root      string
	results   *ResultStore
	authority CanonicalReceiptAuthority
	signer    ExecutionKeySigner
	mu        sync.Mutex
}

func NewReceiptStore(config Config, results *ResultStore, authority CanonicalReceiptAuthority, signer ExecutionKeySigner) (*ReceiptStore, error) {
	if results == nil || authority == nil || signer == nil {
		return nil, fmt.Errorf("%w: result store, canonical authority and signer required", ErrInvalidReceiptAuthorization)
	}
	if _, err := parseAddress(signer.Address()); err != nil {
		return nil, fmt.Errorf("%w: signer address invalid: %v", ErrInvalidReceiptAuthorization, err)
	}
	stateRoot, err := config.PrepareStateDir()
	if err != nil {
		return nil, err
	}
	root := filepath.Join(stateRoot, "receipts")
	if err := os.MkdirAll(root, 0o700); err != nil {
		return nil, err
	}
	if err := os.Chmod(root, 0o700); err != nil {
		return nil, err
	}
	return &ReceiptStore{config: config, root: root, results: results, authority: authority, signer: signer}, nil
}

func ValidateReceiptAuthorization(auth ReceiptAuthorization) error {
	if auth.SchemaVersion != ReceiptAuthorizationSchemaV1 {
		return fmt.Errorf("%w: unsupported schema", ErrInvalidReceiptAuthorization)
	}
	for name, value := range map[string]string{
		"authorization ref": auth.AuthorizationRef,
		"request id": auth.RequestID,
		"match id": auth.MatchID,
		"signer grant id": auth.SignerGrantID,
		"partition plan hash": auth.PartitionPlanHash,
		"metering profile id": auth.MeteringProfileID,
		"measurement commitment": auth.MeasurementCommitment,
		"input slice commitment": auth.InputSliceCommitment,
		"output commitment": auth.OutputCommitment,
		"evidence root": auth.EvidenceRoot,
		"result code": auth.ResultCode,
		"snapshot commitment": auth.SnapshotCommitment,
	} {
		if err := validateBytes32(name, value); err != nil {
			return fmt.Errorf("%w: %v", ErrInvalidReceiptAuthorization, err)
		}
		if isZeroBytes32(value) {
			return fmt.Errorf("%w: %s must be nonzero", ErrInvalidReceiptAuthorization, name)
		}
	}
	if _, err := parseAddress(auth.VerifyingRegistry); err != nil {
		return fmt.Errorf("%w: verifying registry: %v", ErrInvalidReceiptAuthorization, err)
	}
	if _, err := parseAddress(auth.WorkerSigner); err != nil {
		return fmt.Errorf("%w: worker signer: %v", ErrInvalidReceiptAuthorization, err)
	}
	if _, err := parseAddress(auth.ResultAdapter); err != nil {
		return fmt.Errorf("%w: result adapter: %v", ErrInvalidReceiptAuthorization, err)
	}
	if !sha256HexPattern.MatchString(auth.OutputSourceSHA256) {
		return fmt.Errorf("%w: output source SHA-256 invalid", ErrInvalidReceiptAuthorization)
	}
	if auth.MeteringProfileVersion == 0 || auth.WorkerRevision == 0 {
		return fmt.Errorf("%w: profile/worker revision must be nonzero", ErrInvalidReceiptAuthorization)
	}
	if _, err := parseUint256Decimal(auth.MeasuredUnits); err != nil {
		return fmt.Errorf("%w: measured units: %v", ErrInvalidReceiptAuthorization, err)
	}
	return nil
}

func (s *ReceiptStore) Sign(ctx context.Context, authorizationRef string) (SignedReceipt, error) {
	if s == nil || s.results == nil || s.authority == nil || s.signer == nil {
		return SignedReceipt{}, ErrInvalidReceiptAuthorization
	}
	result, err := s.results.Load(ctx, authorizationRef)
	if err != nil {
		return SignedReceipt{}, fmt.Errorf("%w: load result material: %v", ErrInvalidReceiptAuthorization, err)
	}
	auth, err := s.authority.ResolveReceiptAuthorization(ctx, authorizationRef)
	if err != nil {
		return SignedReceipt{}, fmt.Errorf("%w: resolve canonical receipt authorization: %v", ErrInvalidReceiptAuthorization, err)
	}
	if err := ValidateReceiptAuthorization(auth); err != nil {
		return SignedReceipt{}, err
	}
	if err := s.validateBindings(result, auth); err != nil {
		return SignedReceipt{}, err
	}

	started, err := unixUint64(result.ExecutionStartedAt)
	if err != nil {
		return SignedReceipt{}, err
	}
	ended, err := unixUint64(result.ExecutionEndedAt)
	if err != nil {
		return SignedReceipt{}, err
	}
	receipt := ReceiptV1{
		ReceiptSchemaVersion: ReceiptSchemaVersionV1,
		ChainID: result.ChainID,
		VerifyingRegistry: strings.ToLower(auth.VerifyingRegistry),
		JobID: result.JobID,
		RequestID: auth.RequestID,
		MatchID: auth.MatchID,
		UnitID: result.UnitID,
		AttemptID: result.AttemptRef,
		ProviderID: result.ProviderID,
		NodeID: result.NodeID,
		ResourceID: result.ResourceID,
		WorkerSigner: strings.ToLower(auth.WorkerSigner),
		SignerGrantID: auth.SignerGrantID,
		ManifestHash: result.ManifestHash,
		PartitionPlanHash: auth.PartitionPlanHash,
		PartitionIndex: auth.PartitionIndex,
		ReplicaIndex: auth.ReplicaIndex,
		AttemptNonce: result.AttemptNonce,
		ExecutionStartedAt: started,
		ExecutionEndedAt: ended,
		MeteringProfileID: auth.MeteringProfileID,
		MeteringProfileVersion: auth.MeteringProfileVersion,
		MeasuredUnits: normalizeUint256(auth.MeasuredUnits),
		MeasurementCommitment: auth.MeasurementCommitment,
		InputSliceCommitment: auth.InputSliceCommitment,
		OutputCommitment: auth.OutputCommitment,
		EvidenceRoot: auth.EvidenceRoot,
		ResultCode: auth.ResultCode,
		ReceiptNonce: ReceiptNonceV1,
	}
	receiptHash, structHash, domainSeparator, signingDigest, err := receiptDigests(receipt)
	if err != nil {
		return SignedReceipt{}, err
	}
	sig, err := s.signer.SignDigest(signingDigest)
	if err != nil {
		return SignedReceipt{}, err
	}
	if !s.signer.VerifyDigest(signingDigest, sig) {
		return SignedReceipt{}, fmt.Errorf("%w: signer failed local verification", ErrInvalidReceipt)
	}
	contractDigest, err := contractResultDigest(
		receipt.ChainID, auth.ResultAdapter, receipt.JobID, receipt.RequestID,
		receipt.ManifestHash, receipt.AttemptID, auth.SnapshotCommitment,
		result.WorkerID, auth.WorkerRevision, receipt.AttemptNonce,
		hex32(receiptHash), receipt.OutputCommitment,
	)
	if err != nil {
		return SignedReceipt{}, err
	}
	contractSig, err := s.signer.SignDigest(contractDigest)
	if err != nil {
		return SignedReceipt{}, err
	}
	if !s.signer.VerifyDigest(contractDigest, contractSig) {
		return SignedReceipt{}, fmt.Errorf("%w: contract result signature failed local verification", ErrInvalidReceipt)
	}
	signed := SignedReceipt{
		SchemaVersion: "420-compute-worker-signed-receipt-v1",
		Receipt: receipt,
		ReceiptHash: hex32(receiptHash),
		StructHash: hex32(structHash),
		DomainSeparator: hex32(domainSeparator),
		SigningDigest: hex32(signingDigest),
		Signature: "0x" + hex.EncodeToString(sig),
		SignerAddress: strings.ToLower(s.signer.Address()),
		ResultAdapter: strings.ToLower(auth.ResultAdapter),
		SnapshotCommitment: auth.SnapshotCommitment,
		WorkerRevision: auth.WorkerRevision,
		ContractResultDigest: hex32(contractDigest),
		ContractResultSignature: "0x" + hex.EncodeToString(contractSig),
		ResultMaterialCommitment: result.ResultCommitment,
		OutputSourceSHA256: result.OutputSHA256,
		Signed: true,
		Authoritative: false,
		ResultCorrectnessEvidence: false,
		CanonicalResultCommitted: false,
	}

	s.mu.Lock()
	defer s.mu.Unlock()
	path := s.path(result.AttemptRef)
	if existing, err := s.read(path); err == nil {
		if existing.ReceiptHash == signed.ReceiptHash &&
			existing.Signature == signed.Signature &&
			existing.ContractResultDigest == signed.ContractResultDigest &&
			existing.ContractResultSignature == signed.ContractResultSignature {
			return existing, nil
		}
		return SignedReceipt{}, ErrConflictingReceipt
	} else if !errors.Is(err, os.ErrNotExist) {
		return SignedReceipt{}, err
	}
	if err := s.persist(path, signed); err != nil {
		return SignedReceipt{}, err
	}
	return signed, nil
}

func (s *ReceiptStore) Load(ctx context.Context, authorizationRef string) (SignedReceipt, error) {
	result, err := s.results.Load(ctx, authorizationRef)
	if err != nil {
		return SignedReceipt{}, err
	}
	auth, err := s.authority.ResolveReceiptAuthorization(ctx, authorizationRef)
	if err != nil {
		return SignedReceipt{}, err
	}
	receipt, err := s.read(s.path(result.AttemptRef))
	if err != nil {
		return SignedReceipt{}, err
	}
	if err := VerifySignedReceipt(result, auth, receipt, s.signer); err != nil {
		return SignedReceipt{}, err
	}
	return receipt, nil
}

func VerifySignedReceipt(result ResultMaterial, auth ReceiptAuthorization, signed SignedReceipt, signer ExecutionKeySigner) error {
	if signer == nil {
		return ErrInvalidReceipt
	}
	if err := ValidateReceiptAuthorization(auth); err != nil {
		return err
	}
	if signed.SchemaVersion != "420-compute-worker-signed-receipt-v1" ||
		!signed.Signed || signed.Authoritative || signed.ResultCorrectnessEvidence || signed.CanonicalResultCommitted {
		return ErrInvalidReceipt
	}
	if strings.ToLower(signer.Address()) != strings.ToLower(auth.WorkerSigner) ||
		signed.SignerAddress != strings.ToLower(auth.WorkerSigner) ||
		signed.ResultAdapter != strings.ToLower(auth.ResultAdapter) ||
		signed.SnapshotCommitment != auth.SnapshotCommitment ||
		signed.WorkerRevision != auth.WorkerRevision ||
		signed.ResultMaterialCommitment != result.ResultCommitment ||
		signed.OutputSourceSHA256 != result.OutputSHA256 {
		return fmt.Errorf("%w: receipt authority binding mismatch", ErrInvalidReceipt)
	}
	if err := validateReceiptAgainstResult(signed.Receipt, result, auth); err != nil {
		return err
	}
	receiptHash, structHash, domainSeparator, signingDigest, err := receiptDigests(signed.Receipt)
	if err != nil {
		return err
	}
	if signed.ReceiptHash != hex32(receiptHash) ||
		signed.StructHash != hex32(structHash) ||
		signed.DomainSeparator != hex32(domainSeparator) ||
		signed.SigningDigest != hex32(signingDigest) {
		return fmt.Errorf("%w: receipt digest mismatch", ErrInvalidReceipt)
	}
	sig, err := decodeSignature(signed.Signature)
	if err != nil || !signer.VerifyDigest(signingDigest, sig) {
		return fmt.Errorf("%w: receipt signature invalid", ErrInvalidReceipt)
	}
	contractDigest, err := contractResultDigest(
		signed.Receipt.ChainID, auth.ResultAdapter, signed.Receipt.JobID, signed.Receipt.RequestID,
		signed.Receipt.ManifestHash, signed.Receipt.AttemptID, auth.SnapshotCommitment,
		result.WorkerID, auth.WorkerRevision, signed.Receipt.AttemptNonce,
		signed.ReceiptHash, signed.Receipt.OutputCommitment,
	)
	if err != nil {
		return err
	}
	if signed.ContractResultDigest != hex32(contractDigest) {
		return fmt.Errorf("%w: contract result digest mismatch", ErrInvalidReceipt)
	}
	contractSig, err := decodeSignature(signed.ContractResultSignature)
	if err != nil || !signer.VerifyDigest(contractDigest, contractSig) {
		return fmt.Errorf("%w: contract result signature invalid", ErrInvalidReceipt)
	}
	return nil
}

func (s *ReceiptStore) validateBindings(result ResultMaterial, auth ReceiptAuthorization) error {
	if auth.AuthorizationRef != result.AuthorizationRef ||
		auth.OutputSourceSHA256 != result.OutputSHA256 ||
		strings.ToLower(auth.WorkerSigner) != strings.ToLower(s.signer.Address()) {
		return fmt.Errorf("%w: result/receipt authority mismatch", ErrInvalidReceiptAuthorization)
	}
	if result.ChainID != s.config.Identity.ChainID ||
		result.ProviderID != s.config.Identity.ProviderID ||
		result.NodeID != s.config.Identity.NodeID ||
		result.ResourceID != s.config.Identity.ResourceID ||
		result.WorkerID != s.config.Identity.WorkerID {
		return fmt.Errorf("%w: worker identity mismatch", ErrInvalidReceiptAuthorization)
	}
	return nil
}

func validateReceiptAgainstResult(receipt ReceiptV1, result ResultMaterial, auth ReceiptAuthorization) error {
	started, err := unixUint64(result.ExecutionStartedAt)
	if err != nil {
		return err
	}
	ended, err := unixUint64(result.ExecutionEndedAt)
	if err != nil {
		return err
	}
	if receipt.ReceiptSchemaVersion != ReceiptSchemaVersionV1 ||
		receipt.ReceiptNonce != ReceiptNonceV1 ||
		receipt.ChainID != result.ChainID ||
		receipt.JobID != result.JobID ||
		receipt.RequestID != auth.RequestID ||
		receipt.MatchID != auth.MatchID ||
		receipt.UnitID != result.UnitID ||
		receipt.AttemptID != result.AttemptRef ||
		receipt.ProviderID != result.ProviderID ||
		receipt.NodeID != result.NodeID ||
		receipt.ResourceID != result.ResourceID ||
		strings.ToLower(receipt.VerifyingRegistry) != strings.ToLower(auth.VerifyingRegistry) ||
		strings.ToLower(receipt.WorkerSigner) != strings.ToLower(auth.WorkerSigner) ||
		receipt.SignerGrantID != auth.SignerGrantID ||
		receipt.ManifestHash != result.ManifestHash ||
		receipt.PartitionPlanHash != auth.PartitionPlanHash ||
		receipt.PartitionIndex != auth.PartitionIndex ||
		receipt.ReplicaIndex != auth.ReplicaIndex ||
		receipt.AttemptNonce != result.AttemptNonce ||
		receipt.ExecutionStartedAt != started ||
		receipt.ExecutionEndedAt != ended ||
		receipt.MeteringProfileID != auth.MeteringProfileID ||
		receipt.MeteringProfileVersion != auth.MeteringProfileVersion ||
		receipt.MeasuredUnits != normalizeUint256(auth.MeasuredUnits) ||
		receipt.MeasurementCommitment != auth.MeasurementCommitment ||
		receipt.InputSliceCommitment != auth.InputSliceCommitment ||
		receipt.OutputCommitment != auth.OutputCommitment ||
		receipt.EvidenceRoot != auth.EvidenceRoot ||
		receipt.ResultCode != auth.ResultCode {
		return fmt.Errorf("%w: canonical receipt field drift", ErrInvalidReceipt)
	}
	return nil
}

func receiptDigests(receipt ReceiptV1) (receiptHash, structHash, domainSeparator, signingDigest [32]byte, err error) {
	fields, err := receiptABIWords(receipt)
	if err != nil {
		return receiptHash, structHash, domainSeparator, signingDigest, err
	}
	payloadDomain := keccak256([]byte(ReceiptPayloadDomainLabelV1))
	payload := make([]byte, 0, 32*(len(fields)+1))
	payload = append(payload, payloadDomain[:]...)
	for _, word := range fields {
		payload = append(payload, word[:]...)
	}
	receiptHash = keccak256(payload)

	typeHash := keccak256([]byte(ReceiptTypeStringV1))
	structPayload := make([]byte, 0, 32*(len(fields)+1))
	structPayload = append(structPayload, typeHash[:]...)
	for _, word := range fields {
		structPayload = append(structPayload, word[:]...)
	}
	structHash = keccak256(structPayload)

	domainType := keccak256([]byte("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"))
	nameHash := keccak256([]byte(ReceiptDomainNameV1))
	versionHash := keccak256([]byte(ReceiptDomainVersionV1))
	addr, err := parseAddress(receipt.VerifyingRegistry)
	if err != nil {
		return receiptHash, structHash, domainSeparator, signingDigest, err
	}
	domainPayload := make([]byte, 0, 32*5)
	domainPayload = append(domainPayload, domainType[:]...)
	domainPayload = append(domainPayload, nameHash[:]...)
	domainPayload = append(domainPayload, versionHash[:]...)
	cw := uintWord(new(big.Int).SetUint64(receipt.ChainID))
	domainPayload = append(domainPayload, cw[:]...)
	aw := addressWord(addr)
	domainPayload = append(domainPayload, aw[:]...)
	domainSeparator = keccak256(domainPayload)
	finalPayload := make([]byte, 0, 66)
	finalPayload = append(finalPayload, 0x19, 0x01)
	finalPayload = append(finalPayload, domainSeparator[:]...)
	finalPayload = append(finalPayload, structHash[:]...)
	signingDigest = keccak256(finalPayload)
	return receiptHash, structHash, domainSeparator, signingDigest, nil
}

func receiptABIWords(receipt ReceiptV1) ([][32]byte, error) {
	measured, err := parseUint256Decimal(receipt.MeasuredUnits)
	if err != nil {
		return nil, err
	}
	addr, err := parseAddress(receipt.VerifyingRegistry)
	if err != nil {
		return nil, err
	}
	signer, err := parseAddress(receipt.WorkerSigner)
	if err != nil {
		return nil, err
	}
	values := make([][32]byte, 0, 29)
	values = append(values, uintWord(new(big.Int).SetUint64(uint64(receipt.ReceiptSchemaVersion))))
	values = append(values, uintWord(new(big.Int).SetUint64(receipt.ChainID)))
	values = append(values, addressWord(addr))
	for _, v := range []string{receipt.JobID, receipt.RequestID, receipt.MatchID, receipt.UnitID, receipt.AttemptID, receipt.ProviderID, receipt.NodeID, receipt.ResourceID} {
		w, err := bytes32Word(v)
		if err != nil {
			return nil, err
		}
		values = append(values, w)
	}
	values = append(values, addressWord(signer))
	for _, v := range []string{receipt.SignerGrantID, receipt.ManifestHash, receipt.PartitionPlanHash} {
		w, err := bytes32Word(v)
		if err != nil {
			return nil, err
		}
		values = append(values, w)
	}
	values = append(values, uintWord(new(big.Int).SetUint64(uint64(receipt.PartitionIndex))))
	values = append(values, uintWord(new(big.Int).SetUint64(uint64(receipt.ReplicaIndex))))
	values = append(values, uintWord(new(big.Int).SetUint64(receipt.AttemptNonce)))
	values = append(values, uintWord(new(big.Int).SetUint64(receipt.ExecutionStartedAt)))
	values = append(values, uintWord(new(big.Int).SetUint64(receipt.ExecutionEndedAt)))
	w, err := bytes32Word(receipt.MeteringProfileID)
	if err != nil {
		return nil, err
	}
	values = append(values, w)
	values = append(values, uintWord(new(big.Int).SetUint64(uint64(receipt.MeteringProfileVersion))))
	values = append(values, uintWord(measured))
	for _, v := range []string{receipt.MeasurementCommitment, receipt.InputSliceCommitment, receipt.OutputCommitment, receipt.EvidenceRoot, receipt.ResultCode} {
		w, err := bytes32Word(v)
		if err != nil {
			return nil, err
		}
		values = append(values, w)
	}
	values = append(values, uintWord(new(big.Int).SetUint64(receipt.ReceiptNonce)))
	if len(values) != 29 {
		return nil, fmt.Errorf("%w: receipt ABI field count %d", ErrInvalidReceipt, len(values))
	}
	return values, nil
}

func contractResultDigest(chainID uint64, resultAdapter, jobID, requestID, manifestHash, attemptRef, snapshotCommitment, workerID string, workerRevision, attempt uint64, receiptHash, outputHash string) ([32]byte, error) {
	var zero [32]byte
	addr, err := parseAddress(resultAdapter)
	if err != nil {
		return zero, err
	}
	words := make([][32]byte, 0, 14)
	resultDomain := keccak256([]byte(ReceiptResultDomainLabelV1))
	signingPolicy := keccak256([]byte(ReceiptSigningPolicyLabelV1))
	words = append(words, resultDomain)
	words = append(words, uintWord(new(big.Int).SetUint64(chainID)))
	words = append(words, addressWord(addr))
	words = append(words, signingPolicy)
	for _, v := range []string{jobID, requestID, manifestHash, attemptRef, snapshotCommitment, workerID} {
		w, err := bytes32Word(v)
		if err != nil {
			return zero, err
		}
		words = append(words, w)
	}
	words = append(words, uintWord(new(big.Int).SetUint64(workerRevision)))
	words = append(words, uintWord(new(big.Int).SetUint64(attempt)))
	for _, v := range []string{receiptHash, outputHash} {
		w, err := bytes32Word(v)
		if err != nil {
			return zero, err
		}
		words = append(words, w)
	}
	payload := make([]byte, 0, 32*len(words))
	for _, w := range words {
		payload = append(payload, w[:]...)
	}
	return keccak256(payload), nil
}

func parseUint256Decimal(value string) (*big.Int, error) {
	if value == "" || strings.HasPrefix(value, "-") || strings.HasPrefix(value, "+") {
		return nil, fmt.Errorf("invalid uint256 decimal")
	}
	n, ok := new(big.Int).SetString(value, 10)
	if !ok || n.Sign() < 0 || n.BitLen() > 256 {
		return nil, fmt.Errorf("uint256 out of range")
	}
	return n, nil
}

func normalizeUint256(value string) string {
	n, err := parseUint256Decimal(value)
	if err != nil {
		return value
	}
	return n.String()
}

func uintWord(n *big.Int) [32]byte {
	var out [32]byte
	if n == nil {
		return out
	}
	b := n.Bytes()
	copy(out[32-len(b):], b)
	return out
}

func addressWord(addr [20]byte) [32]byte {
	var out [32]byte
	copy(out[12:], addr[:])
	return out
}

func bytes32Word(value string) ([32]byte, error) {
	var out [32]byte
	if err := validateBytes32("bytes32", value); err != nil {
		return out, err
	}
	raw, err := hex.DecodeString(strings.TrimPrefix(value, "0x"))
	if err != nil || len(raw) != 32 {
		return out, fmt.Errorf("invalid bytes32")
	}
	copy(out[:], raw)
	return out, nil
}

func isZeroBytes32(value string) bool {
	w, err := bytes32Word(value)
	if err != nil {
		return true
	}
	for _, b := range w {
		if b != 0 {
			return false
		}
	}
	return true
}

func unixUint64(t interface{ Unix() int64 }) (uint64, error) {
	v := t.Unix()
	if v < 0 {
		return 0, fmt.Errorf("%w: negative execution timestamp", ErrInvalidReceipt)
	}
	return uint64(v), nil
}

func hex32(v [32]byte) string {
	return "0x" + hex.EncodeToString(v[:])
}

func decodeSignature(value string) ([]byte, error) {
	if len(value) != 132 || !strings.HasPrefix(value, "0x") {
		return nil, fmt.Errorf("invalid signature encoding")
	}
	raw, err := hex.DecodeString(value[2:])
	if err != nil || len(raw) != 65 {
		return nil, fmt.Errorf("invalid signature encoding")
	}
	if raw[64] != 27 && raw[64] != 28 {
		return nil, fmt.Errorf("invalid signature v")
	}
	if new(big.Int).SetBytes(raw[32:64]).Cmp(secp256k1HalfN) > 0 {
		return nil, fmt.Errorf("non-canonical high-s signature")
	}
	return raw, nil
}

func (s *ReceiptStore) path(attemptRef string) string {
	return filepath.Join(s.root, strings.ToLower(strings.TrimPrefix(attemptRef, "0x"))+".json")
}

func (s *ReceiptStore) persist(path string, receipt SignedReceipt) error {
	payload, err := json.MarshalIndent(receipt, "", "  ")
	if err != nil {
		return err
	}
	tmp, err := os.CreateTemp(s.root, ".receipt-*")
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
	return syncDirectory(s.root)
}

func (s *ReceiptStore) read(path string) (SignedReceipt, error) {
	info, err := os.Lstat(path)
	if err != nil {
		return SignedReceipt{}, err
	}
	if !info.Mode().IsRegular() || info.Mode()&os.ModeSymlink != 0 || info.Mode().Perm()&0o077 != 0 {
		return SignedReceipt{}, ErrInvalidReceipt
	}
	raw, err := os.ReadFile(path)
	if err != nil {
		return SignedReceipt{}, err
	}
	var receipt SignedReceipt
	if err := json.Unmarshal(raw, &receipt); err != nil {
		return SignedReceipt{}, err
	}
	if err := validateBytes32("attempt id", receipt.Receipt.AttemptID); err != nil {
		return SignedReceipt{}, ErrInvalidReceipt
	}
	if filepath.Base(path) != strings.ToLower(strings.TrimPrefix(receipt.Receipt.AttemptID, "0x"))+".json" {
		return SignedReceipt{}, ErrInvalidReceipt
	}
	return receipt, nil
}
