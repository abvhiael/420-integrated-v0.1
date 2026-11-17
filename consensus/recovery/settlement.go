package recovery

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"sync"

	eng "github.com/420integrated/420-integrated/consensus/engine"
	csys "github.com/420integrated/420-integrated/consensus/systemcall"
	ct "github.com/420integrated/420-integrated/consensus/types"
)

type Options struct {
	RepairSequence bool
	// AfterCanonical is observational/instrumentation only. It cannot supply or
	// replace authority. A crash here leaves the durable pending record intact.
	AfterCanonical func(Record)
}
type Status struct {
	Head       ct.Checkpoint
	Finalized  ct.Checkpoint
	Settlement csys.SequenceAnchor
	Pending    ct.Root
	Ready      bool
}
type Settlement struct {
	mu         sync.Mutex
	trust      Trust
	signatures Signatures
	engine     *eng.Client
	dir        string
	owner      *os.File
	history    history
	view       *view
	sequences  csys.SequenceManager
	options    Options
	fatal      error
	ready      bool
}

func Open(t Trust, dir string, c *eng.Client, options Options) (s *Settlement, err error) {
	sig, err := ProductionSignatures()
	if err != nil {
		return nil, err
	}
	return open(t, dir, c, options, sig)
}
func open(t Trust, dir string, c *eng.Client, options Options, sig Signatures) (s *Settlement, err error) {
	if err = t.validate(sig); err != nil {
		return nil, err
	}
	if dir == "" || c == nil {
		return nil, fmt.Errorf("persistent settlement directory and execution client required")
	}
	// Own copies of all inputs. Caller mutation cannot change the trust anchor.
	raw, _ := json.Marshal(t)
	var ownedTrust Trust
	if err = Decode(raw, &ownedTrust); err != nil {
		return nil, err
	}
	t = ownedTrust
	owner, err := lockDirectory(dir)
	if err != nil {
		return nil, err
	}
	defer func() {
		if err != nil {
			owner.Close()
		}
	}()
	s = &Settlement{trust: t, signatures: sig, engine: c, dir: dir, owner: owner, options: options, sequences: csys.SequenceManager{Store: csys.FileSequenceStore{Path: filepath.Join(dir, "sequence.json")}}}
	s.history = history{Schema: "420-certified-settlement-history-v1", TrustHash: hashJSON(t), Entries: []Record{}}
	raw, err = os.ReadFile(filepath.Join(dir, "history.json"))
	if err == nil {
		var h history
		if err = Decode(raw, &h); err != nil {
			return nil, err
		}
		if h.Schema != s.history.Schema || h.TrustHash != s.history.TrustHash || h.Checksum != historyChecksum(h) {
			return nil, fmt.Errorf("invalid settlement history integrity or trust binding")
		}
		s.history = h
	} else if !errors.Is(err, os.ErrNotExist) {
		return nil, err
	}
	s.view = newView(t)
	for _, r := range s.history.Entries {
		if _, _, err = s.view.add(t, sig, r); err != nil {
			return nil, fmt.Errorf("invalid committed history: %w", err)
		}
	}
	if s.history.Pending != nil {
		v, er := s.speculative()
		if er != nil {
			return nil, er
		}
		_ = v
	}
	if err = s.checkHighWater(); err != nil {
		return nil, err
	}
	return s, nil
}
func (s *Settlement) Close() error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.owner == nil {
		return nil
	}
	err := s.owner.Close()
	s.owner = nil
	return err
}
func (s *Settlement) save(h history) error {
	h.Checksum = historyChecksum(h)
	raw, err := json.MarshalIndent(h, "", "  ")
	if err != nil {
		return err
	}
	if err = atomicWrite(filepath.Join(s.dir, "history.json"), append(raw, '\n')); err != nil {
		s.fatal = err
		return err
	}
	s.history = h
	return nil
}
func (s *Settlement) speculative() (*view, error) {
	v := &view{tracker: s.view.tracker.Clone(), records: map[ct.Root]Record{}, anchors: map[ct.Root]csys.SequenceAnchor{}}
	for k, r := range s.view.records {
		v.records[k] = r
	}
	for k, a := range s.view.anchors {
		v.anchors[k] = a
	}
	if s.history.Pending != nil {
		if _, _, err := v.add(s.trust, s.signatures, *s.history.Pending); err != nil {
			return nil, fmt.Errorf("invalid pending certified history: %w", err)
		}
	}
	return v, nil
}
func (s *Settlement) status() Status {
	st := s.view.tracker.Status()
	result := Status{Head: st.Head, Finalized: st.Finalized, Settlement: s.view.anchors[st.Head.Root], Ready: s.ready}
	if s.history.Pending != nil {
		result.Pending = s.history.Pending.Consensus.Header.HashTreeRoot()
	}
	return result
}
func (s *Settlement) Status() Status { s.mu.Lock(); defer s.mu.Unlock(); return s.status() }

