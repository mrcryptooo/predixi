-- =============================================================================
-- PrediXI — Badge Seed Data
-- Populates the `badges` table with all achievement badge definitions.
--
-- Idempotent: uses INSERT ... ON CONFLICT (id) DO UPDATE so this file can be
-- re-run safely without creating duplicates or erroring on existing rows.
--
-- Run in: Supabase Dashboard → SQL Editor → New Query → Run
-- Requires: schema.sql (badges table) applied first.
-- =============================================================================

INSERT INTO badges (id, name, description, icon, rarity, category, xp_reward, criteria)
VALUES

  -- ── Streak badges ──────────────────────────────────────────────────────────
  (
    'streak-3',
    'On Fire',
    '3 correct predictions in a row',
    '🔥',
    'common',
    'streak',
    150,
    'Get 3 consecutive correct predictions'
  ),
  (
    'streak-5',
    'Hot Streak',
    '5 correct predictions in a row',
    '🔥🔥',
    'rare',
    'streak',
    300,
    'Get 5 consecutive correct predictions'
  ),
  (
    'streak-9',
    'Unstoppable',
    '9 correct predictions in a row',
    '⚡',
    'epic',
    'streak',
    750,
    'Get 9 consecutive correct predictions'
  ),
  (
    'streak-10',
    'Legendary Run',
    '10+ correct predictions in a row',
    '👑',
    'legendary',
    'streak',
    1500,
    'Get 10 consecutive correct predictions'
  ),

  -- ── Accuracy badges ────────────────────────────────────────────────────────
  (
    'sharp-eye',
    'Sharp Eye',
    '60%+ accuracy over 50 predictions',
    '🎯',
    'common',
    'accuracy',
    200,
    'Achieve 60%+ accuracy with at least 50 predictions'
  ),
  (
    'oracle',
    'The Oracle',
    '70%+ accuracy over 200 predictions',
    '🔮',
    'legendary',
    'accuracy',
    2000,
    'Achieve 70%+ accuracy with at least 200 predictions'
  ),
  (
    'hat-trick',
    'Hat-Trick Hero',
    '3 correct predictions on the same matchday',
    '⛑️',
    'rare',
    'accuracy',
    250,
    'Predict 3 or more matches correctly on the same matchday'
  ),

  -- ── Volume badges ──────────────────────────────────────────────────────────
  (
    'first-pred',
    'First Touch',
    'Placed your first prediction',
    '👟',
    'common',
    'volume',
    50,
    'Place your first prediction'
  ),
  (
    'centurion',
    'Centurion',
    '100 predictions placed',
    '💯',
    'rare',
    'volume',
    500,
    'Place at least 100 predictions'
  ),
  (
    'veteran',
    'Veteran',
    '250 predictions placed',
    '🎖️',
    'epic',
    'volume',
    1000,
    'Place at least 250 predictions'
  ),

  -- ── League expert badges ───────────────────────────────────────────────────
  (
    'pl-expert',
    'Premier League Expert',
    '65%+ accuracy in Premier League matches',
    '🏴󠁧󠁢󠁥󠁮󠁧󠁿',
    'rare',
    'league',
    400,
    'Achieve 65%+ accuracy on at least 30 Premier League matches'
  ),
  (
    'la-liga-expert',
    'La Liga Expert',
    '65%+ accuracy in La Liga matches',
    '🇪🇸',
    'rare',
    'league',
    400,
    'Achieve 65%+ accuracy on at least 30 La Liga matches'
  ),
  (
    'bundesliga-expert',
    'Bundesliga Expert',
    '65%+ accuracy in Bundesliga matches',
    '🇩🇪',
    'rare',
    'league',
    400,
    'Achieve 65%+ accuracy on at least 30 Bundesliga matches'
  ),
  (
    'ligue1-expert',
    'Ligue 1 Expert',
    '65%+ accuracy in Ligue 1 matches',
    '🇫🇷',
    'rare',
    'league',
    400,
    'Achieve 65%+ accuracy on at least 30 Ligue 1 matches'
  ),
  (
    'ucl-expert',
    'UCL Expert',
    '65%+ accuracy in Champions League matches',
    '⭐',
    'epic',
    'league',
    600,
    'Achieve 65%+ accuracy on at least 20 UCL matches'
  ),

  -- ── Special badges ─────────────────────────────────────────────────────────
  (
    'early-adopter',
    'Early Adopter',
    'Joined PrediXI in the founding season',
    '🚀',
    'legendary',
    'special',
    1000,
    'Join PrediXI before the end of Season 1'
  ),
  (
    'el-clasico',
    'El Clásico Caller',
    'Correctly predicted an El Clásico result',
    '🌟',
    'epic',
    'special',
    500,
    'Correctly predict the outcome of a Real Madrid vs Barcelona match'
  ),

  -- ── World Cup badges ───────────────────────────────────────────────────────
  (
    'worldcup-2026',
    'World Cup Predictor',
    'Predicted 10+ World Cup 2026 matches',
    '🏆',
    'epic',
    'worldcup',
    800,
    'Place predictions on at least 10 World Cup 2026 matches'
  ),
  (
    'worldcup-champion',
    'Tournament Prophet',
    'Correctly predicted the World Cup 2026 winner',
    '🌍',
    'legendary',
    'worldcup',
    3000,
    'Correctly predict the World Cup 2026 champion before the tournament starts'
  )

ON CONFLICT (id) DO UPDATE SET
  name        = EXCLUDED.name,
  description = EXCLUDED.description,
  icon        = EXCLUDED.icon,
  rarity      = EXCLUDED.rarity,
  category    = EXCLUDED.category,
  xp_reward   = EXCLUDED.xp_reward,
  criteria    = EXCLUDED.criteria;

-- Verify: should return 19 rows
-- SELECT COUNT(*) FROM badges;
