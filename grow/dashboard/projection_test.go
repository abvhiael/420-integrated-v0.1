package dashboard

import (
	"strings"
	"testing"
)

func TestProjectionQueriesAreFixedAllowlistedAndTenantScoped(t *testing.T) {
	for _, section := range []string{"overview", "facilities", "plants", "environment", "equipment", "cultivation", "harvests", "inventory", "advice", "notifications"} {
		query, err := sectionQuery(section)
		if err != nil || !strings.Contains(query, "tenant_id=$1::uuid") ||
			!strings.Contains(query, "LIMIT 100") || !strings.Contains(query, "ORDER BY") {
			t.Fatalf("invalid bounded scoped projection %s: %s %v", section, query, err)
		}
	}
	for _, invalid := range []string{"", "admin", "equipment; DROP TABLE grow_private.tenants", "../../public", "memberships"} {
		if _, err := sectionQuery(invalid); err == nil {
			t.Fatalf("unknown projection accepted %q", invalid)
		}
	}
}
