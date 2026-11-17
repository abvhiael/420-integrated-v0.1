package slashing

import (
	"bytes"
	"crypto/sha256"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"syscall"

	ctypes "github.com/420integrated/420-integrated/consensus/types"
)

// HistoryIdentity binds one journal to one validator key and network genesis.
// Protocol upgrades must retain this history, not create a new empty journal.
type HistoryIdentity struct {
	ChainID     uint64
	Genesis     ctypes.Root
	ValidatorID uint64
	PublicKey   ctypes.BLSPubkey
}

type voteRecord struct {
	ValidatorID uint64
	Data        ctypes.AttestationData
	Root        ctypes.Root
}

type signedRecord struct {
	ValidatorID uint64
	Type        string
	Slot        uint64
	Incident    ctypes.Root
	Root        ctypes.Root
}

type historyPayload struct {
	Schema   string
	Identity HistoryIdentity
	Signed   []signedRecord
	Votes    []voteRecord
}

type historyFile struct {
	Payload  historyPayload
	Checksum [32]byte
}

type durableHistory struct {
	path     string
	identity HistoryIdentity
	lock     *os.File
	expected [32]byte
}

var ErrHistoryUnavailable = errors.New("protected signing history unavailable")

func (d *durableHistory) checkIdentity(id uint64) error {
	if id != d.identity.ValidatorID {
		return ErrInvalidDuty
	}
	return nil
}

// InitializeHistory is an explicit, one-time provisioning operation for a key
// that has NEVER signed. Existing keys require an independently verified complete
// history. It never replaces an existing file.
func InitializeHistory(path string, id HistoryIdentity) error {
	d, err := lockHistory(path, id)
	if err != nil {
		return err
	}
	defer d.close()
	if _, err := os.Lstat(path); !errors.Is(err, os.ErrNotExist) {
		return fmt.Errorf("%w: history already exists or cannot be inspected", ErrHistoryUnavailable)
	}
	return d.write(historyPayload{Schema: "420-slashing-history-v1", Identity: id}, true)
}

// OpenProtector never creates or resets signing history. The exclusive process
// lock must remain held for the entire lifetime of this protector.
func OpenProtector(path string, id HistoryIdentity) (*Protector, error) {
	d, err := lockHistory(path, id)
	if err != nil {
		return nil, err
	}
	p := NewProtector()
	payload, err := d.read()
	if err != nil {
		d.close()
		return nil, err
	}
	for _, r := range payload.Signed {
		k := messageKey{ValidatorID: r.ValidatorID, Type: r.Type, Slot: r.Slot, Incident: r.Incident}
		var e error
		switch r.Type {
		case "proposal":
			if r.Incident != (ctypes.Root{}) {
				e = ErrInvalidDuty
			} else {
				e = p.CheckAndRecordProposal(r.ValidatorID, r.Slot, r.Root)
			}
		case "qc-vote", "attestation-data":
			if r.Incident != (ctypes.Root{}) {
				e = ErrInvalidDuty
			} else {
				e = p.check(k, r.Root, ErrDoubleAttestation)
			}
		case "recovery":
			if r.Slot != 0 {
				e = ErrInvalidDuty
			} else {
				e = p.CheckAndRecordRecovery(r.ValidatorID, r.Incident, r.Root)
			}
		default:
			e = ErrInvalidDuty
		}
		if e != nil || r.ValidatorID != id.ValidatorID || p.signed[k] != r.Root {
			d.close()
			return nil, fmt.Errorf("%w: invalid stored duty", ErrHistoryUnavailable)
		}
	}
	for _, v := range payload.Votes {
		if v.ValidatorID != id.ValidatorID || v.Root != v.Data.HashTreeRoot() || p.CheckAndRecordVote(v.ValidatorID, v.Data) != nil {
			d.close()
			return nil, fmt.Errorf("%w: invalid stored vote", ErrHistoryUnavailable)
		}
	}
	b, err := json.Marshal(payload)
	if err != nil {
		d.close()
		return nil, err
	}
	d.expected = sha256.Sum256(b)
	p.disk = d
	return p, nil
}

