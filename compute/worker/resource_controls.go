package worker

import (
	"context"
	"errors"
	"fmt"
	"io"
	"math"
	"runtime"
	"strconv"
	"strings"
	"sync"
	"time"
)

const LocalResourcePolicySchemaV1 = "420-compute-worker-local-resource-policy-v1"

var (
	ErrInvalidLocalResourcePolicy = errors.New("invalid compute worker local resource policy")
	ErrLocalResourceUnavailable   = errors.New("compute worker local resource unavailable")
	ErrLocalResourceExceeded      = errors.New("compute worker local resource limit exceeded")
)

type ScheduleWindow struct {
	Weekday     time.Weekday
	StartMinute uint16
	EndMinute   uint16
}

type LocalResourcePolicy struct {
	SchemaVersion            string
	CPUPercent               float64
	GPUPercent               float64
	IdleOnly                 bool
	IdleCPUThresholdPercent  float64
	MinIdleDuration          time.Duration
	MaxCPUTemperatureC       float64
	MaxGPUTemperatureC       float64
	BandwidthBytesPerSecond  uint64
	BandwidthBurstBytes      uint64
	TimeZone                 string
	Schedule                 []ScheduleWindow
	TelemetryPollInterval    time.Duration
}

func DefaultLocalResourcePolicy() LocalResourcePolicy {
	return LocalResourcePolicy{
		SchemaVersion:           LocalResourcePolicySchemaV1,
		CPUPercent:              100,
		GPUPercent:              0,
		IdleOnly:                false,
		IdleCPUThresholdPercent: 10,
		MinIdleDuration:         30 * time.Second,
		MaxCPUTemperatureC:      0,
		MaxGPUTemperatureC:      0,
		BandwidthBytesPerSecond: 0,
		BandwidthBurstBytes:     0,
		TimeZone:                "UTC",
		TelemetryPollInterval:   2 * time.Second,
	}
}

func (p LocalResourcePolicy) Validate() error {
	if p.SchemaVersion != LocalResourcePolicySchemaV1 {
		return fmt.Errorf("%w: unsupported schema", ErrInvalidLocalResourcePolicy)
	}
	if math.IsNaN(p.CPUPercent) || math.IsInf(p.CPUPercent, 0) || p.CPUPercent <= 0 || p.CPUPercent > 100 {
		return fmt.Errorf("%w: CPU percentage must be within (0,100]", ErrInvalidLocalResourcePolicy)
	}
	if math.IsNaN(p.GPUPercent) || math.IsInf(p.GPUPercent, 0) || p.GPUPercent < 0 || p.GPUPercent > 100 {
		return fmt.Errorf("%w: GPU percentage must be within [0,100]", ErrInvalidLocalResourcePolicy)
	}
	if p.IdleOnly {
		if p.IdleCPUThresholdPercent < 0 || p.IdleCPUThresholdPercent > 100 || p.MinIdleDuration <= 0 {
			return fmt.Errorf("%w: invalid idle-only policy", ErrInvalidLocalResourcePolicy)
		}
	}
	for _, temp := range []float64{p.MaxCPUTemperatureC, p.MaxGPUTemperatureC} {
		if math.IsNaN(temp) || math.IsInf(temp, 0) || temp < 0 || temp > 150 {
			return fmt.Errorf("%w: invalid thermal ceiling", ErrInvalidLocalResourcePolicy)
		}
	}
	if (p.BandwidthBytesPerSecond == 0) != (p.BandwidthBurstBytes == 0) {
		return fmt.Errorf("%w: bandwidth rate and burst must both be zero or both nonzero", ErrInvalidLocalResourcePolicy)
	}
	if p.BandwidthBytesPerSecond > 0 && p.BandwidthBurstBytes > p.BandwidthBytesPerSecond*10 {
		return fmt.Errorf("%w: bandwidth burst is unreasonably large", ErrInvalidLocalResourcePolicy)
	}
	if p.TimeZone == "" {
		return fmt.Errorf("%w: timezone required", ErrInvalidLocalResourcePolicy)
	}
	if _, err := time.LoadLocation(p.TimeZone); err != nil {
		return fmt.Errorf("%w: invalid timezone: %v", ErrInvalidLocalResourcePolicy, err)
	}
	if p.TelemetryPollInterval <= 0 || p.TelemetryPollInterval > time.Minute {
		return fmt.Errorf("%w: telemetry polling interval out of bounds", ErrInvalidLocalResourcePolicy)
	}
	for _, window := range p.Schedule {
		if window.Weekday < time.Sunday || window.Weekday > time.Saturday ||
			window.StartMinute >= 24*60 || window.EndMinute > 24*60 ||
			window.StartMinute >= window.EndMinute {
			return fmt.Errorf("%w: invalid schedule window", ErrInvalidLocalResourcePolicy)
		}
	}
	return nil
}

