# Football Data Checkpoint — PrediXI

- API-Football test works, but free plan is limited for current season.
- football-data.org token works and provides current fixtures.
- football-data.org is now primary provider for fixtures/results/standings.
- 11 Premier League matches May 13–19 were synced into Supabase with fd-* IDs.
- GET /api/matches?source=fd works.
- Matches page shows only real matches when available.
- Mock matches are fallback only and are not mixed with real data.
- Prediction flow works with fd-* match IDs.
- Next: sync PD, BL1, SA, FL1, WC; add standings sync; later use API-Football for player stats.
