# BC-3 Chess release reconciliation

Owner requested live Chess activation on 2026-11-26. Use the established BC-0.12 version-2 developer-authorized release record; this is authorization, not evidence of a completed deployed match. Baseline 0c9760f30bdee9a3c04a36691d2b6c56d476b18e contains BC-3.2–3.7 implementation; retained PR #1429 evidence documents successful repository checks, not production acceptance.

The production Pages main build enables Chess only with account, room and communications activation; BG_CHESS_ACTIVATION=false rolls it back. The backend remains independently operator-controlled through SOCIAL420_CHESS_MODE=restricted-acceptance and existing readiness checks. Do not bypass schema/grant preflights or change unrelated games. The disabled frontend shows deployment-specific availability, not the obsolete registry-only claim.

Before claiming live completion: verify exact-head CI, database migrations and least-privilege grants, deploy the social backend and frontend, verify authenticated human/bot start and legal move, persistence/reconnect, clocks/history and deployed artwork. No live acceptance is claimed by this record.