// Queue verifies authority, ancestry and derivation before any durable intent or
// execution staging. A pending invalid/rejected transition cannot be skipped.
func (s *Settlement) Queue(r Record) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.fatal != nil {
		return s.fatal
	}
	raw, err := json.Marshal(r)
	if err != nil {
		return err
	}
	var ownedRecord Record
	if err = Decode(raw, &ownedRecord); err != nil {
		return err
	}
	r = ownedRecord
	root := r.Consensus.Header.HashTreeRoot()
	if _, ok := s.view.anchors[root]; ok {
		return ErrDuplicate
	}
	if s.history.Pending != nil {
		if root == s.history.Pending.Consensus.Header.HashTreeRoot() {
			return ErrDuplicate
		}
		return fmt.Errorf("previous certified settlement remains pending")
	}
	v := &view{tracker: s.view.tracker.Clone(), records: map[ct.Root]Record{}, anchors: map[ct.Root]csys.SequenceAnchor{}}
	for k, r := range s.view.records {
		v.records[k] = r
	}
	for k, a := range s.view.anchors {
		v.anchors[k] = a
	}
	if _, _, err = v.add(s.trust, s.signatures, r); err != nil {
		return err
	}
	h := s.history
	h.Pending = &r
	s.ready = false
	return s.save(h)
}
func (s *Settlement) validateJournal() (csys.SequenceAnchor, bool, error) {
	a, ok, err := s.sequences.Store.Load()
	if err != nil {
		if s.options.RepairSequence {
			return a, false, nil
		}
		return a, false, fmt.Errorf("explicit verified sequence recovery required: %w", err)
	}
	if !ok {
		if len(s.history.Entries) > 0 && !s.options.RepairSequence {
			return a, false, csys.ErrSequenceStateMissing
		}
		return a, false, nil
	}
	if a.ChainID != s.trust.ChainID {
		return a, false, fmt.Errorf("journal chain mismatch")
	}
	committed := s.view.anchors[s.view.tracker.Status().Head.Root]
	if a == committed {
		return a, true, nil
	}
	if s.history.Pending != nil {
		v, err := s.speculative()
		if err != nil {
			return a, false, err
		}
		pending := v.anchors[s.history.Pending.Consensus.Header.HashTreeRoot()]
		if a == pending {
			return a, true, nil
		} // crash after cursor fsync, before history commit
	}
	if s.options.RepairSequence {
		return a, false, nil
	}
	return a, false, fmt.Errorf("stale or conflicting journal requires explicit verified recovery")
}
func (s *Settlement) forkchoice(v *view) eng.ForkchoiceStateV1 {
	st := v.tracker.Status()
	return eng.ForkchoiceStateV1{HeadBlockHash: Hash(v.anchors[st.Head.Root].BlockHash), SafeBlockHash: Hash(v.anchors[st.Safe.Root].BlockHash), FinalizedBlockHash: Hash(v.anchors[st.Finalized.Root].BlockHash)}
}

var errExecutionRejected = errors.New("execution rejected certified settlement; restart reconciliation required")

func valid(status eng.PayloadStatusV1, hash eng.Hash32) error {
	if status.Status == "INVALID" || status.Status == "INVALID_BLOCK_HASH" {
		return fmt.Errorf("%w: %s", errExecutionRejected, status.Status)
	}
	if status.Status != "VALID" || status.LatestValidHash == nil || *status.LatestValidHash != hash || status.ValidationError != nil {
		return fmt.Errorf("unverified execution transition: %s", status.Status)
	}
	return nil
}

