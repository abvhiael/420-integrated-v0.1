package store

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/420integrated/420-integrated/verify/compiler"
	"github.com/420integrated/420-integrated/verify/evidence"
	"github.com/420integrated/420-integrated/verify/matcher"
	"github.com/420integrated/420-integrated/verify/submission"
)

const Phase = "VERIFY-6"
const schema = "420-verify-evidence-v1"

type Record struct {
	Schema         string                      `json:"schema"`
	Sequence       uint64                      `json:"sequence"`
	RecordHash     string                      `json:"recordHash"`
	StoredAt       time.Time                   `json:"storedAt"`
	BindingKey     string                      `json:"bindingKey"`
	Deployment     evidence.DeploymentEvidence `json:"deployment"`
	Submission     submission.Submission       `json:"submission"`
	Build          compiler.BuildEvidence      `json:"build"`
	Classification matcher.Result              `json:"classification"`
}

type Store struct {
	root    string
	mu      sync.RWMutex
	history map[string][]Record
}

func Open(root string) (*Store, error) {
	if strings.TrimSpace(root) == "" {
		return nil, errors.New("evidence store path is required")
	}
	if err := os.MkdirAll(root, 0o750); err != nil {
		return nil, err
	}
	s := &Store{root: root, history: map[string][]Record{}}
	if err := s.rebuild(); err != nil {
		return nil, err
	}
	return s, nil
}

func (s *Store) Append(deployment evidence.DeploymentEvidence, submitted submission.Submission, build compiler.BuildEvidence, result matcher.Result) (Record, error) {
	if err := deployment.Validate(); err != nil {
		return Record{}, fmt.Errorf("deployment evidence: %w", err)
	}
	if err := submitted.ValidateCommitment(); err != nil {
		return Record{}, fmt.Errorf("submission evidence: %w", err)
	}
	binding := deployment.BindingKey()
	if result.BindingKey != binding {
		return Record{}, errors.New("classification binding key does not match deployment evidence")
	}

	s.mu.Lock()
	defer s.mu.Unlock()
	seq := uint64(len(s.history[binding]) + 1)
	record := Record{
		Schema: schema, Sequence: seq, StoredAt: time.Now().UTC(), BindingKey: binding,
		Deployment: deployment, Submission: submitted, Build: build, Classification: result,
	}
	hash, err := recordHash(record)
	if err != nil {
		return Record{}, err
	}
	record.RecordHash = hash
	data, err := json.MarshalIndent(record, "", "  ")
	if err != nil {
		return Record{}, err
	}

	dir := filepath.Join(s.root, keyDir(binding))
	if err := os.MkdirAll(dir, 0o750); err != nil {
		return Record{}, err
	}
	name := fmt.Sprintf("%020d-%s.json", seq, strings.TrimPrefix(hash, "sha256:")[:16])
	final := filepath.Join(dir, name)
	tmp, err := os.CreateTemp(dir, ".record-*.tmp")
	if err != nil {
		return Record{}, err
	}
	tmpName := tmp.Name()
	cleanup := func() { _ = os.Remove(tmpName) }
	defer cleanup()
	if err := tmp.Chmod(0o640); err != nil { _ = tmp.Close(); return Record{}, err }
	if _, err := tmp.Write(data); err != nil { _ = tmp.Close(); return Record{}, err }
	if err := tmp.Sync(); err != nil { _ = tmp.Close(); return Record{}, err }
	if err := tmp.Close(); err != nil { return Record{}, err }
	if err := os.Rename(tmpName, final); err != nil { return Record{}, err }

	s.history[binding] = append(s.history[binding], record)
	return cloneRecord(record), nil
}

func (s *Store) History(bindingKey string) []Record {
	s.mu.RLock()
	defer s.mu.RUnlock()
	items := s.history[bindingKey]
	out := make([]Record, len(items))
	for i := range items { out[i] = cloneRecord(items[i]) }
	return out
}

func (s *Store) Latest(bindingKey string) (Record, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	items := s.history[bindingKey]
	if len(items) == 0 { return Record{}, false }
	return cloneRecord(items[len(items)-1]), true
}

func (s *Store) Bindings() []string {
	s.mu.RLock()
	defer s.mu.RUnlock()
	out := make([]string, 0, len(s.history))
	for key := range s.history { out = append(out, key) }
	sort.Strings(out)
	return out
}

func (s *Store) rebuild() error {
	entries, err := os.ReadDir(s.root)
	if err != nil { return err }
	for _, entry := range entries {
		if !entry.IsDir() { continue }
		dir := filepath.Join(s.root, entry.Name())
		files, err := os.ReadDir(dir)
		if err != nil { return err }
		var records []Record
		for _, file := range files {
			if file.IsDir() || !strings.HasSuffix(file.Name(), ".json") { continue }
			data, err := os.ReadFile(filepath.Join(dir, file.Name()))
			if err != nil { return err }
			var record Record
			if err := json.Unmarshal(data, &record); err != nil { return fmt.Errorf("decode evidence record %s: %w", file.Name(), err) }
			if err := validateRecord(record); err != nil { return fmt.Errorf("invalid evidence record %s: %w", file.Name(), err) }
			if keyDir(record.BindingKey) != entry.Name() { return fmt.Errorf("evidence record %s stored under wrong binding directory", file.Name()) }
			records = append(records, record)
		}
		sort.Slice(records, func(i, j int) bool { return records[i].Sequence < records[j].Sequence })
		for i, record := range records {
			if record.Sequence != uint64(i+1) { return fmt.Errorf("non-contiguous evidence history for %s", record.BindingKey) }
			if i > 0 && records[i-1].BindingKey != record.BindingKey { return errors.New("mixed binding keys in evidence directory") }
		}
		if len(records) > 0 { s.history[records[0].BindingKey] = records }
	}
	return nil
}

func validateRecord(record Record) error {
	if record.Schema != schema { return errors.New("unsupported evidence schema") }
	if record.Sequence == 0 { return errors.New("record sequence is required") }
	if record.BindingKey == "" || record.BindingKey != record.Deployment.BindingKey() { return errors.New("record binding mismatch") }
	if record.Classification.BindingKey != record.BindingKey { return errors.New("classification binding mismatch") }
	if err := record.Deployment.Validate(); err != nil { return err }
	if err := record.Submission.ValidateCommitment(); err != nil { return err }
	expected, err := recordHash(record)
	if err != nil { return err }
	if record.RecordHash != expected { return errors.New("record content hash mismatch") }
	return nil
}

func recordHash(record Record) (string, error) {
	copy := record
	copy.RecordHash = ""
	data, err := json.Marshal(copy)
	if err != nil { return "", err }
	sum := sha256.Sum256(data)
	return "sha256:" + hex.EncodeToString(sum[:]), nil
}

func keyDir(binding string) string {
	sum := sha256.Sum256([]byte(binding))
	return hex.EncodeToString(sum[:])
}

func cloneRecord(record Record) Record {
	data, _ := json.Marshal(record)
	var out Record
	_ = json.Unmarshal(data, &out)
	return out
}

func ParseBindingKey(chainID uint64, address, runtimeCodeHash string) string {
	return strconv.FormatUint(chainID, 10) + ":" + strings.ToLower(address) + ":" + strings.ToLower(runtimeCodeHash)
}
