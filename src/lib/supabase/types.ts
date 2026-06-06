/**
 * Phase 4A — Supabase database TypeScript types
 *
 * These types mirror the `supabase/schema.sql` table definitions and are
 * aligned with the existing app domain types in `src/types/index.ts`.
 *
 * Conventions:
 *   - DB rows use snake_case (Postgres convention)
 *   - Outcome stored as 'H' | 'D' | 'A' in DB, maps to app's 'home' | 'draw' | 'away'
 *   - All timestamps are ISO 8601 strings (Supabase returns them as strings)
 */

// ─────────────────────────────────────────────────────────────────────────────
// Shared primitives
// ─────────────────────────────────────────────────────────────────────────────

/** DB outcome codes — map to app MatchOutcome via outcomeToDb / outcomeFromDb */
export type DbOutcome = 'H' | 'D' | 'A'

export type DbUserRank = 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond' | 'legend'

export type DbMatchStatus = 'upcoming' | 'live' | 'finished' | 'postponed'

export type DbBadgeRarity = 'common' | 'rare' | 'epic' | 'legendary'

export type DbBadgeCategory =
  | 'streak'
  | 'accuracy'
  | 'volume'
  | 'special'
  | 'league'
  | 'worldcup'

export type DbLeaderboardPeriod = 'all_time' | 'weekly' | 'monthly'

// ─────────────────────────────────────────────────────────────────────────────
// Table row types (what Supabase returns for SELECT *)
// ─────────────────────────────────────────────────────────────────────────────

export type ProfileRow = {
  id: string                      // UUID
  wallet_address: string          // Ethereum address (lowercased)
  username: string | null
  display_name: string | null
  avatar: string | null           // emoji or URL
  xp: number
  rank: DbUserRank
  streak: number
  total_predictions: number
  correct_predictions: number
  country: string | null
  country_flag: string | null     // emoji
  created_at: string              // ISO timestamp
  updated_at: string
}

export type MatchRow = {
  id: string                      // matches existing mock IDs (text PK)
  league_id: string
  home_team_id: string
  home_team_name: string
  home_team_short: string         // 3-letter code
  away_team_id: string
  away_team_name: string
  away_team_short: string
  kickoff: string                 // ISO timestamp
  status: DbMatchStatus
  home_score: number | null
  away_score: number | null
  matchday: number | null
  venue: string | null
  actual_outcome: DbOutcome | null  // null until match finishes
  community_home: number          // percentage 0–100
  community_draw: number
  community_away: number
  created_at: string
  updated_at: string
  // ── Media / provider fields ─────────────────────────────────────────────────
  // Added by supabase/add-team-crests.sql (already in DB):
  home_team_crest: string | null  // team badge CDN URL from API
  away_team_crest: string | null  // team badge CDN URL from API
  // Added by supabase/add-match-media-fields.sql:
  league_logo:     string | null  // league logo CDN URL (APF league.logo)
  country_flag:    string | null  // country flag CDN URL (APF country.flag)
  // API source traceability: 'fd' | 'apf' | 'mock' | null
  api_source:      string | null
}

export type PredictionRow = {
  id: string                      // UUID
  profile_id: string              // FK → profiles.id
  match_id: string                // FK → matches.id
  outcome: DbOutcome              // 'H' | 'D' | 'A'
  points_awarded: number | null   // null until match settles
  is_correct: boolean | null      // null until match settles
  placed_at: string               // ISO timestamp
  created_at: string
  updated_at: string
  // Onchain commitment columns (added by supabase/add-onchain-metadata.sql)
  commitment_hash: string | null  // keccak256 hex of the canonical payload
  submitted_onchain: boolean      // true after user anchors on Base
  tx_hash: string | null          // Base Mainnet tx hash after anchor
}

export type LeaderboardStatRow = {
  id: string                      // UUID
  profile_id: string              // FK → profiles.id
  period: DbLeaderboardPeriod
  xp: number
  position: number | null
  accuracy: number                // 0.00–100.00
  total_predictions: number
  correct_predictions: number
  weekly_xp: number
  computed_at: string
  created_at: string
}

