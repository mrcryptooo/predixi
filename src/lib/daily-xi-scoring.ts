// ─────────────────────────────────────────────────────────────────────────────
// Daily XI Scoring — pure calculation helpers, no I/O
//
// Used by: /api/admin/score-daily-xi
// ─────────────────────────────────────────────────────────────────────────────

export type PlayerStats = {
  playerId:    string
  goals:       number
  assists:     number
  cleanSheet:  boolean
  rating:      number   // e.g. 7.5
  yellowCards: number
  redCards:    number
  played:      boolean
}

export type PlayerScoreBreakdown = {
  playerId:  string
  xp:        number
  breakdown: {
    played:      number
    goals:       number
    assists:     number
    cleanSheet:  number
    rating:      number
    yellowCards: number
    redCards:    number
  }
}

export type DailyXIScoreResult = {
  totalXp:         number
  playerBreakdown: PlayerScoreBreakdown[]
}

// ─────────────────────────────────────────────────────────────────────────────
// Scoring rules
//   goal:          +3
//   assist:        +2
//   cleanSheet:    +2
//   rating >= 8:   +2
//   rating >= 7:   +1
//   yellowCard:    -1
//   redCard:       -3
//   played:        +1
// ─────────────────────────────────────────────────────────────────────────────

export function calculatePlayerScore(stats: PlayerStats): PlayerScoreBreakdown {
  const breakdown = {
    played:      stats.played ? 1 : 0,
    goals:       stats.goals * 3,
    assists:     stats.assists * 2,
    cleanSheet:  stats.cleanSheet ? 2 : 0,
    rating:      stats.rating >= 8 ? 2 : stats.rating >= 7 ? 1 : 0,
    yellowCards: stats.yellowCards * -1,
    redCards:    stats.redCards * -3,
  }

  const raw = Object.values(breakdown).reduce((sum, v) => sum + v, 0)
  const xp  = Math.max(0, raw)   // floor at 0 — no negative XP per player

  return { playerId: stats.playerId, xp, breakdown }
}

export function calculateDailyXIScore(playersWithStats: PlayerStats[]): DailyXIScoreResult {
  const playerBreakdown = playersWithStats.map(calculatePlayerScore)
  const totalXp         = playerBreakdown.reduce((sum, p) => sum + p.xp, 0)
  return { totalXp, playerBreakdown }
}
