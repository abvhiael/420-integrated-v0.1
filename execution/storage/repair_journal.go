package storage

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"sync"
	"time"
)

var ErrRepairJournal = errors.New("repair journal failed")

type RepairJobStage string

const (
	RepairStagePlanned      RepairJobStage = "planned"
	RepairStageAgreement    RepairJobStage = "agreement"
	RepairStageCommitment   RepairJobStage = "commitment"
	RepairStageCapacity     RepairJobStage = "capacity"
	RepairStageActivated    RepairJobStage = "activated"
	RepairStageTransferred  RepairJobStage = "transferred"
	RepairStageReplaced     RepairJobStage = "replaced"
	RepairStageFailed       RepairJobStage = "failed"
)

type RepairJobEvent struct {
	JobID         string         `json:"jobId"`
	ManifestID    string         `json:"manifestId"`
	ShardIndex    uint32         `json:"shardIndex"`
	Stage         RepairJobStage `json:"stage"`
	Attempt       uint32         `json:"attempt"`
	AgreementID   string         `json:"agreementId,omitempty"`
	CommitmentID  string         `json:"commitmentId,omitempty"`
	ReservationID string         `json:"reservationId,omitempty"`
	NodeID        string         `json:"nodeId,omitempty"`
	Error         string         `json:"error,omitempty"`
	At            time.Time      `json:"at"`
}

type RepairJobState struct {
	JobID         string
	ManifestID    string
	ShardIndex    uint32
	Stage         RepairJobStage
	Attempt       uint32
	AgreementID   string
	CommitmentID  string
	ReservationID string
	NodeID        string
	LastError     string
	UpdatedAt     time.Time
	Complete      bool
}

type RepairJournal interface {
	AppendRepairEvent(ctx context.Context, event RepairJobEvent) error
	RepairEvents(ctx context.Context, jobID string) ([]RepairJobEvent, error)
}

func RepairJobID(manifestID string, shardIndex uint32) string {
	return wordHex(keccak256([]byte(fmt.Sprintf("420/REPAIR/JOB/V1|%s|%d", strings.ToLower(strings.TrimSpace(manifestID)), shardIndex))))
}

func RebuildRepairJobState(events []RepairJobEvent) (RepairJobState, error) {
	if len(events) == 0 {
		return RepairJobState{}, ErrRepairJournal
	}
	ordered := append([]RepairJobEvent(nil), events...)
	sort.SliceStable(ordered, func(i, j int) bool { return ordered[i].At.Before(ordered[j].At) })
	first := ordered[0]
	if strings.TrimSpace(first.JobID) == "" || strings.TrimSpace(first.ManifestID) == "" {
		return RepairJobState{}, ErrRepairJournal
	}
	state := RepairJobState{JobID: first.JobID, ManifestID: first.ManifestID, ShardIndex: first.ShardIndex}
	for _, e := range ordered {
		if !equalHex(e.JobID, state.JobID) || !equalHex(e.ManifestID, state.ManifestID) || e.ShardIndex != state.ShardIndex || e.Attempt == 0 || e.At.IsZero() {
			return RepairJobState{}, ErrRepairJournal
		}
		if !validRepairStage(e.Stage) {
			return RepairJobState{}, ErrRepairJournal
		}
		if e.Stage != RepairStageFailed && stageRank(e.Stage) < stageRank(state.Stage) {
			return RepairJobState{}, ErrRepairJournal
		}
		if e.Attempt < state.Attempt {
			return RepairJobState{}, ErrRepairJournal
		}
		state.Stage = e.Stage
		state.Attempt = e.Attempt
		state.UpdatedAt = e.At.UTC()
		if e.AgreementID != "" { state.AgreementID = e.AgreementID }
		if e.CommitmentID != "" { state.CommitmentID = e.CommitmentID }
		if e.ReservationID != "" { state.ReservationID = e.ReservationID }
		if e.NodeID != "" { state.NodeID = e.NodeID }
		if e.Stage == RepairStageFailed { state.LastError = e.Error } else { state.LastError = "" }
		state.Complete = e.Stage == RepairStageReplaced
	}
	return state, nil
}

func validRepairStage(stage RepairJobStage) bool {
	switch stage {
	case RepairStagePlanned, RepairStageAgreement, RepairStageCommitment, RepairStageCapacity, RepairStageActivated, RepairStageTransferred, RepairStageReplaced, RepairStageFailed:
		return true
	default:
		return false
	}
}

func stageRank(stage RepairJobStage) int {
	switch stage {
	case RepairStagePlanned:
		return 1
	case RepairStageAgreement:
		return 2
	case RepairStageCommitment:
		return 3
	case RepairStageCapacity:
		return 4
	case RepairStageActivated:
		return 5
	case RepairStageTransferred:
		return 6
	case RepairStageReplaced:
		return 7
	case RepairStageFailed:
		return 0
	default:
		return -1
	}
}

// FileRepairJournal is a local append-only audit log. It is deliberately not
// canonical protocol state; canonical repair truth remains on-chain.
type FileRepairJournal struct {
	Path string
	mu   sync.Mutex
}

func (j *FileRepairJournal) AppendRepairEvent(ctx context.Context, event RepairJobEvent) error {
	if err := ctx.Err(); err != nil { return err }
	if strings.TrimSpace(j.Path) == "" || strings.TrimSpace(event.JobID) == "" || strings.TrimSpace(event.ManifestID) == "" || event.Attempt == 0 || !validRepairStage(event.Stage) {
		return ErrRepairJournal
	}
	if event.At.IsZero() { event.At = time.Now().UTC() } else { event.At = event.At.UTC() }
	b, err := json.Marshal(event)
	if err != nil { return ErrRepairJournal }
	j.mu.Lock()
	defer j.mu.Unlock()
	if err := os.MkdirAll(filepath.Dir(j.Path), 0o755); err != nil { return err }
	f, err := os.OpenFile(j.Path, os.O_CREATE|os.O_APPEND|os.O_WRONLY, 0o600)
	if err != nil { return err }
	defer f.Close()
	if _, err := f.Write(append(b, '\n')); err != nil { return err }
	return f.Sync()
}

func (j *FileRepairJournal) RepairEvents(ctx context.Context, jobID string) ([]RepairJobEvent, error) {
	if err := ctx.Err(); err != nil { return nil, err }
	if strings.TrimSpace(j.Path) == "" || strings.TrimSpace(jobID) == "" { return nil, ErrRepairJournal }
	j.mu.Lock()
	defer j.mu.Unlock()
	b, err := os.ReadFile(j.Path)
	if errors.Is(err, os.ErrNotExist) { return nil, nil }
	if err != nil { return nil, err }
	lines := strings.Split(strings.TrimSpace(string(b)), "\n")
	out := make([]RepairJobEvent, 0)
	for _, line := range lines {
		if strings.TrimSpace(line) == "" { continue }
		var e RepairJobEvent
		if err := json.Unmarshal([]byte(line), &e); err != nil { return nil, ErrRepairJournal }
		if equalHex(e.JobID, jobID) { out = append(out, e) }
	}
	sort.SliceStable(out, func(i, k int) bool { return out[i].At.Before(out[k].At) })
	return out, nil
}
