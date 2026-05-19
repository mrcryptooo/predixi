-- Migration: add home_team_crest and away_team_crest to matches table
-- Run in Supabase SQL editor (or via supabase db push if local).
-- Safe to run multiple times (IF NOT EXISTS / DO NOTHING).

ALTER TABLE matches ADD COLUMN IF NOT EXISTS home_team_crest text;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS away_team_crest text;
