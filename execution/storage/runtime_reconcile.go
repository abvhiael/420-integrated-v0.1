package storage

import "errors"

var ErrCapacityDrift = errors.New("storage capacity drift")

func (r *Runtime) reconcileCapacity(records []ShardRecord) (changed bool, err error) {
	if r == nil { return false, ErrCapacityDrift }
	var used uint64
	for _, rec := range records {
		if ^uint64(0)-used < rec.SizeBytes { return false, ErrCapacityDrift }
		used += rec.SizeBytes
	}
	r.mu.Lock()
	defer r.mu.Unlock()
	if used > r.capacity.TotalBytes || r.reservedBytes > r.capacity.TotalBytes-used {
		return false, ErrCapacityExceeded
	}
	changed = r.capacity.UsedBytes != used
	r.capacity.UsedBytes = used
	return changed,nil
}
