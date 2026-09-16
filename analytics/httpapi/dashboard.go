package httpapi

import (
	"net/http"

	"github.com/420integrated/420-integrated/analytics/dashboard"
)

func (s *Server) DashboardHandler() (http.Handler, error) {
	shell, err := dashboard.New(func() dashboard.StatusView {
		st := s.catalog.Status()
		return dashboard.StatusView{
			ChainID:       st.ChainID,
			IndexedHeight: st.IndexedHeight,
			SafeHeight:    st.SafeHeight,
			IndexedAt:     st.IndexedAt,
			Stale:         st.Stale,
		}
	})
	if err != nil {
		return nil, err
	}
	return shell.Handler(), nil
}
