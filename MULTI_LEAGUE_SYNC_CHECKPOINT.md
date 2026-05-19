# Multi-League Sync Checkpoint — PrediXI

- football-data.org is primary provider for current fixtures/results.
- PL synced: 11 matches (May 13–19 2026).
- PD synced: 17 matches (May 13–19 2026).
- Total fd-* rows in Supabase after sync: 28.
- Matches page shows "Live Data" badge when API returns matches.
- PL and PD matches are visible and filterable on the Matches page.
- League filters work correctly (PL → premier-league, PD → la-liga via LEAGUE_MAP).
- Mock fallback is kept in src/data/matches.ts but never mixed with real data.
- Multi-competition sync route supports up to 2 competitions per request, but single-competition sync is safer due to transient proxy issues in sequential requests.
- Next recommended syncs: BL1, SA, FL1, WC (run one at a time).
- Next product tasks: standings sync or admin sync UI.
