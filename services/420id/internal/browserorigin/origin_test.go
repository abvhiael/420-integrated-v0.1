package browserorigin

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestSameOrigin(t *testing.T) {
	const origin = "https://wallet.420integrated.org"
	cases := []struct {
		name    string
		headers http.Header
		want    bool
	}{
		{"origin", http.Header{"Origin": {origin}}, true},
		{"same origin metadata", http.Header{"Referer": {origin + "/"}, "Sec-Fetch-Site": {"same-origin"}}, true},
		{"missing origin and referer", http.Header{"Sec-Fetch-Site": {"same-origin"}}, false},
		{"missing fetch metadata", http.Header{"Referer": {origin + "/"}}, false},
		{"same-site subdomain", http.Header{"Referer": {"https://auth.420integrated.org/"}, "Sec-Fetch-Site": {"same-site"}}, false},
		{"explicit null", http.Header{"Origin": {"null"}, "Referer": {origin + "/"}, "Sec-Fetch-Site": {"same-origin"}}, false},
		{"deceptive hostname", http.Header{"Referer": {origin + ".invalid/"}, "Sec-Fetch-Site": {"same-origin"}}, false},
		{"duplicate referers", http.Header{"Referer": {origin + "/", origin + "/"}, "Sec-Fetch-Site": {"same-origin"}}, false},
	}
	for _, test := range cases {
		t.Run(test.name, func(t *testing.T) {
			r := httptest.NewRequest(http.MethodPost, origin+"/", nil)
			r.Header = test.headers
			if got := SameOrigin(r, origin); got != test.want {
				t.Fatalf("SameOrigin = %v, want %v", got, test.want)
			}
		})
	}
}