// Reconcile rebuilds only authenticated, selected history. Local cursors and RPC
// heads can confirm that history, never replace it or roll back its finality.
func (s *Settlement) Reconcile(ctx context.Context) (err error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	defer func() {
		// Transport outages/SYNCING are retried. Deterministic rejection and
		// authenticated RPC/protocol failures latch a halt, never process later
		// records or repeatedly execute a rejected transition.
		if err != nil && (errors.Is(err, errExecutionRejected) || errors.Is(err, eng.ErrRPC) || errors.Is(err, eng.ErrUnauthorized)) {
			s.fatal = err
		}
	}()
	wasReady := s.ready
	s.ready = false
	if s.fatal != nil {
		return s.fatal
	}
	journal, present, err := s.validateJournal()
	if err != nil {
		return err
	}
	v, err := s.speculative()
	if err != nil {
		return err
	}
	required := []string{"engine_newPayloadV3", "engine_forkchoiceUpdatedV3", "engine420_submitSystemCallsV1", "engine420_replaceSystemCallsV1"}
	caps, err := s.engine.ExchangeCapabilities(ctx, required)
	if err != nil {
		return err
	}
	for _, want := range required {
		found := false
		for _, got := range caps {
			if got == want {
				found = true
				break
			}
		}
		if !found {
			return fmt.Errorf("required execution recovery capability missing: %s", want)
		}
	}
	// Verify the independently pinned genesis before sending any mutating Engine request.
	genesis, err := s.engine.CanonicalSequenceAnchor(ctx, s.trust.ChainID, 0, s.trust.Execution.BlockHash)
	if err != nil {
		return err
	}
	if genesis != s.trust.Execution {
		return fmt.Errorf("genesis gateway sequence divergence")
	}
	var genesisHeader *struct{ Timestamp string }
	if err = s.engine.Call(ctx, "eth_getBlockByNumber", []any{"0x0", false}, &genesisHeader); err != nil {
		return err
	}
	if genesisHeader == nil || genesisHeader.Timestamp != fmt.Sprintf("0x%x", s.trust.Timestamp) {
		return fmt.Errorf("pinned consensus genesis timestamp mismatch")
	}
	var latest *struct {
		Hash   eng.Hash32
		Number string
	}
	if err = s.engine.Call(ctx, "eth_getBlockByNumber", []any{"latest", false}, &latest); err != nil {
		return err
	}
	if latest == nil {
		return fmt.Errorf("execution latest checkpoint missing")
	}
	known := false
	for _, a := range v.anchors {
		if Hash(a.BlockHash) == latest.Hash && fmt.Sprintf("0x%x", a.ExecutionBlock) == latest.Number {
			known = true
			break
		}
	}
	if !known {
		return fmt.Errorf("execution head is outside authenticated consensus history")
	}
	// A populated finalized height with another hash is divergence, not permission
	// to reorg across finality. A rewound DB may lack the height and be rebuilt.
	finalized := s.view.anchors[s.view.tracker.Status().Finalized.Root]
	var finalBlock *struct{ Hash eng.Hash32 }
	if err = s.engine.Call(ctx, "eth_getBlockByNumber", []any{fmt.Sprintf("0x%x", finalized.ExecutionBlock), false}, &finalBlock); err != nil {
		return err
	}
	if finalBlock != nil && finalBlock.Hash != Hash(finalized.BlockHash) {
		return ErrFinalized
	}
	// Establish the independently pinned genesis high-water before the first
	// settlement. This also covers a daemon first started while execution was
	// unavailable and given a pending certificate before Engine became reachable.
	if len(s.history.Entries) == 0 {
		if _, er := os.Stat(filepath.Join(s.dir, "checkpoint.json")); errors.Is(er, os.ErrNotExist) {
			if er = s.writeCheckpoint(s.view); er != nil {
				return er
			}
		} else if er != nil {
			return er
		}
	}
	target := v.anchors[v.tracker.Status().Head.Root]
	// A healthy idle follower verifies the canonical cursor, without reimporting
	// its entire authenticated history or fsyncing unchanged checkpoints each tick.
	if wasReady && s.history.Pending == nil && present && journal == target && latest.Hash == Hash(target.BlockHash) {
		if confirmed, er := s.engine.CanonicalSequenceAnchor(ctx, target.ChainID, target.ExecutionBlock, target.BlockHash); er == nil {
			if confirmed != target {
				return fmt.Errorf("canonical gateway sequence conflicts with certified history")
			}
			if r, ok := v.records[v.tracker.Status().Head.Root]; ok {
				parent := v.anchors[r.Consensus.Header.ParentConsensusRoot]
				if er = s.engine.VerifyCanonicalBatch(ctx, target.BlockHash, r.Consensus.SystemCallBatch(s.trust.ChainID, parent.ExecutionBlock+1, parent.BlockHash)); er != nil {
					return er
				}
			}
			s.ready = true
			return nil
		}
		// State may have been lost on execution restart despite retained headers;
		// fall through to authenticated reconstruction rather than trusting them.
	}
	path, err := v.path(s.trust, v.tracker.Status().Head.Root)
	if err != nil {
		return err
	}
	// Stage all required ancestors first: Geth may retain payload records but have
	// rewound its path-state head. SetCanonical can then reconstruct the exact chain.
	for _, r := range path {
		parent := v.anchors[r.Consensus.Header.ParentConsensusRoot]
		batch, er := csys.BuildStakeBatch(csys.DerivationContext{ChainID: s.trust.ChainID, ExecutionBlock: parent.ExecutionBlock + 1, ParentHash: parent.BlockHash}, parent.LastSequence, r.Outcomes)
		if er != nil {
			return er
		}
		if er = s.engine.StageSystemCallBatch(ctx, batch, parent.LastSequence); er != nil {
			if batch.ExecutionBlock <= finalized.ExecutionBlock {
				return er
			}
			if er = s.engine.ReplaceSystemCallBatch(ctx, batch, parent.LastSequence); er != nil {
				return er
			}
		}
	}
	// Recover the deepest retained payload's state before importing a new child.
	// A known payload can return VALID even when its parent StateDB was lost;
	// importing an unknown child first would otherwise remain ACCEPTED forever.
	prefix := s.trust.Execution
	for _, r := range path {
		var retained *struct{ Hash eng.Hash32 }
		if err = s.engine.Call(ctx, "eth_getBlockByHash", []any{r.Payload.BlockHash, false}, &retained); err != nil {
			return err
		}
		if retained == nil {
			break
		}
		if retained.Hash != r.Payload.BlockHash {
			return fmt.Errorf("retained execution identity mismatch")
		}
		prefix = v.anchors[r.Consensus.Header.HashTreeRoot()]
	}
	if prefix.ExecutionBlock > 0 {
		if prefix.ExecutionBlock < finalized.ExecutionBlock {
			return ErrFinalized
		}
		floor := finalized
		if prefix == target {
			floor = v.anchors[v.tracker.Status().Finalized.Root]
		}
		resp, er := s.engine.ForkchoiceUpdatedV3(ctx, eng.ForkchoiceStateV1{HeadBlockHash: Hash(prefix.BlockHash), SafeBlockHash: Hash(prefix.BlockHash), FinalizedBlockHash: Hash(floor.BlockHash)}, nil)
		if er != nil {
			return er
		}
		if er = valid(resp.PayloadStatus, Hash(prefix.BlockHash)); er != nil {
			return er
		}
	}
	for _, r := range path {
		parent := v.anchors[r.Consensus.Header.ParentConsensusRoot]
		batch := r.Consensus.SystemCallBatch(s.trust.ChainID, parent.ExecutionBlock+1, parent.BlockHash)
		var status eng.PayloadStatusV1
		var er error
		if s.history.Pending != nil && r.Consensus.Header.HashTreeRoot() == s.history.Pending.Consensus.Header.HashTreeRoot() && present && journal == parent {
			// Live append uses the same verified parent/journal construction
			// boundary as proposer/received-payload validation. Replay of older
			// certified ancestors cannot require today's cursor to equal theirs.
			var derived csys.Batch
			status, derived, er = s.engine.NewPayloadV3WithFinalizedStakeOutcomes(ctx, r.Payload, r.VersionedHashes, r.ParentBeaconBlockRoot, s.sequences, parent, r.Outcomes)
			if er == nil && derived.Root() != batch.Root() {
				return fmt.Errorf("verified derivation differs from certified history")
			}
		} else {
			status, er = s.engine.NewPayloadV3WithSystemCalls(ctx, r.Payload, r.VersionedHashes, r.ParentBeaconBlockRoot, batch, parent.LastSequence)
		}
		if er != nil {
			if status.Status == "INVALID" || status.Status == "INVALID_BLOCK_HASH" {
				detail := ""
				if status.ValidationError != nil {
					detail = *status.ValidationError
				}
				return fmt.Errorf("%w: %s: %v: %s", errExecutionRejected, status.Status, er, detail)
			}
			return er
		}
		if er = valid(status, r.Payload.BlockHash); er != nil {
			return er
		}
	}
	response, err := s.engine.ForkchoiceUpdatedV3(ctx, s.forkchoice(v), nil)
	if err != nil {
		return err
	}
	if err = valid(response.PayloadStatus, Hash(target.BlockHash)); err != nil {
		return err
	}
	actual, err := s.engine.CanonicalSequenceAnchor(ctx, target.ChainID, target.ExecutionBlock, target.BlockHash)
	if err != nil {
		return err
	}
	if actual != target {
		return fmt.Errorf("canonical gateway sequence conflicts with certified history")
	}
	// Validate *every* reconstructed header's commitment, not just its cursor.
	for _, r := range path {
		parent := v.anchors[r.Consensus.Header.ParentConsensusRoot]
		batch := r.Consensus.SystemCallBatch(s.trust.ChainID, parent.ExecutionBlock+1, parent.BlockHash)
		if err = s.engine.VerifyCanonicalBatch(ctx, r.Consensus.Header.ExecutionPayloadHash, batch); err != nil {
			return err
		}
	}
	if s.history.Pending != nil && s.options.AfterCanonical != nil {
		raw, _ := json.Marshal(s.history.Pending)
		var observation Record
		if err = Decode(raw, &observation); err != nil {
			return err
		}
		s.options.AfterCanonical(observation)
	}
	if s.history.Pending == nil {
		if !present || journal != target {
			if _, err = s.engine.RecoverVerifiedSequence(ctx, s.sequences, target.ChainID, target.ExecutionBlock, target.BlockHash); err != nil {
				return err
			}
		}
		// Materialize a durable empty genesis history at first verified bootstrap.
		if _, err = os.Stat(filepath.Join(s.dir, "history.json")); errors.Is(err, os.ErrNotExist) {
			if err = s.save(s.history); err != nil {
				return err
			}
		}
		if err = s.writeCheckpoint(s.view); err != nil {
			return err
		}
		s.ready = true
		return nil
	}
	r := *s.history.Pending
	parent := v.anchors[r.Consensus.Header.ParentConsensusRoot]
	batch := r.Consensus.SystemCallBatch(s.trust.ChainID, parent.ExecutionBlock+1, parent.BlockHash)
	if present && journal == target {
		// Idempotent recovery after cursor commit: validate the exact selected target,
		// then finish the pending history checkpoint without executing its effects twice.
		if _, err = s.engine.RecoverVerifiedSequence(ctx, s.sequences, target.ChainID, target.ExecutionBlock, target.BlockHash); err != nil {
			return err
		}
	} else {
		if !present || journal != parent {
			if _, err = s.engine.RecoverVerifiedSequence(ctx, s.sequences, parent.ChainID, parent.ExecutionBlock, parent.BlockHash); err != nil {
				return err
			}
		}
		if _, err = s.engine.CommitVerifiedSequence(ctx, s.sequences, parent, target.BlockHash, batch, response.PayloadStatus); err != nil {
			return err
		}
	}
	h := s.history
	h.Entries = append(append([]Record(nil), h.Entries...), r)
	h.Pending = nil
	if err = s.save(h); err != nil {
		return err
	}
	if err = s.writeCheckpoint(v); err != nil {
		return err
	}
	s.view = v
	s.ready = true
	return nil
}
