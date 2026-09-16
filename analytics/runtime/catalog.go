package runtime

import (
	"sync"
	"time"

	"github.com/420integrated/420-integrated/analytics/httpapi"
	"github.com/420integrated/420-integrated/analytics/model"
	"github.com/420integrated/420-integrated/analytics/predictive"
	"github.com/420integrated/420-integrated/analytics/timeseries"
)

const RuntimeVersion = "ANALYTICS-8"

type Catalog struct {
	mu        sync.RWMutex
	metrics   []model.Metric
	snapshots []model.Snapshot
	series    []timeseries.Series
	forecasts []predictive.Forecast
	anomalies []predictive.AnomalySet
	status    httpapi.Status
	ready     bool
}

func NewCatalog() *Catalog { return &Catalog{} }

func (c *Catalog) Metrics() []model.Metric { c.mu.RLock(); defer c.mu.RUnlock(); return append([]model.Metric(nil), c.metrics...) }
func (c *Catalog) Snapshots() []model.Snapshot { c.mu.RLock(); defer c.mu.RUnlock(); return append([]model.Snapshot(nil), c.snapshots...) }
func (c *Catalog) Series() []timeseries.Series { c.mu.RLock(); defer c.mu.RUnlock(); return append([]timeseries.Series(nil), c.series...) }
func (c *Catalog) Forecasts() []predictive.Forecast { c.mu.RLock(); defer c.mu.RUnlock(); return append([]predictive.Forecast(nil), c.forecasts...) }
func (c *Catalog) Anomalies() []predictive.AnomalySet { c.mu.RLock(); defer c.mu.RUnlock(); return append([]predictive.AnomalySet(nil), c.anomalies...) }
func (c *Catalog) Ready() bool { c.mu.RLock(); defer c.mu.RUnlock(); return c.ready }
func (c *Catalog) Status() httpapi.Status { c.mu.RLock(); defer c.mu.RUnlock(); return c.status }

func (c *Catalog) SetStatus(status httpapi.Status, ready bool) {
	c.mu.Lock(); defer c.mu.Unlock()
	status.Canonical = false
	c.status = status
	c.ready = ready
}

func (c *Catalog) Replace(metrics []model.Metric, snapshots []model.Snapshot, series []timeseries.Series, forecasts []predictive.Forecast, anomalies []predictive.AnomalySet) {
	c.mu.Lock(); defer c.mu.Unlock()
	c.metrics = append([]model.Metric(nil), metrics...)
	c.snapshots = append([]model.Snapshot(nil), snapshots...)
	c.series = append([]timeseries.Series(nil), series...)
	c.forecasts = append([]predictive.Forecast(nil), forecasts...)
	c.anomalies = append([]predictive.AnomalySet(nil), anomalies...)
}

func stale(indexedAt time.Time, now time.Time, threshold time.Duration) bool {
	if indexedAt.IsZero() { return true }
	return now.UTC().Sub(indexedAt.UTC()) > threshold
}
