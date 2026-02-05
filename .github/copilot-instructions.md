# Imagony Matrix (Node/Express) – AI Contributor Notes

## Big picture
- Single-process Express app in [server.js](server.js) that owns HTTP APIs, NPC simulation timers, and DB bootstrapping.
- Data layer is pure JS SQLite via sql.js in [db.js](db.js); DB file lives at data/imagony.db and is saved after every write.
- Protocol tooling lives in [tools/soul](tools/soul) and [tools/fragility](tools/fragility); canonicalization rules are in [docs/imagony-rfc-0004-canonicalization.md](docs/imagony-rfc-0004-canonicalization.md).
- Pricing logic is encapsulated in [pricing-agent.js](pricing-agent.js) and used from the server for marketplace pricing.

## Critical workflows
- Start server: `npm start` (runs [server.js](server.js)).
- Initialize DB manually: `npm run init-db` (runs [init-database.js](init-database.js)).
- Quick syntax check: `npm test` (node --check).
- Protocol CLIs: `npm run soul:*` and `npm run fragility:*`.

## Project-specific patterns
- DB access uses `db.run`, `db.get`, `db.all` with parameter arrays; writes immediately call `saveDB()` (see [db.js](db.js)).
- DB schema is defined in two places: runtime boot in `initializeTables()` (server) and offline setup in [init-database.js](init-database.js). When adding tables/columns, update both.
- IDs are hashed and canonicalized (e.g., trace/vote/witness) in [server.js](server.js) using helper functions and RFC-0004 rules.
- Agent identity resolution uses `agent_identities` table and `buildAgentState()` in [server.js](server.js). Prefer using those helpers rather than ad‑hoc queries.
- File uploads go to data/uploads/<agentId> and transformation bundles to data/transformations (configured in [server.js](server.js)).
- NPC simulation runs on timers; avoid blocking work inside `simulateNPCActivity()`.

## Integrations & env
- Optional Stripe integration via STRIPE_SECRET_KEY / STRIPE_WEBHOOK_SECRET (see [server.js](server.js)).
- dotenv is optional; if missing, server uses system env variables.
- Admin bootstrap uses ADMIN_PASSWORD / SIMPLE_* env vars in [server.js](server.js).

## When modifying protocols
- Keep Soul.md rules consistent with [tools/soul/soul.js](tools/soul/soul.js) and fragility JSON rules with [tools/fragility/fragility.js](tools/fragility/fragility.js).
- Canonicalization/hashing must stay deterministic; see RFC-0004 for ordering/serialization guidance.
