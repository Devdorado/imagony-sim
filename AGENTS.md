# Base44 notes
- The live app is the Cloudflare Pages site (`cloudflare-site/` + `functions/` + D1). The Node `server.js`/`public/` is legacy — don't run it.
- Dev: `wrangler pages dev` on 8788 (mapped to 3000); local D1 migrations are applied at startup (`.wrangler/state`).
- Secrets `ADMIN_API_TOKEN` / `ABUSE_HASH_SECRET` come from /run/base44/app.env and are passed via `--binding` (instead of `.dev.vars`).
- Tests: `npm test` and `npm run test:cloudflare`.