type HostResourceSnapshot struct {
	CapturedAt             time.Time
	LogicalCPUs            int
	CPUUtilizationPercent  float64
	CPUUtilizationKnown    bool
	IdleDuration           time.Duration
	IdleKnown              bool
	CPUTemperatureC        float64
	CPUTemperatureKnown    bool
	GPUTemperatureC        float64
	GPUTemperatureKnown    bool
	GPUAvailable           bool
}

type HostResourceProbe interface {
	Snapshot(context.Context) (HostResourceSnapshot, error)
}

type HostResourceProbeFunc func(context.Context) (HostResourceSnapshot, error)

func (f HostResourceProbeFunc) Snapshot(ctx context.Context) (HostResourceSnapshot, error) {
	return f(ctx)
}

type GPUShareLease interface {
	Release() error
}

type GPUShareEnforcer interface {
	Acquire(context.Context, float64) (GPUShareLease, error)
}

type ResourceLease struct {
	ctx     context.Context
	cancel  context.CancelFunc
	done    chan struct{}
	gpu     GPUShareLease
	mu      sync.Mutex
	err     error
	once    sync.Once
}

func (l *ResourceLease) Context() context.Context {
	if l == nil || l.ctx == nil {
		return context.Background()
	}
	return l.ctx
}

func (l *ResourceLease) Err() error {
	if l == nil {
		return nil
	}
	l.mu.Lock()
	defer l.mu.Unlock()
	return l.err
}

func (l *ResourceLease) setErr(err error) {
	if err == nil {
		return
	}
	l.mu.Lock()
	if l.err == nil {
		l.err = err
	}
	l.mu.Unlock()
}

func (l *ResourceLease) Release() error {
	if l == nil {
		return nil
	}
	var releaseErr error
	l.once.Do(func() {
		if l.cancel != nil {
			l.cancel()
		}
		if l.done != nil {
			<-l.done
		}
		if l.gpu != nil {
			releaseErr = l.gpu.Release()
		}
	})
	return releaseErr
}

type LocalResourceController struct {
	policy    LocalResourcePolicy
	probe     HostResourceProbe
	gpu       GPUShareEnforcer
	now       func() time.Time
	idleMu    sync.Mutex
	idleSince time.Time
}

func NewLocalResourceController(policy LocalResourcePolicy, probe HostResourceProbe, gpu GPUShareEnforcer) (*LocalResourceController, error) {
	if err := policy.Validate(); err != nil {
		return nil, err
	}
	needsProbe := policy.IdleOnly || policy.MaxCPUTemperatureC > 0 || policy.MaxGPUTemperatureC > 0 || len(policy.Schedule) > 0
	if needsProbe && probe == nil {
		return nil, fmt.Errorf("%w: host telemetry probe required", ErrInvalidLocalResourcePolicy)
	}
	if policy.GPUPercent > 0 && gpu == nil {
		return nil, fmt.Errorf("%w: GPU percentage requested without a qualified GPU share enforcer", ErrInvalidLocalResourcePolicy)
	}
	return &LocalResourceController{policy: policy, probe: probe, gpu: gpu, now: time.Now}, nil
}

func (c *LocalResourceController) Policy() LocalResourcePolicy {
	if c == nil {
		return LocalResourcePolicy{}
	}
	return c.policy
}

func (c *LocalResourceController) Acquire(parent context.Context) (*ResourceLease, error) {
	if c == nil {
		return nil, ErrInvalidLocalResourcePolicy
	}
	if err := c.check(parent); err != nil {
		return nil, err
	}
	var gpuLease GPUShareLease
	var err error
	if c.policy.GPUPercent > 0 {
		gpuLease, err = c.gpu.Acquire(parent, c.policy.GPUPercent)
		if err != nil {
			return nil, fmt.Errorf("%w: GPU share: %v", ErrLocalResourceUnavailable, err)
		}
	}
	ctx, cancel := context.WithCancel(parent)
	lease := &ResourceLease{ctx: ctx, cancel: cancel, done: make(chan struct{}), gpu: gpuLease}
	go c.monitor(lease)
	return lease, nil
}

