package history

import (
	"errors"
	"sort"
	"sync"
	"time"

	"github.com/420integrated/420-integrated/status/evidence"
	"github.com/420integrated/420-integrated/status/incidents"
)

type ObservationRecord struct {
	Sequence uint64
	RecordedAt time.Time
	Observation evidence.Observation
}

type IncidentRecord struct {
	Sequence uint64
	RecordedAt time.Time
	Incident incidents.Incident
}

type Store struct {
	mu sync.RWMutex
	sequence uint64
	observations []ObservationRecord
	incidentRecords []IncidentRecord
}

func NewStore() *Store { return &Store{} }

func (s *Store) next() uint64 {
	s.sequence++
	return s.sequence
}

func (s *Store) AppendObservation(obs evidence.Observation, recordedAt time.Time) error {
	if recordedAt.IsZero() { return errors.New("recorded-at timestamp is required") }
	if err := obs.Validate(recordedAt); err != nil { return err }
	if obs.Canonical { return errors.New("history cannot persist canonical authority claims") }
	s.mu.Lock()
	defer s.mu.Unlock()
	s.observations = append(s.observations, ObservationRecord{Sequence: s.next(), RecordedAt: recordedAt, Observation: cloneObservation(obs)})
	return nil
}

func (s *Store) AppendIncident(i incidents.Incident, recordedAt time.Time) error {
	if recordedAt.IsZero() { return errors.New("recorded-at timestamp is required") }
	if err := i.Validate(); err != nil { return err }
	s.mu.Lock()
	defer s.mu.Unlock()
	s.incidentRecords = append(s.incidentRecords, IncidentRecord{Sequence: s.next(), RecordedAt: recordedAt, Incident: cloneIncident(i)})
	return nil
}

func (s *Store) Observations() []ObservationRecord {
	s.mu.RLock(); defer s.mu.RUnlock()
	out := make([]ObservationRecord, len(s.observations))
	for n, r := range s.observations { out[n] = ObservationRecord{Sequence:r.Sequence, RecordedAt:r.RecordedAt, Observation:cloneObservation(r.Observation)} }
	sort.Slice(out, func(i,j int) bool { return out[i].Sequence < out[j].Sequence })
	return out
}

func (s *Store) Incidents() []IncidentRecord {
	s.mu.RLock(); defer s.mu.RUnlock()
	out := make([]IncidentRecord, len(s.incidentRecords))
	for n, r := range s.incidentRecords { out[n] = IncidentRecord{Sequence:r.Sequence, RecordedAt:r.RecordedAt, Incident:cloneIncident(r.Incident)} }
	sort.Slice(out, func(i,j int) bool { return out[i].Sequence < out[j].Sequence })
	return out
}

func (s *Store) ObservationHistory(componentID string) []ObservationRecord {
	all := s.Observations()
	out := all[:0]
	for _, r := range all { if r.Observation.ComponentID == componentID { out = append(out, r) } }
	return out
}

func cloneObservation(o evidence.Observation) evidence.Observation {
	o.References = append([]evidence.Reference(nil), o.References...)
	return o
}

func cloneIncident(i incidents.Incident) incidents.Incident {
	i.AffectedComponents = append([]string(nil), i.AffectedComponents...)
	i.Updates = append([]incidents.Update(nil), i.Updates...)
	for n := range i.Updates { i.Updates[n].Evidence = append([]evidence.Reference(nil), i.Updates[n].Evidence...) }
	return i
}
