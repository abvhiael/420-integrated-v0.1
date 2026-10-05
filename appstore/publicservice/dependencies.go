package publicservice

import (
	"sync"

	"github.com/420integrated/420-integrated/appstore/hardening"
)

type DependencyState struct {
	mu   sync.RWMutex
	deps hardening.Dependencies
}

func NewDependencyState(initial hardening.Dependencies) *DependencyState {
	return &DependencyState{deps: initial}
}

func (s *DependencyState) Dependencies() hardening.Dependencies {
	if s == nil {
		return hardening.Dependencies{}
	}
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.deps
}

func (s *DependencyState) Set(next hardening.Dependencies) {
	if s == nil {
		return
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	s.deps = next
}