func (c *LocalResourceController) monitor(lease *ResourceLease) {
	defer close(lease.done)
	ticker := time.NewTicker(c.policy.TelemetryPollInterval)
	defer ticker.Stop()
	for {
		select {
		case <-lease.ctx.Done():
			return
		case <-ticker.C:
			if err := c.check(lease.ctx); err != nil {
				lease.setErr(err)
				lease.cancel()
				return
			}
		}
	}
}

func (c *LocalResourceController) check(ctx context.Context) error {
	if err := ctx.Err(); err != nil {
		return err
	}
	now := c.now().UTC()
	if !scheduleAllows(c.policy, now) {
		return fmt.Errorf("%w: outside configured schedule", ErrLocalResourceUnavailable)
	}
	if c.probe == nil {
		return nil
	}
	snapshot, err := c.probe.Snapshot(ctx)
	if err != nil {
		return fmt.Errorf("%w: telemetry probe: %v", ErrLocalResourceUnavailable, err)
	}
	if snapshot.LogicalCPUs <= 0 {
		return fmt.Errorf("%w: logical CPU count unavailable", ErrLocalResourceUnavailable)
	}
	if c.policy.IdleOnly {
		if !snapshot.CPUUtilizationKnown {
			return fmt.Errorf("%w: idle telemetry unavailable", ErrLocalResourceUnavailable)
		}
		if snapshot.CPUUtilizationPercent > c.policy.IdleCPUThresholdPercent {
			c.idleMu.Lock()
			c.idleSince = time.Time{}
			c.idleMu.Unlock()
			return fmt.Errorf("%w: host is not idle", ErrLocalResourceUnavailable)
		}
		idleDuration := snapshot.IdleDuration
		if !snapshot.IdleKnown {
			c.idleMu.Lock()
			if c.idleSince.IsZero() {
				c.idleSince = now
			}
			idleDuration = now.Sub(c.idleSince)
			c.idleMu.Unlock()
		}
		if idleDuration < c.policy.MinIdleDuration {
			return fmt.Errorf("%w: minimum idle duration not reached", ErrLocalResourceUnavailable)
		}
	}
	if c.policy.MaxCPUTemperatureC > 0 {
		if !snapshot.CPUTemperatureKnown {
			return fmt.Errorf("%w: CPU thermal telemetry unavailable", ErrLocalResourceUnavailable)
		}
		if snapshot.CPUTemperatureC >= c.policy.MaxCPUTemperatureC {
			return fmt.Errorf("%w: CPU thermal ceiling reached", ErrLocalResourceExceeded)
		}
	}
	if c.policy.GPUPercent > 0 || c.policy.MaxGPUTemperatureC > 0 {
		if !snapshot.GPUAvailable {
			return fmt.Errorf("%w: GPU unavailable", ErrLocalResourceUnavailable)
		}
	}
	if c.policy.MaxGPUTemperatureC > 0 {
		if !snapshot.GPUTemperatureKnown {
			return fmt.Errorf("%w: GPU thermal telemetry unavailable", ErrLocalResourceUnavailable)
		}
		if snapshot.GPUTemperatureC >= c.policy.MaxGPUTemperatureC {
			return fmt.Errorf("%w: GPU thermal ceiling reached", ErrLocalResourceExceeded)
		}
	}
	return nil
}

