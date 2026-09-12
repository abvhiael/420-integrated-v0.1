# Registry integration examples

A safe client flow is: resolve the canonical service ID, fetch the current record, require `active`, validate expected interface/manifest commitments, then call the implementation.

For historical analysis, request an explicit version rather than reinterpreting today's current service as the implementation that existed at an older block.