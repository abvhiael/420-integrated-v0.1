package metrics

import (
	"fmt"

	"github.com/420integrated/420-integrated/analytics/methodology"
	"github.com/420integrated/420-integrated/analytics/model"
)

func registeredMethodology(metricID string) (model.Methodology, error) {
	method, err := methodology.Resolve(metricID)
	if err != nil {
		return model.Methodology{}, fmt.Errorf("resolve methodology for %s: %w", metricID, err)
	}
	return method, nil
}
