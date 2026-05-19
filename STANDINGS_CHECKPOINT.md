# Standings Checkpoint — PrediXI

- football-data.org standings endpoint created: `src/app/api/football-data/standings/route.ts`
- GET /api/football-data/standings?competition=PL works (20 teams returned).
- PD standings tested and works (20 teams, Barca top).
- Standings added inside Matches page — no separate page needed.
- Fixtures / Standings tab switch added at top of Matches page.
- Competitions supported: PL, PD, BL1, SA, FL1 (switcher buttons in StandingsTable).
- Standings table shows: position, team, played, W, D, L, GD, points.
- Top 4 highlighted blue, bottom 3 marked red.
- Fixtures tab and prediction flow unchanged and still work.
- Build passed.
- Local test passed (http://localhost:3000/matches).
- Next: deploy to Vercel production.
