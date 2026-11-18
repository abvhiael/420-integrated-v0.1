package api

import (
	"net/http"
	"strings"

	"github.com/420integrated/420-integrated/appstore/curation"
)

// GenesisHandler serves curated descriptions independently of Registry views.
func GenesisHandler(apps []curation.GenesisApplication) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		category := strings.TrimSpace(r.URL.Query().Get("category"))
		query := strings.ToLower(strings.TrimSpace(r.URL.Query().Get("q")))
		items := make([]curation.GenesisApplication, 0, len(apps))
		for _, app := range apps {
			if category != "" && !strings.EqualFold(category, app.Category) {
				continue
			}
			fields := []string{app.Name, app.ServiceID, app.Category, app.Description}
			for _, expression := range app.Expressions {
				fields = append(fields, expression.Name, expression.Description)
			}
			for _, field := range fields {
				if strings.Contains(strings.ToLower(field), query) {
					items = append(items, app)
					break
				}
			}
		}
		writeJSON(w, http.StatusOK, struct {
			Items []curation.GenesisApplication `json:"items"`
		}{Items: items})
	})
}
