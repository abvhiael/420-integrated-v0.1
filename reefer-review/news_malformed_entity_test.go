package reeferreview

import (
	"strings"
	"testing"
)

func TestRR11MalformedPublisherEntityRecovery(t *testing.T) {
	feed := []byte(`<rss><channel><item><title>Cannabis &y market</title><link>https://example.com/news?x=1&amp;y=2</link><description>Hemp &copy; &amp; retail</description></item></channel></rss>`)
	entries, err := ParseNewsFeed(feed)
	if err != nil || len(entries) != 1 {
		t.Fatalf("publisher entity recovery: %v, %d entries", err, len(entries))
	}
	if entries[0].Title != "Cannabis &y market" || !strings.Contains(entries[0].Summary, "Hemp &copy; & retail") {
		t.Fatalf("unexpected feed content: %+v", entries[0])
	}
}

func TestRR11MalformedPublisherEntityDoesNotEnableDTD(t *testing.T) {
	for _, payload := range []string{
		`<!DOCTYPE rss [<!ENTITY xxe SYSTEM "file:///etc/passwd">]><rss><channel><item><title>&xxe;</title></item></channel></rss>`,
		`<!ENTITY x "foo"><rss><channel></channel></rss>`,
	} {
		if _, err := ParseNewsFeed([]byte(payload)); err == nil {
			t.Fatal("unsafe XML declaration accepted")
		}
	}
}