func lockHistory(path string, id HistoryIdentity) (*durableHistory, error) {
	if path == "" || id.ChainID == 0 || id.Genesis == (ctypes.Root{}) || id.PublicKey == (ctypes.BLSPubkey{}) {
		return nil, ErrInvalidDuty
	}
	abs, err := filepath.Abs(path)
	if err != nil {
		return nil, err
	}
	// Reject aliased directory paths and symlinks. Operators must use a private
	// directory on a local filesystem with durable fsync and flock semantics.
	dir := filepath.Dir(abs)
	resolved, err := filepath.EvalSymlinks(dir)
	if err != nil || resolved != dir {
		return nil, ErrHistoryUnavailable
	}
	st, err := os.Stat(dir)
	if err != nil || !st.IsDir() || st.Mode().Perm()&0077 != 0 {
		return nil, ErrHistoryUnavailable
	}
	f, err := os.OpenFile(abs+".lock", os.O_CREATE|os.O_RDWR|syscall.O_NOFOLLOW, 0600)
	if err != nil {
		return nil, err
	}
	st, err = f.Stat()
	if err != nil || !st.Mode().IsRegular() || st.Mode().Perm()&0077 != 0 {
		f.Close()
		return nil, ErrHistoryUnavailable
	}
	if err = syscall.Flock(int(f.Fd()), syscall.LOCK_EX|syscall.LOCK_NB); err != nil {
		f.Close()
		return nil, fmt.Errorf("%w: already locked: %v", ErrHistoryUnavailable, err)
	}
	return &durableHistory{path: abs, identity: id, lock: f}, nil
}

func (d *durableHistory) close() error { return d.lock.Close() }

// Close permanently disables this instance before releasing its exclusive lock.
func (p *Protector) Close() error {
	p.mu.Lock()
	defer p.mu.Unlock()
	p.failed = ErrHistoryUnavailable
	if p.disk == nil {
		return nil
	}
	e := p.disk.close()
	p.disk = nil
	return e
}

func (d *durableHistory) read() (historyPayload, error) {
	var h historyFile
	f, e := os.OpenFile(d.path, os.O_RDONLY|syscall.O_NOFOLLOW, 0)
	if e != nil {
		return h.Payload, fmt.Errorf("%w: %v", ErrHistoryUnavailable, e)
	}
	defer f.Close()
	st, e := f.Stat()
	if e != nil || !st.Mode().IsRegular() || st.Mode().Perm()&0077 != 0 {
		return h.Payload, ErrHistoryUnavailable
	}
	raw, e := io.ReadAll(f)
	if e != nil {
		return h.Payload, e
	}
	if e = uniqueHistoryKeys(raw); e != nil {
		return h.Payload, ErrHistoryUnavailable
	}
	dec := json.NewDecoder(bytes.NewReader(raw))
	dec.DisallowUnknownFields()
	if e = dec.Decode(&h); e != nil {
		return h.Payload, ErrHistoryUnavailable
	}
	if e = dec.Decode(new(any)); e != io.EOF {
		return h.Payload, ErrHistoryUnavailable
	}
	b, e := json.Marshal(h.Payload)
	if e != nil || sha256.Sum256(b) != h.Checksum || h.Payload.Schema != "420-slashing-history-v1" || h.Payload.Identity != d.identity {
		return h.Payload, ErrHistoryUnavailable
	}
	return h.Payload, nil
}

func (d *durableHistory) write(p historyPayload, initialize bool) error {
	b, e := json.Marshal(p)
	if e != nil {
		return e
	}
	raw, e := json.Marshal(historyFile{Payload: p, Checksum: sha256.Sum256(b)})
	if e != nil {
		return e
	}
	dir := filepath.Dir(d.path)
	tmp, e := os.CreateTemp(dir, ".slashing-")
	if e != nil {
		return e
	}
	defer os.Remove(tmp.Name())
	defer tmp.Close()
	qualificationHistoryWrite(tmp, raw)
	if _, e = tmp.Write(raw); e != nil {
		return e
	}
	if e = tmp.Sync(); e != nil {
		return e
	}
	if e = tmp.Close(); e != nil {
		return e
	}
	if initialize {
		e = os.Link(tmp.Name(), d.path)
	} else {
		e = os.Rename(tmp.Name(), d.path)
	}
	if e != nil {
		return e
	}
	f, e := os.Open(dir)
	if e != nil {
		return e
	}
	defer f.Close()
	return f.Sync()
}

