package storage

import (
	"fmt"
	"net/http"
)

func (t *transportServer) metrics(w http.ResponseWriter, r *http.Request) {
	if !t.requireAuth(w, r, false) { return }
	if r.Method != http.MethodGet {
		w.Header().Set("Allow", http.MethodGet)
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	if t.service == nil || t.service.runtime == nil || t.service.reconciler == nil {
		http.Error(w, "service unavailable", http.StatusServiceUnavailable)
		return
	}
	status := t.service.Status()
	capacity := t.service.runtime.Capacity()
	m := t.service.reconciler.Metrics()
	ready := 0
	if status.Ready { ready = 1 }
	degraded := 0
	if status.Degraded { degraded = 1 }
	w.Header().Set("Content-Type", "text/plain; version=0.0.4")
	fmt.Fprintf(w, "fourtwenty_store_ready %d\n", ready)
	fmt.Fprintf(w, "fourtwenty_store_degraded %d\n", degraded)
	fmt.Fprintf(w, "fourtwenty_store_capacity_total_bytes %d\n", capacity.TotalBytes)
	fmt.Fprintf(w, "fourtwenty_store_capacity_used_bytes %d\n", capacity.UsedBytes)
	fmt.Fprintf(w, "fourtwenty_store_reconcile_runs_total %d\n", m.Runs)
	fmt.Fprintf(w, "fourtwenty_store_reconcile_success_total %d\n", m.Successes)
	fmt.Fprintf(w, "fourtwenty_store_reconcile_failures_total %d\n", m.Failures)
	fmt.Fprintf(w, "fourtwenty_store_reconcile_stale_removed_total %d\n", m.StaleRemoved)
	fmt.Fprintf(w, "fourtwenty_store_reconcile_corrupt_removed_total %d\n", m.CorruptRemoved)
	fmt.Fprintf(w, "fourtwenty_store_reconcile_capacity_corrections_total %d\n", m.CapacityCorrections)
	fmt.Fprintf(w, "fourtwenty_store_missing_shards %d\n", status.MissingShards)
	fmt.Fprintf(w, "fourtwenty_store_missed_proof_windows %d\n", status.MissedProofWindows)
	fmt.Fprintf(w, "fourtwenty_store_reconcile_consecutive_failures %d\n", m.ConsecutiveFailures)
}
