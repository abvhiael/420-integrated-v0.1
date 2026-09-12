# Identity API and reads

Derived APIs may expose public profiles and credential summaries, but security-sensitive applications should recheck canonical validity.

A safe credential query must account for credential existence, revocation, subject rejection, expiry, issuer activation/trust class and subject-profile activity.