export type BadgeRow = {
  id: string                      // matches existing mock badge IDs
  name: string
  description: string | null
  icon: string | null             // emoji
  rarity: DbBadgeRarity
  category: DbBadgeCategory
  xp_reward: number
  criteria: string | null
  created_at: string
}

export type UserBadgeRow = {
  id: string                      // UUID
  profile_id: string              // FK → profiles.id
  badge_id: string                // FK → badges.id
  awarded_at: string              // ISO timestamp
  // Onchain mint state (added by supabase/add-badge-nft-minting.sql)
  minted_onchain:  boolean        // false = Ready to Mint, true = Owned on Base
  minted_at:       string | null  // ISO timestamp — set when mint is persisted
  onchain_tx_hash: string | null  // Base Mainnet tx hash
  token_id:        number | null  // ERC-1155 token ID (1–25) — null until minted
  chain_id:        number         // always 8453 (Base Mainnet)
}

// ─────────────────────────────────────────────────────────────────────────────
// Insert types (subset — omit server-generated fields)
// ─────────────────────────────────────────────────────────────────────────────

export type InsertProfile = Omit<ProfileRow, 'id' | 'created_at' | 'updated_at'>

export type InsertPrediction = {
  profile_id: string
  match_id: string
  outcome: DbOutcome
  placed_at?: string
}

export type InsertUserBadge = {
  profile_id: string
  badge_id: string
  awarded_at?: string
  // Onchain fields are optional on insert — default to false/null via DB defaults
  minted_onchain?:  boolean
  minted_at?:       string | null
  onchain_tx_hash?: string | null
  token_id?:        number | null
  chain_id?:        number
}

// ─────────────────────────────────────────────────────────────────────────────
// badge_mint_nonces — EIP-712 nonce replay prevention
// Added by supabase/add-badge-nft-minting.sql (Phase 3)
// ─────────────────────────────────────────────────────────────────────────────

export type BadgeMintNonceRow = {
  nonce:          string          // bytes32 hex (0x-prefixed) — PRIMARY KEY
  wallet_address: string          // lowercase 0x Ethereum address
  badge_id:       string          // e.g. 'first-pred'
  token_id:       number          // ERC-1155 token ID (1–25)
  created_at:     string          // ISO timestamp — when the signature was issued
  used_at:        string | null   // ISO timestamp — null until mint tx confirmed
}

export type InsertBadgeMintNonce = {
  nonce:          string
  wallet_address: string
  badge_id:       string
  token_id:       number
  // created_at has DB DEFAULT now() — omit on insert
  // used_at intentionally null on insert — set only after mint confirms
}

// ─────────────────────────────────────────────────────────────────────────────
// standings — cached league standings from API-Football
// Added by supabase/add-standings.sql (Phase D)
// ─────────────────────────────────────────────────────────────────────────────

export type StandingRow = {
  id:            string          // UUID primary key
  league_id:     string          // competition code, e.g. 'PL' (matches matches.league_id)
  league_name:   string          // e.g. 'Premier League'
  league_logo:   string | null   // CDN URL from APF
  country:       string | null   // e.g. 'England'
  country_flag:  string | null   // CDN URL from APF
  season:        number          // e.g. 2025 (for 2025/26)
  team_id:       string          // 'apf-team-{id}' (matches matches.home/away_team_id)
  team_name:     string
  team_logo:     string | null   // CDN URL from APF
  position:      number
  points:        number
  played:        number
  won:           number
  drawn:         number
  lost:          number
  goals_for:     number
  goals_against: number
  goal_diff:     number
  form:          string | null   // e.g. 'WWDLW'
  description:   string | null   // e.g. 'Champions League', 'Relegation'
  updated_at:    string          // ISO timestamp
}

export type InsertStanding = Omit<StandingRow, 'id' | 'updated_at'>

// ─────────────────────────────────────────────────────────────────────────────
// national_teams — WC 2026 national team metadata from API-Football
// Added by supabase/add-national-teams.sql (Phase WC-C)
// ─────────────────────────────────────────────────────────────────────────────