// CheckAndRecordVote derives the protected root from the full attestation,
// checking both slot and target checkpoint double votes and strict surrounds.
func (p *Protector) CheckAndRecordVote(id uint64, data ctypes.AttestationData) error {
	p.mu.Lock()
	defer p.mu.Unlock()
	if e := p.checkHistoryLocked(); e != nil {
		return e
	}
	if p.disk != nil {
		if e := p.disk.checkIdentity(id); e != nil {
			return e
		}
	}
	if data.Source.Slot >= data.Target.Slot || data.Target.Slot > data.Slot || data.BlockRoot == (ctypes.Root{}) || data.Target.Root == (ctypes.Root{}) || data.Source.Root == (ctypes.Root{}) {
		return ErrInvalidDuty
	}
	root := data.HashTreeRoot()
	for _, v := range p.votes {
		if v.ValidatorID != id {
			continue
		}
		if v.Data == data {
			return nil
		}
		if v.Data.Slot == data.Slot || v.Data.Target.Slot == data.Target.Slot {
			return ErrDoubleAttestation
		}
		if (v.Data.Source.Slot < data.Source.Slot && data.Target.Slot < v.Data.Target.Slot) || (data.Source.Slot < v.Data.Source.Slot && v.Data.Target.Slot < data.Target.Slot) {
			return ErrSurroundVote
		}
	}
	p.votes = append(p.votes, voteRecord{ValidatorID: id, Data: data, Root: root})
	return p.persistLocked()
}

func (p *Protector) persistLocked() error {
	if p.disk == nil {
		return nil
	}
	h := historyPayload{Schema: "420-slashing-history-v1", Identity: p.disk.identity, Votes: p.votes}
	for k, r := range p.signed {
		h.Signed = append(h.Signed, signedRecord{ValidatorID: k.ValidatorID, Type: k.Type, Slot: k.Slot, Incident: k.Incident, Root: r})
	}
	sort.Slice(h.Signed, func(i, j int) bool {
		a, b := h.Signed[i], h.Signed[j]
		if a.Type != b.Type {
			return a.Type < b.Type
		}
		if a.Slot != b.Slot {
			return a.Slot < b.Slot
		}
		return bytes.Compare(a.Incident[:], b.Incident[:]) < 0
	})
	// Check the current durable file has not vanished or changed before replacing it.
	if e := p.checkHistoryLocked(); e != nil {
		return e
	}
	if e := p.disk.write(h, false); e != nil {
		p.failed = fmt.Errorf("%w: %v", ErrHistoryUnavailable, e)
		return p.failed
	}
	b, e := json.Marshal(h)
	if e != nil {
		p.failed = ErrHistoryUnavailable
		return p.failed
	}
	p.disk.expected = sha256.Sum256(b)
	return nil
}

// checkHistoryLocked verifies even idempotent retries against the last committed file.
func (p *Protector) checkHistoryLocked() error {
	if p.failed != nil {
		return p.failed
	}
	if p.disk == nil {
		return nil
	}
	h, e := p.disk.read()
	if e != nil {
		p.failed = fmt.Errorf("%w: %v", ErrHistoryUnavailable, e)
		return p.failed
	}
	b, e := json.Marshal(h)
	if e != nil || sha256.Sum256(b) != p.disk.expected {
		p.failed = ErrHistoryUnavailable
		return p.failed
	}
	return nil
}

