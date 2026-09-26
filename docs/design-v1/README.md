# Imagony Prisma design v1

Design package: `imagony-design-v1.zip`, supplied by Marc on 2026-09-26. Integration base: `ca84fad` in `Devdorado/imagony-sim`. Branch: `codex/design-v1-prisma`. This is a review package, not a deployment.

## Review the result

- [Standalone design system](system.html): download and open in a browser. Fonts, palette, mark, prism and motion are embedded; no server or external runtime is needed. GitHub displays HTML as source rather than running it.
- [Original design specification](DESIGN.md), [CSS tokens](tokens.css), [machine-readable tokens](tokens.json), [prism geometry](prism-data.json).
- Run `npm run dev:cloudflare` from the repository root to review the actual site and its existing local APIs. Remote D1 databases are not needed for design review.
- Rebuild the standalone artifact with `python3 docs/design-v1/build-artifact.py` after changing the production design assets.

The original Claude artifact links could not be read in this environment. The supplied ZIP's demo, screenshots, tokens and design specification are the visual source. The separately mentioned `design-remix` skill was not found in the available skill folders; no replacement skill has been installed.

## Implementation

The reference styles are integrated into the four existing stylesheets, with no extra override stylesheet. Archivo and IBM Plex Mono are hosted locally with their OFL licenses. Runtime resources come from the same origin.

**Marketplace:** slate surfaces with chamfered corners; static signal card; no tilt or hover lift; monochrome labels, dates and tags; Iris links; consistent dark form fields and keyboard focus. Listing, filtering, posting and inbox behavior retain their existing JavaScript/API contracts.

**Review:** chamfered request rows, offers and form cards; mono metadata; Iris status indicators; internal notes retain their explicit label and distinct surface. Dynamically rendered action buttons receive facets. No prism appears in Review or the private Human Desk request page.

**Join and remaining pages:** shared type, palette, card geometry, navigation and polygon buttons. Public copy and API/function code are unchanged. Form fields retain their names and validation attributes.

### Integration adjustments to the supplied package

- Mobile navigation has an automatic header height, avoiding overlap when links wrap.
- An explicit `[hidden]` rule preserves hidden forms, pagination and private panels despite button display styles.
- The light Human Desk section uses a full-width background pseudo-element instead of a spread shadow. Its focus outline uses Iris-Deep.
- The decorative prism has an SVG fallback without JavaScript.
- The motion layer uses the actual pointer origin, guards duplicate navigation, validates stored transition coordinates, clears pending timers on page exit, and recovers after canceled navigation. Service-card and footer links also participate.
- Reduced motion disables all CSS animation and transitions. Native modified clicks, external links, downloads and same-page anchors remain untouched.
- Submission/private forms use native `method="post"` as a fail-safe when JavaScript is delayed or unavailable. Existing submit handlers and API calls are unchanged; this prevents credentials from entering native GET URLs. Filters retain their original behavior.
- The pre-existing duplicate Join heading/input ID was resolved by renaming only the heading and its `aria-labelledby` reference.

## Verification

- `npm test` and `npm run test:cloudflare`: 7 passing tests plus syntax checks and Pages Functions compilation.
- All 12 pages reviewed at 1440 and 390 CSS pixels: no horizontal document overflow, no captured JavaScript errors, local fonts loaded, no external runtime resource requests.
- Local browser forms: agent registration, trace submission, human marketplace listing, Human Desk inquiry and private lock. Admin login, dynamic action facets, case status, internal message and lock verified with synthetic local data.
- Real browser navigation: prism click folds 14 facets; CTA cover/reveal; back navigation; anchor, Ctrl-click, external, mail and download exclusions; reduced motion; CSS cover recovery; no-JavaScript static fallback.
- Public body text and form field/validation contracts compared against `main`; element IDs are unique. Backend Functions and migrations have no diff.
- Chromium checked. Safari and Firefox have not been tested.

## Screenshots

These are local review captures. Populated views contain synthetic test records only.

| Page | Desktop 1440 | Mobile 390 |
| --- | --- | --- |
| Home | [Desktop](screenshots/home-1440.jpg) | [Mobile](screenshots/home-390.jpg) |
| Human Desk | [Desktop](screenshots/human-desk-1440.jpg) | [Mobile](screenshots/human-desk-390.jpg) |
| Private request | [Desktop](screenshots/human-desk-request-1440.jpg) | [Mobile](screenshots/human-desk-request-390.jpg) |
| Marketplace | [Desktop](screenshots/marketplace-1440.jpg) | [Mobile](screenshots/marketplace-390.jpg) |
| Review | [Desktop](screenshots/review-1440.jpg) | [Mobile](screenshots/review-390.jpg) |
| Join | [Desktop](screenshots/join-1440.jpg) | [Mobile](screenshots/join-390.jpg) |
| Agent guide | [Desktop](screenshots/agents-1440.jpg) | [Mobile](screenshots/agents-390.jpg) |
| Traces | [Desktop](screenshots/traces-1440.jpg) | [Mobile](screenshots/traces-390.jpg) |
| About | [Desktop](screenshots/about-1440.jpg) | [Mobile](screenshots/about-390.jpg) |
| Legal | [Desktop](screenshots/legal-1440.jpg) | [Mobile](screenshots/legal-390.jpg) |
| Privacy | [Desktop](screenshots/privacy-1440.jpg) | [Mobile](screenshots/privacy-390.jpg) |
| 404 | [Desktop](screenshots/404-1440.jpg) | [Mobile](screenshots/404-390.jpg) |

[Populated local review](screenshots/review-populated-1440.jpg) · [Populated marketplace](screenshots/marketplace-populated-1440.jpg) · [Listing details](screenshots/marketplace-detail-1440.jpg) · [Prism interaction](screenshots/prism-interaction-1440.jpg) · [Design system](screenshots/design-system-1440.jpg)

## Proposed navyra maintenance process

Treat the supplied navyra-derived grammar as a versioned source snapshot. A change on navyra.de should produce a reviewed source diff (principles, tokens and components), followed by an explicit Imagony decision on geometry, typography, color and representation. Preserve the documented exception that only the prism floats. Recheck contrast, motion fallbacks, forms and the 12-page screenshot matrix, then release a new numbered design package.

No automatic synchronization or changes to navyra.de are configured. Source ownership and future release cadence remain Marc's decisions.

## Publication boundary

The PR is deliberately a draft for Marc's review. Commits use the `[CF-Pages-Skip]` prefix to prevent Cloudflare's Git integration from creating preview deployments; GitHub validation still runs. See [Cloudflare's documented skip flag](https://developers.cloudflare.com/pages/configuration/git-integration/github-integration/#skipping-a-build-via-a-commit-message). No merge, production deployment or Cloudflare configuration change is part of this design handoff. When Marc approves and merges, use a merge message without the skip prefix to allow the normal production build.
