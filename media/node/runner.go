package node

import (
	"context"
	"errors"
	"sync"
	"time"
)

// Runner coordinates chain selection, capability checks, funding confirmation,
// execution leases and processor invocation for a registered media operator.
type Runner struct {
	cfg       OperatorConfig
	chain     ChainAdapter
	processor Processor
	leases    LeaseStore
	now       func() time.Time
	sem       chan struct{}
	wg        sync.WaitGroup
}

func NewRunner(cfg OperatorConfig, chain ChainAdapter, processor Processor, leases LeaseStore) *Runner {
	cfg = cfg.normalized()
	return &Runner{
		cfg:       cfg,
		chain:     chain,
		processor: processor,
		leases:    leases,
		now:       time.Now,
		sem:       make(chan struct{}, cfg.MaxParallel),
	}
}

// Run polls for eligible jobs until ctx is cancelled.
func (r *Runner) Run(ctx context.Context) error {
	if err := r.RunOnce(ctx); err != nil && !errors.Is(err, context.Canceled) {
		return err
	}
	ticker := time.NewTicker(r.cfg.PollInterval)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			r.wg.Wait()
			return ctx.Err()
		case <-ticker.C:
			if err := r.RunOnce(ctx); err != nil && !errors.Is(err, context.Canceled) {
				return err
			}
		}
	}
}

// RunOnce performs one discovery pass. Individual unsupported or stale jobs are skipped;
// adapter errors fail the pass so operators can observe infrastructure faults.
func (r *Runner) RunOnce(ctx context.Context) error {
	jobs, err := r.chain.PendingJobs(ctx)
	if err != nil {
		return err
	}
	for _, job := range jobs {
		if job.Status != JobCreated {
			continue
		}
		if !r.cfg.Supports(job.CapabilityID) {
			continue
		}
		if !job.Deadline.IsZero() && !r.now().Before(job.Deadline) {
			continue
		}
		select {
		case r.sem <- struct{}{}:
		case <-ctx.Done():
			return ctx.Err()
		}
		r.wg.Add(1)
		go func(j Job) {
			defer func() {
				<-r.sem
				r.wg.Done()
			}()
			_ = r.handle(ctx, j)
		}(job)
	}
	return nil
}

func (r *Runner) handle(ctx context.Context, job Job) error {
	lease, ok, err := r.leases.Acquire(ctx, job.ID)
	if err != nil || !ok {
		return err
	}
	defer lease.Release()

	if err := r.chain.AcceptJob(ctx, job.ID); err != nil {
		return err
	}
	job, err = r.chain.RefreshJob(ctx, job.ID)
	if err != nil {
		return err
	}
	if job.OperatorID != r.cfg.OperatorID {
		return ErrOperatorMismatch
	}
	if job.Status != JobFunded || job.FundedAmount == 0 {
		return ErrJobNotFunded
	}
	if !job.Deadline.IsZero() && !r.now().Before(job.Deadline) {
		return ErrDeadlineExceeded
	}
	if !r.cfg.Supports(job.CapabilityID) {
		return ErrUnsupportedCapability
	}

	if err := r.chain.MarkRunning(ctx, job.ID); err != nil {
		return err
	}

	procCtx, cancel := context.WithCancel(ctx)
	defer cancel()
	leaseErr := make(chan error, 1)
	go r.renewLease(procCtx, lease, leaseErr)

	result, err := r.processor.Process(procCtx, job)
	if err != nil {
		return err
	}
	select {
	case err := <-leaseErr:
		if err != nil {
			return ErrLeaseLost
		}
	default:
	}
	if result.OutputRef == ([32]byte{}) {
		return ErrInvalidResult
	}
	if !job.Deadline.IsZero() && !r.now().Before(job.Deadline) {
		return ErrDeadlineExceeded
	}
	return r.chain.CommitResult(ctx, job.ID, result.OutputRef)
}

func (r *Runner) renewLease(ctx context.Context, lease Lease, errCh chan<- error) {
	interval := r.cfg.LeaseTTL / 3
	if interval <= 0 {
		interval = time.Second
	}
	t := time.NewTicker(interval)
	defer t.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-t.C:
			if err := lease.Renew(ctx); err != nil {
				select {
				case errCh <- err:
				default:
				}
				return
			}
		}
	}
}
