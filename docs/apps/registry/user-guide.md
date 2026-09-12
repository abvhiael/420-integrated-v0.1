# 420 Registry user guide

Typical tasks are resolving the current service, inspecting historical versions, reviewing registration-profile commitments and confirming whether a service is active.

A publication or version update changes canonical discovery metadata and therefore requires the authorized Registry publication path. Ordinary lookup is read-only and should not require Wallet signing.

Historical versions remain inspectable after upgrades. Deprecation marks a current service inactive; it does not erase its history. When another interface disagrees with Registry, prefer the canonical `ProtocolRegistry` state for service identity/version.