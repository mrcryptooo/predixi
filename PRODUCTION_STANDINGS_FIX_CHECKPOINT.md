# Production Standings Fix Checkpoint — PrediXI

- Standings failed on production because FOOTBALL_DATA_TOKEN was missing from Vercel environment variables.
- FOOTBALL_DATA_TOKEN was added to Vercel project env vars (server-only, no NEXT_PUBLIC_ prefix).
- Vercel redeploy after adding the env var fixed the standings endpoint.
- Production /matches Standings tab now works correctly.
- Required production env vars now include: FOOTBALL_DATA_TOKEN.
- Do NOT use NEXT_PUBLIC_FOOTBALL_DATA_TOKEN — token must remain server-side only.