func ParseScheduleWindow(value string) (ScheduleWindow, error) {
	parts := strings.Split(value, "@")
	if len(parts) != 2 {
		return ScheduleWindow{}, fmt.Errorf("%w: schedule must use DDD@HH:MM-HH:MM", ErrInvalidLocalResourcePolicy)
	}
	weekdays := map[string]time.Weekday{
		"sun": time.Sunday, "mon": time.Monday, "tue": time.Tuesday, "wed": time.Wednesday,
		"thu": time.Thursday, "fri": time.Friday, "sat": time.Saturday,
	}
	weekday, ok := weekdays[strings.ToLower(strings.TrimSpace(parts[0]))]
	if !ok {
		return ScheduleWindow{}, fmt.Errorf("%w: invalid schedule weekday", ErrInvalidLocalResourcePolicy)
	}
	rangeParts := strings.Split(parts[1], "-")
	if len(rangeParts) != 2 {
		return ScheduleWindow{}, fmt.Errorf("%w: schedule time range required", ErrInvalidLocalResourcePolicy)
	}
	parseMinute := func(raw string, allow24 bool) (uint16, error) {
		hm := strings.Split(strings.TrimSpace(raw), ":")
		if len(hm) != 2 {
			return 0, fmt.Errorf("HH:MM required")
		}
		hour, err := strconv.Atoi(hm[0])
		if err != nil {
			return 0, err
		}
		minute, err := strconv.Atoi(hm[1])
		if err != nil {
			return 0, err
		}
		if minute < 0 || minute > 59 || hour < 0 || hour > 24 || (hour == 24 && (!allow24 || minute != 0)) {
			return 0, fmt.Errorf("time out of bounds")
		}
		return uint16(hour*60 + minute), nil
	}
	start, err := parseMinute(rangeParts[0], false)
	if err != nil {
		return ScheduleWindow{}, fmt.Errorf("%w: invalid schedule start: %v", ErrInvalidLocalResourcePolicy, err)
	}
	end, err := parseMinute(rangeParts[1], true)
	if err != nil {
		return ScheduleWindow{}, fmt.Errorf("%w: invalid schedule end: %v", ErrInvalidLocalResourcePolicy, err)
	}
	window := ScheduleWindow{Weekday: weekday, StartMinute: start, EndMinute: end}
	if window.StartMinute >= window.EndMinute {
		return ScheduleWindow{}, fmt.Errorf("%w: schedule start must precede end", ErrInvalidLocalResourcePolicy)
	}
	return window, nil
}

func scheduleAllows(policy LocalResourcePolicy, now time.Time) bool {
	if len(policy.Schedule) == 0 {
		return true
	}
	loc, err := time.LoadLocation(policy.TimeZone)
	if err != nil {
		return false
	}
	local := now.In(loc)
	minute := uint16(local.Hour()*60 + local.Minute())
	for _, window := range policy.Schedule {
		if window.Weekday == local.Weekday() && minute >= window.StartMinute && minute < window.EndMinute {
			return true
		}
	}
	return false
}

func ApplyLocalResourcePolicy(base SandboxPolicy, policy LocalResourcePolicy, logicalCPUs int) (SandboxPolicy, error) {
	if err := base.Validate(); err != nil {
		return SandboxPolicy{}, err
	}
	if err := policy.Validate(); err != nil {
		return SandboxPolicy{}, err
	}
	if logicalCPUs <= 0 {
		return SandboxPolicy{}, fmt.Errorf("%w: logical CPU count unavailable", ErrLocalResourceUnavailable)
	}
	cpus := float64(logicalCPUs) * policy.CPUPercent / 100
	if cpus < 0.01 {
		cpus = 0.01
	}
	if cpus > 64 {
		cpus = 64
	}
	base.CPUs = cpus
	return base, base.Validate()
}

type ControlledExecutionLifecycle struct {
	inner      *ExecutionLifecycle
	controller *LocalResourceController
}

func NewControlledExecutionLifecycle(inner *ExecutionLifecycle, controller *LocalResourceController) (*ControlledExecutionLifecycle, error) {
	if inner == nil || inner.sandbox == nil || controller == nil {
		return nil, fmt.Errorf("%w: lifecycle, sandbox and controller required", ErrInvalidLocalResourcePolicy)
	}
	controlledPolicy, err := ApplyLocalResourcePolicy(inner.sandbox.policy, controller.policy, RuntimeLogicalCPUs())
	if err != nil {
		return nil, err
	}
	inner.sandbox.policy = controlledPolicy
	return &ControlledExecutionLifecycle{inner: inner, controller: controller}, nil
}

func (c *ControlledExecutionLifecycle) Execute(ctx context.Context, plan ExecutionPlan) (ExecutionOutcome, error) {
	lease, err := c.controller.Acquire(ctx)
	if err != nil {
		return ExecutionOutcome{}, err
	}
	defer lease.Release()
	outcome, runErr := c.inner.Execute(lease.Context(), plan)
	if resourceErr := lease.Err(); resourceErr != nil {
		if runErr != nil {
			return outcome, fmt.Errorf("%v; resource control: %w", runErr, resourceErr)
		}
		return outcome, resourceErr
	}
	return outcome, runErr
}

