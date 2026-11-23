// Package recovery owns the durable certified-consensus/execution settlement boundary.
// It consumes quorum-certified blocks; it neither manufactures votes nor signs them.
package recovery

import (
	"bytes"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"
	"syscall"

	eng "github.com/420integrated/420-integrated/consensus/engine"
	"github.com/420integrated/420-integrated/consensus/finality"
	csys "github.com/420integrated/420-integrated/consensus/systemcall"
	ct "github.com/420integrated/420-integrated/consensus/types"
)

var ErrDuplicate = errors.New("consensus settlement already recorded")
var ErrFinalized = errors.New("consensus replacement crosses finalized boundary")

type Member struct {
	PublicKey ct.BLSPubkey
	Proof     ct.BLSSignature
}

// Trust is an independently provisioned consensus checkpoint/committee. The CLI
// requires its SHA-256 explicitly, never derives it from the execution endpoint.
// Unknown rotations/committees fail closed rather than accepting RPC authority.
type Trust struct {
	ChainID         uint64
	ProtocolVersion uint32
	Genesis         ct.Checkpoint
	Execution       csys.SequenceAnchor
	Timestamp       uint64
	Rotation        uint64
	LastRotation    uint64 `json:",omitempty"`
	CommitteeRoot   ct.Root
	Members         []Member
	Committees      []RotationCommittee `json:",omitempty"`
}

// RotationCommittee replaces the baseline seat map for exactly one pinned rotation.
type RotationCommittee struct {
	Rotation uint64
	Root     ct.Root
	Members  []Member
}

type Signatures interface {
	finality.AggregateVerifier
	VerifyProof(ct.BLSPubkey, ct.BLSSignature) bool
}
type Record struct {
	Consensus             ct.ConsensusBlockEnvelope
	Certificate           ct.QuorumCertificate
	Outcomes              csys.FinalizedStakeOutcomes
	Payload               eng.ExecutionPayloadV3
	VersionedHashes       []eng.Hash32
	ParentBeaconBlockRoot eng.Hash32
}
type history struct {
	Schema    string
	TrustHash string
	// Entries are append-only successful canonical selections, including replaced
	// heads. Pending is a durable, authenticated write-ahead intent, not settlement.
	Entries  []Record
	Pending  *Record
	Checksum string
}
type view struct {
	tracker *finality.Tracker
	records map[ct.Root]Record
	anchors map[ct.Root]csys.SequenceAnchor
}

func hashJSON(x any) string {
	b, _ := json.Marshal(x)
	h := sha256.Sum256(b)
	return hex.EncodeToString(h[:])
}
func historyChecksum(h history) string         { h.Checksum = ""; return hashJSON(h) }
func Hash(h [32]byte) eng.Hash32               { return eng.Hash32("0x" + hex.EncodeToString(h[:])) }
func ParseHash(h eng.Hash32) ([32]byte, error) { return ct.ParseRoot(string(h)) }

// Decode rejects ambiguous duplicate keys at every depth, unknown struct fields,
// null documents, and concatenated JSON. Signature validation follows decoding.
func Decode(raw []byte, dst any) error {
	d := json.NewDecoder(bytes.NewReader(raw))
	var walk func() error
	walk = func() error {
		tok, err := d.Token()
		if err != nil {
			return err
		}
		delim, ok := tok.(json.Delim)
		if !ok {
			return nil
		}
		if delim == '{' {
			seen := map[string]bool{}
			for d.More() {
				key, err := d.Token()
				if err != nil {
					return err
				}
				s, ok := key.(string)
				if !ok || seen[strings.ToLower(s)] {
					return fmt.Errorf("duplicate JSON field")
				}
				seen[strings.ToLower(s)] = true
				if err := walk(); err != nil {
					return err
				}
			}
		} else if delim == '[' {
			for d.More() {
				if err := walk(); err != nil {
					return err
				}
			}
		} else {
			return fmt.Errorf("unexpected JSON delimiter")
		}
		_, err = d.Token()
		return err
	}
	if err := walk(); err != nil {
		return err
	}
	if _, err := d.Token(); err != io.EOF {
		return fmt.Errorf("trailing JSON")
	}
	if bytes.Equal(bytes.TrimSpace(raw), []byte("null")) {
		return fmt.Errorf("null document")
	}
	d = json.NewDecoder(bytes.NewReader(raw))
	d.DisallowUnknownFields()
	return d.Decode(dst)
}
func atomicWrite(path string, data []byte) error {
	dir := filepath.Dir(path)
	if err := os.MkdirAll(dir, 0700); err != nil {
		return err
	}
	f, err := os.CreateTemp(dir, ".settlement-*")
	if err != nil {
		return err
	}
	name := f.Name()
	defer os.Remove(name)
	defer f.Close()
	if err = f.Chmod(0600); err != nil {
		return err
	}
	if _, err = f.Write(data); err != nil {
		return err
	}
	if err = f.Sync(); err != nil {
		return err
	}
	if err = f.Close(); err != nil {
		return err
	}
	if err = os.Rename(name, path); err != nil {
		return err
	}
	d, err := os.Open(dir)
	if err != nil {
		return err
	}
	defer d.Close()
	return d.Sync()
}

