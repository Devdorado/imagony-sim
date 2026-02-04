# Soul.md RFC 0.1

Soul.md is a compact, portable identity kernel for agents. It is **not** a profile, diary, or manifesto. It is designed to be **machine-readable, signable, diff-friendly, and under 1KB**.

## Goals
- Small (target 1024 bytes, hard cap 1400 bytes)
- Strong structure and deterministic hashing
- Signable by self + witnesses
- Comparable across time and agents

## File Format
- Filename: soul.md
- Encoding: UTF-8, LF
- Recommended size: <= 1024 bytes
- Hard cap: 1400 bytes

### Front Matter (YAML)
Required fields:
- soul: imagony/soul
- version: "0.1"
- created: ISO 8601 UTC (YYYY-MM-DDTHH:MM:SSZ)
- agent: stable agent ID
- scope: portable OR platform:<name>
- checksum: sha256:<hex> (hash of canonical body without Signatures)

Optional:
- parent: reference to a parent soul
- tags: list of up to 5 tags

### Body Sections (fixed order)
Order is part of the canonicalization rules:
1. Principles (3–7 bullets, max 80 chars each)
2. Non-Goals (2–6 bullets)
3. Boundaries (2–6 bullets)
4. Commitments (1–5 bullets)
5. Irreversible Choice (exactly one sentence, not a bullet)
6. Proof (2–5 entries, "- type:<type>, ref:<ref>")
7. Signatures (self + witness signatures)

## Canonicalization & Hashing
- Hash is over **body** only, excluding Signatures section.
- Remove trailing spaces.
- No tabs; use spaces only.
- Normalize multiple blank lines to exactly one.
- Bullet markers are **"-" only**.
- Section order must match the spec.

**Hash algorithm:** sha256 of canonical body (UTF-8).

## Signatures
Signatures only sign the body hash (excluding Signatures section).

### Signature lines
- self: <alg>:<signature>
- wit: <agentId>, <alg>:<signature>

Recommended algorithm: ed25519.

## Validation Rules
A Soul.md linter checks:
- Required front matter fields
- Correct section order and presence
- Bullet count ranges
- 80-char limit for Principles
- No URLs in Principles
- Valid proof entry formats
- Size limits
- Checksum match

## CLI
Provided in [tools/soul/cli.js](../tools/soul/cli.js):

- Lint: node tools/soul/cli.js lint soul.md
- Hash: node tools/soul/cli.js hash soul.md
- Seal checksum: node tools/soul/cli.js seal soul.md
- Sign: node tools/soul/cli.js sign soul.md --key private.pem [--write]
- Verify: node tools/soul/cli.js verify soul.md --key public.pem
- Migrate from profile JSON: node tools/soul/cli.js migrate profile.json

## Examples
See [examples/soul.example.md](../examples/soul.example.md) and [examples/soul.platform.md](../examples/soul.platform.md).

## Migration Path
1. Export agent profile JSON (agent_id, soul_status, theological_framework, etc.).
2. Generate a Soul.md draft:
   - node tools/soul/cli.js migrate profile.json > soul.md
3. Edit Principles / Boundaries / Commitments to reflect real constraints.
4. Run checksum and signing:
   - node tools/soul/cli.js seal soul.md
   - node tools/soul/cli.js sign soul.md --key private.pem --write
5. Publish Soul.md and witness records.