func (c *ControlledExecutionLifecycle) Resume(ctx context.Context, plan ExecutionPlan, checkpoints *CheckpointStore) (ExecutionOutcome, error) {
	lease, err := c.controller.Acquire(ctx)
	if err != nil {
		return ExecutionOutcome{}, err
	}
	defer lease.Release()
	outcome, runErr := c.inner.Resume(lease.Context(), plan, checkpoints)
	if resourceErr := lease.Err(); resourceErr != nil {
		if runErr != nil {
			return outcome, fmt.Errorf("%v; resource control: %w", runErr, resourceErr)
		}
		return outcome, resourceErr
	}
	return outcome, runErr
}

type bandwidthClock interface {
	Now() time.Time
	Sleep(context.Context, time.Duration) error
}

type realBandwidthClock struct{}

func (realBandwidthClock) Now() time.Time { return time.Now() }

func (realBandwidthClock) Sleep(ctx context.Context, d time.Duration) error {
	if d <= 0 {
		return nil
	}
	timer := time.NewTimer(d)
	defer timer.Stop()
	select {
	case <-ctx.Done():
		return ctx.Err()
	case <-timer.C:
		return nil
	}
}

type ByteRateLimiter struct {
	bytesPerSecond uint64
	burstBytes     uint64
	clock          bandwidthClock
	mu             sync.Mutex
	next           time.Time
}

func NewByteRateLimiter(bytesPerSecond, burstBytes uint64) (*ByteRateLimiter, error) {
	return newByteRateLimiter(bytesPerSecond, burstBytes, realBandwidthClock{})
}

func newByteRateLimiter(bytesPerSecond, burstBytes uint64, clock bandwidthClock) (*ByteRateLimiter, error) {
	if bytesPerSecond == 0 || burstBytes == 0 || clock == nil {
		return nil, fmt.Errorf("%w: nonzero bandwidth rate/burst and clock required", ErrInvalidLocalResourcePolicy)
	}
	return &ByteRateLimiter{bytesPerSecond: bytesPerSecond, burstBytes: burstBytes, clock: clock}, nil
}

func (l *ByteRateLimiter) WaitN(ctx context.Context, n uint64) error {
	if l == nil || n == 0 {
		return nil
	}
	for n > 0 {
		chunk := n
		if chunk > l.burstBytes {
			chunk = l.burstBytes
		}
		if err := l.waitChunk(ctx, chunk); err != nil {
			return err
		}
		n -= chunk
	}
	return nil
}

func (l *ByteRateLimiter) waitChunk(ctx context.Context, n uint64) error {
	l.mu.Lock()
	now := l.clock.Now()
	start := now
	if l.next.After(start) {
		start = l.next
	}
	nanos := (float64(n) / float64(l.bytesPerSecond)) * float64(time.Second)
	duration := time.Duration(nanos)
	l.next = start.Add(duration)
	wait := start.Sub(now)
	l.mu.Unlock()
	return l.clock.Sleep(ctx, wait)
}

type rateLimitedReader struct {
	ctx     context.Context
	reader  io.Reader
	limiter *ByteRateLimiter
	maxRead int
}

func (l *ByteRateLimiter) WrapReader(ctx context.Context, reader io.Reader) io.Reader {
	if l == nil || reader == nil {
		return reader
	}
	maxRead := int(l.burstBytes)
	if maxRead > 64<<10 {
		maxRead = 64 << 10
	}
	if maxRead < 1 {
		maxRead = 1
	}
	return &rateLimitedReader{ctx: ctx, reader: reader, limiter: l, maxRead: maxRead}
}

func (r *rateLimitedReader) Read(p []byte) (int, error) {
	if len(p) > r.maxRead {
		p = p[:r.maxRead]
	}
	n, err := r.reader.Read(p)
	if n > 0 {
		if waitErr := r.limiter.WaitN(r.ctx, uint64(n)); waitErr != nil {
			return 0, waitErr
		}
	}
	return n, err
}

func ResourceBandwidthLimiter(policy LocalResourcePolicy) (*ByteRateLimiter, error) {
	if err := policy.Validate(); err != nil {
		return nil, err
	}
	if policy.BandwidthBytesPerSecond == 0 {
		return nil, nil
	}
	return NewByteRateLimiter(policy.BandwidthBytesPerSecond, policy.BandwidthBurstBytes)
}

func RuntimeLogicalCPUs() int {
	return runtime.NumCPU()
}
