-- Offices now live on the region (list of known locations per region).
-- Existing free-text teams.office values remain; the dropdown in admin UI is
-- populated from the region's offices list, with fallback to any custom text.

ALTER TABLE regions ADD COLUMN IF NOT EXISTS offices TEXT[] NOT NULL DEFAULT ARRAY['Main'];

-- Seed known offices into existing regions (legacy test setup mapped offices to
-- specific regions; we fold those into the region.offices arrays).
UPDATE regions SET offices = ARRAY['Sussex', 'Kraków'] WHERE code = 'EU';
UPDATE regions SET offices = ARRAY['Texas']            WHERE code = 'US';
UPDATE regions SET offices = ARRAY['Dubai']            WHERE code = 'MENA';
