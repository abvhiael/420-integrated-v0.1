package orchestration

import (
	"bytes"
	"context"
	"fmt"
	"sort"

	"github.com/420integrated/420-integrated/media/controlplane"
)

type Planner struct {
	discovery Discovery
}

func NewPlanner(discovery Discovery) *Planner {
	return &Planner{discovery: discovery}
}

func (p *Planner) Build(ctx context.Context, req PlanRequest) (Plan, error) {
	if p == nil || p.discovery == nil || req.StreamID == ([32]byte{}) || req.Capabilities.Ingress == ([32]byte{}) || req.Capabilities.Transcoder == ([32]byte{}) || req.RelayCount < 0 {
		return Plan{}, ErrInvalidPlan
	}
	if len(req.Renditions) == 0 {
		return Plan{}, ErrInvalidPlan
	}
	seenRenditions := map[string]struct{}{}
	for _, r := range req.Renditions {
		if r == "" {
			return Plan{}, ErrInvalidPlan
		}
		if _, ok := seenRenditions[r]; ok {
			return Plan{}, ErrInvalidPlan
		}
		seenRenditions[r] = struct{}{}
	}
	if req.RelayCount > 0 && req.Capabilities.Relay == ([32]byte{}) {
		return Plan{}, ErrInvalidPlan
	}

	ingress, err := p.pick(ctx, req.Capabilities.Ingress, req.Constraints, 1, nil)
	if err != nil {
		return Plan{}, err
	}
	used := map[[32]byte]struct{}{ingress[0].OperatorID: {}}

	transcoders, err := p.pick(ctx, req.Capabilities.Transcoder, req.Constraints, len(req.Renditions), used)
	if err != nil {
		return Plan{}, err
	}
	for _, t := range transcoders {
		used[t.OperatorID] = struct{}{}
	}

	var relays []controlplane.ProviderView
	if req.RelayCount > 0 {
		relays, err = p.pick(ctx, req.Capabilities.Relay, req.Constraints, req.RelayCount, used)
		if err != nil {
			return Plan{}, err
		}
	}

	plan := Plan{StreamID: req.StreamID}
	plan.Assignments = append(plan.Assignments, assignment(RoleIngress, ingress[0]))
	for _, t := range transcoders {
		plan.Assignments = append(plan.Assignments, assignment(RoleTranscoder, t))
	}
	for _, r := range relays {
		plan.Assignments = append(plan.Assignments, assignment(RoleRelay, r))
	}

	ingressJob := JobNode{ID: "ingress", Role: RoleIngress, OperatorID: ingress[0].OperatorID}
	plan.Jobs = append(plan.Jobs, ingressJob)
	transcodeIDs := make([]string, 0, len(req.Renditions))
	for i, rendition := range req.Renditions {
		id := fmt.Sprintf("transcode:%03d:%s", i, rendition)
		transcodeIDs = append(transcodeIDs, id)
		plan.Jobs = append(plan.Jobs, JobNode{
			ID: id,
			Role: RoleTranscoder,
			OperatorID: transcoders[i].OperatorID,
			DependsOn: []string{ingressJob.ID},
			Rendition: rendition,
		})
	}
	for i, relay := range relays {
		deps := append([]string(nil), transcodeIDs...)
		sort.Strings(deps)
		plan.Jobs = append(plan.Jobs, JobNode{
			ID: fmt.Sprintf("relay:%03d", i),
			Role: RoleRelay,
			OperatorID: relay.OperatorID,
			DependsOn: deps,
		})
	}
	if err := Validate(plan); err != nil {
		return Plan{}, err
	}
	return plan, nil
}