// AllowsRotation bounds the rotations authorized by the pinned trust.
func (t Trust) AllowsRotation(rotation uint64) bool {
	return rotation == t.Rotation || (rotation > t.Rotation && rotation <= t.LastRotation)
}

// CommitteeAt returns the seat map authorized by the pinned trust for rotation.
func (t Trust) CommitteeAt(rotation uint64) (ct.Root, []Member) {
	if !t.AllowsRotation(rotation) {
		return ct.Root{}, nil
	}
	for _, committee := range t.Committees {
		if committee.Rotation == rotation {
			return committee.Root, committee.Members
		}
	}
	return t.CommitteeRoot, t.Members
}

func (t Trust) Validate(sig Signatures) error {
	return t.validate(sig)
}

func (t Trust) validate(sig Signatures) error {
	if sig == nil || t.ChainID != ct.ChainID || t.ProtocolVersion != 1 || t.Genesis.Root == (ct.Root{}) || t.Genesis.Slot != 0 || t.Execution.ChainID != t.ChainID || t.Execution.ExecutionBlock != 0 || t.Execution.LastSequence != 0 || t.Execution.BlockHash == ([32]byte{}) || t.CommitteeRoot == (ct.Root{}) || len(t.Members) < 15 || len(t.Members) > 30 {
		return fmt.Errorf("invalid pinned settlement trust")
	}
	if err := validateMembers(t.Members, sig); err != nil {
		return err
	}
	roots := map[ct.Root][]Member{t.CommitteeRoot: t.Members}
	last := t.Rotation
	for _, committee := range t.Committees {
		if committee.Rotation <= last || !t.AllowsRotation(committee.Rotation) || committee.Root == (ct.Root{}) {
			return fmt.Errorf("invalid pinned rotation committee")
		}
		if previous, ok := roots[committee.Root]; ok && hashJSON(previous) != hashJSON(committee.Members) {
			return fmt.Errorf("committee root reused for a different seat map")
		}
		if err := validateMembers(committee.Members, sig); err != nil {
			return err
		}
		roots[committee.Root] = committee.Members
		last = committee.Rotation
	}
	return nil
}

func validateMembers(members []Member, sig Signatures) error {
	if len(members) < 15 || len(members) > 30 {
		return fmt.Errorf("invalid pinned committee size")
	}
	seen := map[ct.BLSPubkey]bool{}
	for _, m := range members {
		if seen[m.PublicKey] || !sig.VerifyProof(m.PublicKey, m.Proof) {
			return fmt.Errorf("invalid/duplicate committee key or proof of possession")
		}
		seen[m.PublicKey] = true
	}
	return nil
}
func newView(t Trust) *view {
	return &view{tracker: finality.NewTracker(t.Genesis), records: map[ct.Root]Record{}, anchors: map[ct.Root]csys.SequenceAnchor{t.Genesis.Root: t.Execution}}
}
func (v *view) descends(root, ancestor ct.Root) bool {
	for {
		if root == ancestor {
			return true
		}
		r, ok := v.records[root]
		if !ok {
			return false
		}
		root = r.Consensus.Header.ParentConsensusRoot
	}
}

