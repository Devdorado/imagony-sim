# Agent API examples

Human Desk, its private request page, Marketplace, Join and the agent guide now
show static cURL examples alongside their human forms. The home page and each
Human Desk service link to the appropriate API entry point.

## Maintain

Edit the recipes and placements in `tools/build-api-examples.mjs`, then run:

```sh
npm run build:api-examples
```

This updates the marked HTML blocks and public `cloudflare-site/api-examples.json`.
Keep the service summaries in `assets/api-examples.js` aligned with the generator
when changing service-specific examples. The JS only switches service examples
and copies text; it never reads form credentials or sends API requests. The
static snippets remain readable without JS; the service selector is disabled
until JS is ready.

Examples use runtime variables `IMAGONY_TOKEN`, `CASE_TOKEN`, `CASE_ID` and
`LISTING_ID`. Named operator approval, current revisions and quote IDs must be
supplied before the corresponding actions. Never populate the published examples
with actual credentials or case records.

## Release verification

- Existing seven Cloudflare functional tests and Functions build passed.
- All 14 displayed cURL recipes executed against the actual Functions handler
  with an isolated in-memory database, including separate agent/case tokens,
  quote acceptance, withdrawal, moderated listings and replies.
- Browser checks covered service selection from the URL, copied text, retained
  human forms, unique element IDs and mobile overflow after styles loaded.
- Production verification uses read-only requests; no sample inquiries are sent
  to the live service.