func (p *Planner) pick(ctx context.Context, capability [32]byte, c Constraints, count int, excluded map[[32]byte]struct{}) ([]controlplane.ProviderView, error) {
	if count <= 0 {
		return nil, ErrInvalidPlan
	}
	providers, err := p.discovery.Providers(ctx, controlplane.DiscoveryRequest{
		CapabilityID: capability,
		MaxPricePerUnit: c.MaxPricePerUnit,
		MaxLatencyMS: c.MaxLatencyMS,
		Geographies: c.Geographies,
		MinAvailableSlots: c.MinAvailableSlots,
		MinReliabilityBPS: c.MinReliabilityBPS,
		Limit: 0,
	})
	if err != nil {
		return nil, err
	}
	filtered := make([]controlplane.ProviderView, 0, len(providers))
	for _, provider := range providers {
		if provider.OperatorID == ([32]byte{}) {
			return nil, ErrInvalidGraph
		}
		if excluded != nil {
			if _, skip := excluded[provider.OperatorID]; skip {
				continue
			}
		}
		filtered = append(filtered, provider)
	}
	if len(filtered) < count {
		return nil, ErrNoAssignment
	}
	return filtered[:count], nil
}

func assignment(role Role, p controlplane.ProviderView) Assignment {
	return Assignment{Role: role, OperatorID: p.OperatorID, Revision: p.Revision, Score: p.Score}
}

func Validate(plan Plan) error {
	if plan.StreamID == ([32]byte{}) || len(plan.Jobs) == 0 || len(plan.Assignments) == 0 {
		return ErrInvalidGraph
	}
	jobs := make(map[string]JobNode, len(plan.Jobs))
	for _, job := range plan.Jobs {
		if job.ID == "" || job.OperatorID == ([32]byte{}) {
			return ErrInvalidGraph
		}
		if _, exists := jobs[job.ID]; exists {
			return ErrInvalidGraph
		}
		jobs[job.ID] = job
	}
	for _, job := range plan.Jobs {
		for _, dep := range job.DependsOn {
			if dep == job.ID {
				return ErrInvalidGraph
			}
			if _, ok := jobs[dep]; !ok {
				return ErrInvalidGraph
			}
		}
	}
	// Kahn traversal catches cycles and makes dependency ordering explicit.
	indegree := make(map[string]int, len(jobs))
	children := make(map[string][]string, len(jobs))
	for id := range jobs {
		indegree[id] = 0
	}
	for _, job := range plan.Jobs {
		for _, dep := range job.DependsOn {
			indegree[job.ID]++
			children[dep] = append(children[dep], job.ID)
		}
	}
	ready := make([]string, 0, len(jobs))
	for id, n := range indegree {
		if n == 0 {
			ready = append(ready, id)
		}
	}
	sort.Strings(ready)
	visited := 0
	for len(ready) > 0 {
		id := ready[0]
		ready = ready[1:]
		visited++
		childrenIDs := children[id]
		sort.Strings(childrenIDs)
		for _, child := range childrenIDs {
			indegree[child]--
			if indegree[child] == 0 {
				ready = append(ready, child)
				sort.Strings(ready)
			}
		}
	}
	if visited != len(jobs) {
		return ErrInvalidGraph
	}

	// Assignment identity must be unique per role/operator pair.
	type key struct { Role Role; OperatorID [32]byte }
	seen := make(map[key]struct{}, len(plan.Assignments))
	for _, a := range plan.Assignments {
		if a.OperatorID == ([32]byte{}) || a.Role == "" {
			return ErrInvalidGraph
		}
		k := key{a.Role, a.OperatorID}
		if _, ok := seen[k]; ok {
			return ErrInvalidGraph
		}
		seen[k] = struct{}{}
	}

	// Keep generated plans stable for callers comparing snapshots.
	sort.SliceStable(plan.Assignments, func(i, j int) bool {
		if plan.Assignments[i].Role != plan.Assignments[j].Role {
			return plan.Assignments[i].Role < plan.Assignments[j].Role
		}
		return bytes.Compare(plan.Assignments[i].OperatorID[:], plan.Assignments[j].OperatorID[:]) < 0
	})
	return nil
}