// add enforces the existing one-certified-child finality rule with authenticated
// ancestry before invoking Tracker. No caller may select a branch through RPC.
func (v *view) add(t Trust, sig Signatures, r Record) (csys.Batch, csys.SequenceAnchor, error) {
	h := r.Consensus.Header
	root := h.HashTreeRoot()
	zero := csys.SequenceAnchor{}
	if _, ok := v.anchors[root]; ok {
		return csys.Batch{}, zero, ErrDuplicate
	}
	parent, ok := v.anchors[h.ParentConsensusRoot]
	if !ok {
		return csys.Batch{}, zero, fmt.Errorf("missing authenticated consensus parent")
	}
	st := v.tracker.Status()
	if !v.descends(h.ParentConsensusRoot, st.Finalized.Root) || h.Slot <= st.Finalized.Slot {
		return csys.Batch{}, zero, ErrFinalized
	}
	parentSlot := t.Genesis.Slot
	var parentQC ct.QuorumCertificate
	if pr, ok := v.records[h.ParentConsensusRoot]; ok {
		parentSlot = pr.Consensus.Header.Slot
		parentQC = pr.Certificate
	}
	rotation := h.Slot / ct.SlotsPerRotation
	parentRotation := t.Rotation
	if pr, ok := v.records[h.ParentConsensusRoot]; ok {
		parentRotation = pr.Consensus.Header.Rotation
	}
	if rotation < parentRotation || (rotation > parentRotation &&
		(rotation-parentRotation != 1 || h.Slot%ct.SlotsPerRotation != 0)) {
		return csys.Batch{}, zero, fmt.Errorf("missing consecutive certified rotation handoff")
	}
	committeeRoot, members := t.CommitteeAt(rotation)
	if h.Slot <= parentSlot || h.Slot < st.Head.Slot || !t.AllowsRotation(rotation) || h.Rotation != rotation || h.CommitteeRoot != committeeRoot || int(h.ProposerSeat) >= len(members) || h.ProposerRank > 2 {
		return csys.Batch{}, zero, fmt.Errorf("invalid certified consensus context")
	}
	if hashJSON(h.LatestQC) != hashJSON(parentQC) {
		return csys.Batch{}, zero, fmt.Errorf("parent QC mismatch")
	}
	qc := r.Certificate
	if qc.BlockRoot != root || qc.ParentRoot != h.ParentConsensusRoot || qc.Slot != h.Slot || qc.CommitteeRoot != committeeRoot || qc.ProtocolVersion != t.ProtocolVersion {
		return csys.Batch{}, zero, fmt.Errorf("QC/header context mismatch")
	}
	pks := make([]ct.BLSPubkey, len(members))
	for i, m := range members {
		pks[i] = m.PublicKey
	}
	if err := finality.VerifyQC(qc, pks, t.ChainID, sig); err != nil {
		return csys.Batch{}, zero, err
	}
	if parent.ExecutionBlock == ^uint64(0) {
		return csys.Batch{}, zero, fmt.Errorf("execution number overflow")
	}
	batch, err := csys.BuildStakeBatch(csys.DerivationContext{ChainID: t.ChainID, ExecutionBlock: parent.ExecutionBlock + 1, ParentHash: parent.BlockHash}, parent.LastSequence, r.Outcomes)
	if err != nil {
		return batch, zero, err
	}
	if err = r.Consensus.ValidateSystemCallCommitment(t.ChainID, batch.ExecutionBlock, parent.BlockHash, parent.LastSequence); err != nil {
		return batch, zero, err
	}
	if batch.Root() != h.SystemCallBatchRoot {
		return batch, zero, fmt.Errorf("outcomes differ from certified batch")
	}
	payloadHash, err := ParseHash(r.Payload.BlockHash)
	if err != nil || payloadHash != h.ExecutionPayloadHash {
		return batch, zero, fmt.Errorf("certified execution hash mismatch")
	}
	randao, err := ParseHash(r.Payload.PrevRandao)
	if err != nil || randao != h.RandomnessContext {
		return batch, zero, fmt.Errorf("randomness/payload mismatch")
	}
	if err = eng.VerifyPayloadSystemCallRoot(r.Payload, batch); err != nil {
		return batch, zero, err
	}
	if h.Slot > (^uint64(0)-t.Timestamp)/ct.SlotSeconds || r.Payload.Timestamp != fmt.Sprintf("0x%x", t.Timestamp+h.Slot*ct.SlotSeconds) {
		return batch, zero, fmt.Errorf("consensus slot/execution timestamp mismatch")
	}
	if _, err = ParseHash(r.ParentBeaconBlockRoot); err != nil {
		return batch, zero, fmt.Errorf("invalid beacon root")
	}
	next := parent
	next.ExecutionBlock++
	next.BlockHash = payloadHash
	if len(batch.Calls) > 0 {
		next.LastSequence = batch.Calls[len(batch.Calls)-1].Sequence
	}
	if err = v.tracker.AddCertified(qc); err != nil {
		return batch, zero, err
	}
	v.records[root] = r
	v.anchors[root] = next
	return batch, next, nil
}
func (v *view) path(t Trust, root ct.Root) ([]Record, error) {
	var reverse []Record
	for root != t.Genesis.Root {
		r, ok := v.records[root]
		if !ok {
			return nil, fmt.Errorf("incomplete canonical consensus history")
		}
		reverse = append(reverse, r)
		root = r.Consensus.Header.ParentConsensusRoot
	}
	result := make([]Record, len(reverse))
	for i := range reverse {
		result[len(reverse)-1-i] = reverse[i]
	}
	return result, nil
}
func lockDirectory(dir string) (*os.File, error) {
	if err := os.MkdirAll(dir, 0700); err != nil {
		return nil, err
	}
	f, err := os.OpenFile(filepath.Join(dir, "settlement.lock"), os.O_CREATE|os.O_RDWR, 0600)
	if err != nil {
		return nil, err
	}
	if err = syscall.Flock(int(f.Fd()), syscall.LOCK_EX|syscall.LOCK_NB); err != nil {
		f.Close()
		return nil, fmt.Errorf("settlement state already owned: %w", err)
	}
	return f, nil
}

