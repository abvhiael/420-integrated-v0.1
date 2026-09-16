package storage

import (
	"context"
	"errors"
	"fmt"
	"sort"
	"strings"
	"sync"
)

var ErrResourceLifecycle = errors.New("resource lifecycle coordination failure")

type ResourceServiceController interface {
	Start(context.Context) error
	Stop(context.Context) error
}

type ResourceLifecycleBinding struct {
	ServiceID  string
	DependsOn  []string
	Controller ResourceServiceController
}

type ResourceLifecycleCoordinator struct {
	Runtime *ResourceNetworkRuntime

	mu       sync.Mutex
	bindings map[string]ResourceLifecycleBinding
	started  []string
}

func NewResourceLifecycleCoordinator(runtime *ResourceNetworkRuntime) (*ResourceLifecycleCoordinator, error) {
	if runtime == nil {
		return nil, ErrResourceLifecycle
	}
	return &ResourceLifecycleCoordinator{Runtime: runtime, bindings: make(map[string]ResourceLifecycleBinding)}, nil
}

func (c *ResourceLifecycleCoordinator) Bind(binding ResourceLifecycleBinding) error {
	if c == nil || c.Runtime == nil || binding.Controller == nil {
		return ErrResourceLifecycle
	}
	binding.ServiceID = strings.TrimSpace(binding.ServiceID)
	if binding.ServiceID == "" {
		return ErrResourceLifecycle
	}
	service, ok := c.service(binding.ServiceID)
	if !ok {
		return ErrResourceLifecycle
	}
	binding.ServiceID = service.Descriptor.ServiceID

	seen := map[string]struct{}{}
	deps := make([]string, 0, len(binding.DependsOn))
	for _, dependency := range binding.DependsOn {
		dependency = strings.TrimSpace(dependency)
		if dependency == "" || strings.EqualFold(dependency, binding.ServiceID) {
			return ErrResourceLifecycle
		}
		resolved, ok := c.service(dependency)
		if !ok {
			return ErrResourceLifecycle
		}
		key := strings.ToLower(resolved.Descriptor.ServiceID)
		if _, exists := seen[key]; exists {
			continue
		}
		seen[key] = struct{}{}
		deps = append(deps, resolved.Descriptor.ServiceID)
	}
	sort.Slice(deps, func(i, j int) bool { return strings.ToLower(deps[i]) < strings.ToLower(deps[j]) })
	binding.DependsOn = deps

	key := strings.ToLower(binding.ServiceID)
	c.mu.Lock()
	defer c.mu.Unlock()
	if len(c.started) != 0 {
		return ErrResourceLifecycle
	}
	if _, exists := c.bindings[key]; exists {
		return ErrResourceLifecycle
	}
	c.bindings[key] = binding
	return nil
}

func (c *ResourceLifecycleCoordinator) StartOrder() ([]string, error) {
	if c == nil || c.Runtime == nil {
		return nil, ErrResourceLifecycle
	}
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.startOrderLocked()
}

func (c *ResourceLifecycleCoordinator) StartAll(ctx context.Context) error {
	if c == nil || c.Runtime == nil {
		return ErrResourceLifecycle
	}
	if err := ctx.Err(); err != nil {
		return err
	}
	c.mu.Lock()
	defer c.mu.Unlock()
	if len(c.started) != 0 {
		return ErrResourceLifecycle
	}
	order, err := c.startOrderLocked()
	if err != nil {
		return err
	}
	for _, serviceID := range order {
		if err := ctx.Err(); err != nil {
			return errors.Join(err, c.rollbackLocked(context.Background()))
		}
		binding := c.bindings[strings.ToLower(serviceID)]
		if err := c.Runtime.Transition(serviceID, ResourceServiceStarting); err != nil {
			return errors.Join(ErrResourceLifecycle, err, c.rollbackLocked(context.Background()))
		}
		if err := binding.Controller.Start(ctx); err != nil {
			_ = c.Runtime.Transition(serviceID, ResourceServiceFailed)
			return errors.Join(fmt.Errorf("%w: start %s: %v", ErrResourceLifecycle, serviceID, err), c.rollbackLocked(context.Background()))
		}
		if err := c.Runtime.Transition(serviceID, ResourceServiceRunning); err != nil {
			_ = binding.Controller.Stop(context.Background())
			_ = c.Runtime.Transition(serviceID, ResourceServiceFailed)
			return errors.Join(ErrResourceLifecycle, err, c.rollbackLocked(context.Background()))
		}
		c.started = append(c.started, serviceID)
	}
	return nil
}