// Snapshot returns canonical, integrity-checked complete history for an
// independently administered rollback witness. No private key is included.
func (p *Protector) Snapshot() ([]byte, error) {
	p.mu.Lock()
	defer p.mu.Unlock()
	if p.disk == nil {
		return nil, ErrHistoryUnavailable
	}
	if err := p.checkHistoryLocked(); err != nil {
		return nil, err
	}
	payload, err := p.disk.read()
	if err != nil {
		return nil, err
	}
	b, err := json.Marshal(payload)
	if err != nil {
		return nil, err
	}
	return json.Marshal(historyFile{Payload: payload, Checksum: sha256.Sum256(b)})
}

// RestoreWitnessHistory is an explicit recovery operation, never a startup
// fallback. The caller must hold the independent witness lock and authenticate
// the witness. Complete history is semantically revalidated before replacement.
func RestoreWitnessHistory(path string, id HistoryIdentity, raw []byte) error {
	d, err := lockHistory(path, id)
	if err != nil {
		return err
	}
	defer d.close()
	f, err := os.CreateTemp(filepath.Dir(d.path), ".witness-restore-")
	if err != nil {
		return err
	}
	name := f.Name()
	defer os.Remove(name)
	defer os.Remove(name + ".lock")
	if _, err = f.Write(raw); err != nil {
		f.Close()
		return err
	}
	if err = f.Close(); err != nil {
		return err
	}
	validated, err := OpenProtector(name, id)
	if err != nil {
		return err
	}
	payload, err := validated.disk.read()
	closeErr := validated.Close()
	if err != nil {
		return err
	}
	if closeErr != nil {
		return closeErr
	}
	return d.write(payload, false)
}

// CheckAndRecordSigningVote additionally binds a reserved vote to the actual
// frozen signing domain/context. Committee changes cannot produce a second QC
// signing root for an identical attestation at the same slot.
func (p *Protector) CheckAndRecordSigningVote(id uint64, data ctypes.AttestationData, root ctypes.Root, kind string) error {
	if kind != "qc-vote" && kind != "attestation-data" {
		return ErrInvalidDuty
	}
	if err := p.CheckAndRecordVote(id, data); err != nil {
		return err
	}
	return p.check(messageKey{ValidatorID: id, Type: kind, Slot: data.Slot}, root, ErrDoubleAttestation)
}

// HistoryIdentity returns the durable identity; volatile protectors cannot be
// used by the production remote signing boundary.
func (p *Protector) HistoryIdentity() (HistoryIdentity, error) {
	p.mu.Lock()
	defer p.mu.Unlock()
	if p.disk == nil {
		return HistoryIdentity{}, ErrHistoryUnavailable
	}
	if err := p.checkHistoryLocked(); err != nil {
		return HistoryIdentity{}, err
	}
	return p.disk.identity, nil
}
func (p *Protector) Unused() (bool, error) {
	p.mu.Lock()
	defer p.mu.Unlock()
	if p.disk == nil {
		return false, ErrHistoryUnavailable
	}
	if err := p.checkHistoryLocked(); err != nil {
		return false, err
	}
	return len(p.signed) == 0 && len(p.votes) == 0, nil
}

// JSON field names are case-insensitive for Go structs. Reject duplicate keys
// before semantic decoding so a corrupt journal cannot provide two histories.
func uniqueHistoryKeys(raw []byte) error {
	d := json.NewDecoder(bytes.NewReader(raw))
	var walk func() error
	walk = func() error {
		token, err := d.Token()
		if err != nil {
			return err
		}
		delim, ok := token.(json.Delim)
		if !ok {
			return nil
		}
		switch delim {
		case '{':
			seen := map[string]bool{}
			for d.More() {
				token, err = d.Token()
				if err != nil {
					return err
				}
				key, ok := token.(string)
				if !ok || seen[strings.ToLower(key)] {
					return ErrHistoryUnavailable
				}
				seen[strings.ToLower(key)] = true
				if err = walk(); err != nil {
					return err
				}
			}
		case '[':
			for d.More() {
				if err = walk(); err != nil {
					return err
				}
			}
		default:
			return ErrHistoryUnavailable
		}
		_, err = d.Token()
		return err
	}
	if err := walk(); err != nil {
		return err
	}
	if _, err := d.Token(); err != io.EOF {
		return ErrHistoryUnavailable
	}
	return nil
}