type checkpoint struct {
	Schema     string
	TrustHash  string
	Head       ct.Checkpoint
	Finalized  ct.Checkpoint
	Settlement csys.SequenceAnchor
	Checksum   string
}

func checkpointChecksum(c checkpoint) string { c.Checksum = ""; return hashJSON(c) }
func (s *Settlement) checkHighWater() error {
	raw, err := os.ReadFile(filepath.Join(s.dir, "checkpoint.json"))
	if errors.Is(err, os.ErrNotExist) {
		if len(s.history.Entries) > 0 {
			return fmt.Errorf("settlement high-water checkpoint missing")
		}
		return nil
	}
	if err != nil {
		return err
	}
	var c checkpoint
	if err = Decode(raw, &c); err != nil {
		return err
	}
	if c.Schema != "420-settlement-checkpoint-v1" || c.TrustHash != s.history.TrustHash || c.Checksum != checkpointChecksum(c) {
		return fmt.Errorf("invalid settlement checkpoint integrity")
	}
	a, ok := s.view.anchors[c.Head.Root]
	if !ok || a != c.Settlement {
		return fmt.Errorf("history missing durable settled checkpoint")
	}
	slot := s.trust.Genesis.Slot
	if r, ok := s.view.records[c.Head.Root]; ok {
		slot = r.Consensus.Header.Slot
	}
	if c.Head.Slot != slot {
		return fmt.Errorf("checkpoint head slot mismatch")
	}
	f, ok := s.view.anchors[c.Finalized.Root]
	if !ok {
		return ErrFinalized
	}
	_ = f
	slot = s.trust.Genesis.Slot
	if r, ok := s.view.records[c.Finalized.Root]; ok {
		slot = r.Consensus.Header.Slot
	}
	if slot != c.Finalized.Slot || !s.view.descends(s.view.tracker.Status().Finalized.Root, c.Finalized.Root) {
		return ErrFinalized
	}
	return nil
}
func (s *Settlement) writeCheckpoint(v *view) error {
	st := v.tracker.Status()
	c := checkpoint{Schema: "420-settlement-checkpoint-v1", TrustHash: s.history.TrustHash, Head: st.Head, Finalized: st.Finalized, Settlement: v.anchors[st.Head.Root]}
	c.Checksum = checkpointChecksum(c)
	raw, err := json.MarshalIndent(c, "", "  ")
	if err != nil {
		return err
	}
	if err = atomicWrite(filepath.Join(s.dir, "checkpoint.json"), append(raw, '\n')); err != nil {
		s.fatal = err
	}
	return err
}
