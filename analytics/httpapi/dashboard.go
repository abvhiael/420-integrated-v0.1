package httpapi

import (
	"net/http"

	"github.com/420integrated/420-integrated/analytics/dashboard"
)

func (s *Server) DashboardHandler() (http.Handler, error) {
	statusProvider := func() dashboard.StatusView {
		st := s.catalog.Status()
		return dashboard.StatusView{
			ChainID: st.ChainID, IndexedHeight: st.IndexedHeight, SafeHeight: st.SafeHeight,
			IndexedAt: st.IndexedAt, Stale: st.Stale,
		}
	}
	shell, err := dashboard.NewWithTrust(
		statusProvider,
		func() dashboard.Presentation { return dashboard.BuildPresentation(s.catalog.Metrics(), s.catalog.Series()) },
		func() dashboard.TrustPresentation {
			st := s.catalog.Status()
			return dashboard.BuildTrustPresentation(s.catalog.Metrics(), s.catalog.Series(), s.catalog.Forecasts(), s.catalog.Anomalies(), st.Stale)
		},
	)
	if err != nil { return nil, err }
	return shell.Handler(), nil
}