export type NationalTeamRow = {
  id:             string          // UUID primary key
  apf_team_id:    number          // APF numeric team ID
  team_id:        string          // 'apf-team-{id}' — matches matches.home/away_team_id
  name:           string          // e.g. 'Brazil'
  short_code:     string | null   // 3-letter FIFA code, e.g. 'BRA'
  country:        string | null   // country name from APF
  group_code:     string | null   // WC group letter, e.g. 'A'
  world_cup_year: number          // 2026
  source:         string          // 'apf'
  logo_url:       string | null   // APF team.logo CDN URL
  flag_url:       string | null   // APF country.flag CDN URL (if available)
  created_at:     string          // ISO timestamp
  updated_at:     string          // ISO timestamp
}

export type InsertNationalTeam = Omit<NationalTeamRow, 'id' | 'created_at' | 'updated_at'>

// ─────────────────────────────────────────────────────────────────────────────
// players — WC 2026 player squads from API-Football
// Added by supabase/add-players.sql (Phase WC-D)
// ─────────────────────────────────────────────────────────────────────────────

export type PlayerRow = {
  id:             string          // UUID primary key
  apf_player_id:  number          // APF numeric player ID
  player_id:      string          // 'apf-player-{id}'
  name:           string
  age:            number | null
  number:         number | null   // squad shirt number
  position:       string | null   // Goalkeeper | Defender | Midfielder | Attacker
  nationality:    string | null
  photo_url:      string | null   // APF player.photo CDN URL
  apf_team_id:    number
  team_id:        string          // 'apf-team-{id}'
  team_name:      string
  team_logo_url:  string | null
  world_cup_year: number          // 2026
  source:         string          // 'apf'
  created_at:     string
  updated_at:     string
}

export type InsertPlayer = Omit<PlayerRow, 'id' | 'created_at' | 'updated_at'>

// ─────────────────────────────────────────────────────────────────────────────
// Database schema shape (used as generic param for createClient<Database>)
// ─────────────────────────────────────────────────────────────────────────────

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: ProfileRow
        Insert: Partial<ProfileRow> & Pick<ProfileRow, 'wallet_address'>
        Update: Partial<ProfileRow>
      }
      matches: {
        Row: MatchRow
        Insert: Partial<MatchRow> & Pick<MatchRow, 'id' | 'league_id' | 'kickoff'>
        Update: Partial<MatchRow>
      }
      predictions: {
        Row: PredictionRow
        Insert: InsertPrediction
        Update: Partial<PredictionRow>
      }
      leaderboard_stats: {
        Row: LeaderboardStatRow
        Insert: Partial<LeaderboardStatRow> & Pick<LeaderboardStatRow, 'profile_id' | 'period'>
        Update: Partial<LeaderboardStatRow>
      }
      badges: {
        Row: BadgeRow
        Insert: Partial<BadgeRow> & Pick<BadgeRow, 'id' | 'name' | 'rarity' | 'category'>
        Update: Partial<BadgeRow>
      }
      user_badges: {
        Row: UserBadgeRow
        Insert: InsertUserBadge
        Update: Partial<UserBadgeRow>
      }
      badge_mint_nonces: {
        Row: BadgeMintNonceRow
        Insert: InsertBadgeMintNonce
        Update: Partial<BadgeMintNonceRow>
      }
      standings: {
        Row: StandingRow
        Insert: InsertStanding
        Update: Partial<StandingRow>
      }
      national_teams: {
        Row: NationalTeamRow
        Insert: InsertNationalTeam
        Update: Partial<NationalTeamRow>
      }
      players: {
        Row: PlayerRow
        Insert: InsertPlayer
        Update: Partial<PlayerRow>
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Outcome conversion helpers (DB ↔ app)
// ─────────────────────────────────────────────────────────────────────────────

import type { MatchOutcome } from '@/types'

/** Convert app outcome ('home'|'draw'|'away') → DB code ('H'|'D'|'A') */
export function outcomeToDb(outcome: MatchOutcome): DbOutcome {
  return outcome === 'home' ? 'H' : outcome === 'draw' ? 'D' : 'A'
}

/** Convert DB outcome code ('H'|'D'|'A') → app outcome ('home'|'draw'|'away') */
export function outcomeFromDb(code: DbOutcome): MatchOutcome {
  return code === 'H' ? 'home' : code === 'D' ? 'draw' : 'away'
}