func (c *ResourceLifecycleCoordinator) StopAll(ctx context.Context) error {
	if c == nil || c.Runtime == nil {
		return ErrResourceLifecycle
	}
	c.mu.Lock()
	defer c.mu.Unlock()
	var stopErr error
	for i := len(c.started) - 1; i >= 0; i-- {
		serviceID := c.started[i]
		binding := c.bindings[strings.ToLower(serviceID)]
		if err := binding.Controller.Stop(ctx); err != nil {
			_ = c.Runtime.Transition(serviceID, ResourceServiceFailed)
			stopErr = errors.Join(stopErr, fmt.Errorf("%w: stop %s: %v", ErrResourceLifecycle, serviceID, err))
			continue
		}
		if err := c.Runtime.Transition(serviceID, ResourceServiceStopped); err != nil {
			stopErr = errors.Join(stopErr, err)
		}
	}
	c.started = nil
	return stopErr
}

func (c *ResourceLifecycleCoordinator) startOrderLocked() ([]string, error) {
	if len(c.bindings) == 0 {
		return nil, ErrResourceLifecycle
	}
	indegree := make(map[string]int, len(c.bindings))
	children := make(map[string][]string, len(c.bindings))
	canonical := make(map[string]string, len(c.bindings))
	for key, binding := range c.bindings {
		canonical[key] = binding.ServiceID
		indegree[key] = 0
	}
	for key, binding := range c.bindings {
		for _, dependency := range binding.DependsOn {
			depKey := strings.ToLower(dependency)
			if _, ok := c.bindings[depKey]; !ok {
				return nil, ErrResourceLifecycle
			}
			indegree[key]++
			children[depKey] = append(children[depKey], key)
		}
	}
	ready := make([]string, 0, len(indegree))
	for key, degree := range indegree {
		if degree == 0 {
			ready = append(ready, key)
		}
	}
	sort.Strings(ready)
	order := make([]string, 0, len(indegree))
	for len(ready) > 0 {
		key := ready[0]
		ready = ready[1:]
		order = append(order, canonical[key])
		for _, child := range children[key] {
			indegree[child]--
			if indegree[child] == 0 {
				ready = append(ready, child)
				sort.Strings(ready)
			}
		}
	}
	if len(order) != len(c.bindings) {
		return nil, ErrResourceLifecycle
	}
	return order, nil
}

func (c *ResourceLifecycleCoordinator) rollbackLocked(ctx context.Context) error {
	var rollbackErr error
	for i := len(c.started) - 1; i >= 0; i-- {
		serviceID := c.started[i]
		binding := c.bindings[strings.ToLower(serviceID)]
		if err := binding.Controller.Stop(ctx); err != nil {
			_ = c.Runtime.Transition(serviceID, ResourceServiceFailed)
			rollbackErr = errors.Join(rollbackErr, fmt.Errorf("%w: rollback %s: %v", ErrResourceLifecycle, serviceID, err))
			continue
		}
		if err := c.Runtime.Transition(serviceID, ResourceServiceStopped); err != nil {
			rollbackErr = errors.Join(rollbackErr, err)
		}
	}
	c.started = nil
	return rollbackErr
}

func (c *ResourceLifecycleCoordinator) service(serviceID string) (ResourceServiceSnapshot, bool) {
	for _, service := range c.Runtime.Snapshot() {
		if strings.EqualFold(service.Descriptor.ServiceID, strings.TrimSpace(serviceID)) {
			return service, true
		}
	}
	return ResourceServiceSnapshot{}, false
}
