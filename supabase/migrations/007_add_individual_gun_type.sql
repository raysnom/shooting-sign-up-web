-- ============================================
-- Migration 007: Add 'individual' to gun_type enum
-- ============================================
-- Individual guns are personal guns owned by members.
-- They will never clash with other members' guns.

ALTER TYPE gun_type ADD VALUE IF NOT EXISTS 'individual';
