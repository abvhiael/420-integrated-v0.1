# 420 Names architecture

The application presents canonical `Names420` state. Indexer/Search/Wallet may cache or display names, but `Names420` remains authoritative for ownership, expiry and resolution.

Commitments are domain-separated with `420/NAMES/COMMITMENT/V1`. Name transfer is nominate/accept. Resolution links to Identity or Registry are optional and bounded to those referenced domains.

Names and Identity form a strong binding only when both protocols agree.