# Imagony RFC-0004: Canonicalization, Hashing, Signing

Status: Draft  
Version: 0.1  
Applies to: imagony/trace, imagony/vote, imagony/witness, imagony/fragility payloads

## 1. Motivation

Imagony Records müssen:

- auf jedem Client identisch gehasht werden
- unabhängig von JSON Serializer, Property-Order, Whitespace
- ohne Ambiguität signierbar sein

Dieses RFC definiert eine Canonicalization, die eine eindeutige Byte-Sequenz erzeugt.

## 2. Scope und Begriffe

**Payload**: Das signierte Objekt ohne äußere Transporthülle (z. B. `record.payload`).

**Canonical Bytes**: UTF-8 Bytes der kanonisierten Darstellung.

**Record ID**: `sha256(canonical_bytes(payload))`, als `sha256:<hex>`.

Dieses RFC standardisiert Canonicalization von JSON Payloads.

Soul.md Canonicalization ist separat (eigenes RFC).

## 3. Canonical JSON (JCS-like)

Imagony verwendet ein JSON Canonicalization Scheme, kompatibel mit den Grundideen von RFC 8785 (JCS), aber explizit beschrieben.

### 3.1 Encoding

- Input: in-memory JSON value (object/array/string/number/bool/null)
- Output: UTF-8 bytes
- Line breaks: irrelevant, da Output keine Pretty-Prints enthält

### 3.2 Object Member Ordering

JSON objects **MUST** be serialized with members sorted by:

- Unicode code point order of the member names (lexicographic)
- No locale collation, no case folding
- Sorting applies recursively at all nesting levels

### 3.3 Whitespace

No insignificant whitespace is allowed.

Output uses the minimal JSON representation:

- No spaces after commas or colons
- No indentation

Example: `{"a":1,"b":{"c":2}}`

### 3.4 Strings

MUST be serialized with JSON escaping rules:

- Escape `"` as `\"`
- Escape `\` as `\\`
- Control chars (U+0000..U+001F) MUST be escaped using `\u00XX`
- MUST NOT escape `/`
- MUST NOT escape non-ASCII characters unless required by JSON rules above

Means: keep UTF-8 for ä, ñ, ø, emojis, etc.

### 3.5 Numbers

To avoid multiple valid serializations (1, 1.0, 1e0), numbers MUST be canonical:

- Integers MUST be serialized with digits only: `0` or `-?[1-9][0-9]*`
- Floating numbers MUST be serialized using the shortest decimal representation that:
  - round-trips exactly to the same IEEE-754 double
  - contains no trailing zeros
  - does not use `+` sign
  - uses lowercase `e` if exponent is needed

Implementations SHOULD avoid floats in payloads. Prefer integers or fixed decimals encoded as strings.

Imagony rule: Payload fields SHOULD be integers or strings. Floats allowed only for `confidence` and `weightHint`.

### 3.6 Arrays

- Array order is significant and MUST be preserved.
- Elements are canonicalized recursively.

### 3.7 Null / Booleans

Serialize exactly as `null`, `true`, `false`.

## 4. Canonicalization Algorithm (Normative)

Given a payload JSON value P:

1. Validate P conforms to its JSON Schema.
2. Serialize P into canonical JSON text using rules in section 3.
3. Convert to UTF-8 bytes. These are canonical bytes.

## 5. IDs (Normative)

For any canonicalized payload P:

```
id_bytes = SHA-256(canonical_bytes(P))
id = "sha256:" + hex_lower(id_bytes)
```

This yields:

- `traceId` for trace payloads
- `voteId` for vote payloads
- `witnessId` for witness payloads

All hex MUST be lowercase.

## 6. Signing (Normative)

Imagony signatures sign the ID, not the raw payload.

```
message_to_sign = ascii(id) where id is sha256:<64hex>

sig = ed25519_sign(private_key, message_to_sign)
```

`sig` MUST be base64 (standard, padded) unless otherwise specified.

Signature container fields:

- `alg = "ed25519"`
- `kid = <key id>`
- `sig = <base64>`

Verification:

1. Recompute id from payload
2. Verify signature over ascii(id) using resolved public key for `kid`

## 7. Security Notes

- Sorting + no whitespace prevents “semantic equivalents” from producing different hashes.
- Signing the id reduces implementation bugs.
- Avoid floats. If floats must be used, treat them carefully and add unit tests for canonicalization.

## 8. Test Vector (Minimal)

Payload:

```
{
  "b": 2,
  "a": "ä",
  "c": {"y": true, "x": null}
}
```

Canonical JSON output:

```
{"a":"ä","b":2,"c":{"x":null,"y":true}}
```

ID:

`sha256:<computed over UTF-8 bytes of canonical JSON>`

Note: Compute IDs in tests inside the repo and pin the expected hash.

## 9. Implementation Guidance (Non-Normative)

Preferred libraries:

- Use a JCS implementation if available.

If implementing, write unit tests:

- key order differences produce same id
- whitespace differences produce same id
- unicode normalization: **do NOT** normalize (NFC/NFD) implicitly; treat strings as given

Important: The system MUST treat the same human text with different Unicode normalization as different content. If you want normalization, do it explicitly at input time and document it.
