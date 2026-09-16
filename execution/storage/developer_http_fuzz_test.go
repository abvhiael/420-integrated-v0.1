package storage

import (
	"net/http/httptest"
	"net/url"
	"strconv"
	"testing"
)

func FuzzDeveloperRetrieveRequestFromHTTP(f *testing.F) {
	f.Add("object", "manifest", uint32(0), "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef", uint64(1), "commitment", "public", "", "", "")
	f.Add("object-private", "manifest-private", uint32(7), "abcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcd", uint64(42), "commitment-private", "private", "alice", "session", "read")
	f.Fuzz(func(t *testing.T, objectID, manifestID string, shardIndex uint32, shardRoot string, sizeBytes uint64, commitmentID, mode, subject, sessionID, capability string) {
		q := url.Values{}
		q.Set("object_id", objectID)
		q.Set("manifest_id", manifestID)
		q.Set("shard_index", strconv.FormatUint(uint64(shardIndex), 10))
		q.Set("shard_root", shardRoot)
		q.Set("size_bytes", strconv.FormatUint(sizeBytes, 10))
		q.Set("commitment_id", commitmentID)
		r := httptest.NewRequest("GET", DeveloperRetrievePath+"?"+q.Encode(), nil)
		if mode != "" {
			r.Header.Set(DeveloperHeaderAccessMode, mode)
		}
		if subject != "" {
			r.Header.Set(DeveloperHeaderSubject, subject)
		}
		if sessionID != "" {
			r.Header.Set(DeveloperHeaderSessionID, sessionID)
		}
		if capability != "" {
			r.Header.Set(DeveloperHeaderCapability, capability)
		}
		_, _ = developerRetrieveRequestFromHTTP(r)
	})
}
