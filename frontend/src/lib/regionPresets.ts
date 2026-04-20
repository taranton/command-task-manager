// Curated list of standard region codes: macro-regions first, then common ISO 3166 countries.
// Used in the "New region" picker to save users from guessing codes.

export interface RegionPreset {
  label: string;       // user-facing name (e.g. "Germany")
  code: string;        // short code (e.g. "DE")
  group: 'macro' | 'country';
  description?: string;
}

export const REGION_PRESETS: RegionPreset[] = [
  // Macro regions (org-level groupings)
  { label: 'Global', code: 'GLOBAL', group: 'macro' },
  { label: 'Americas', code: 'AMER', group: 'macro', description: 'North & South America' },
  { label: 'North America', code: 'NAMER', group: 'macro' },
  { label: 'Latin America', code: 'LATAM', group: 'macro' },
  { label: 'Europe', code: 'EU', group: 'macro' },
  { label: 'EMEA', code: 'EMEA', group: 'macro', description: 'Europe, Middle East & Africa' },
  { label: 'Middle East & North Africa', code: 'MENA', group: 'macro' },
  { label: 'Asia Pacific', code: 'APAC', group: 'macro' },
  { label: 'Africa', code: 'AFRICA', group: 'macro' },
  { label: 'Oceania', code: 'OCEANIA', group: 'macro' },

  // Countries (ISO 3166-1 alpha-2) — most common business regions
  { label: 'United States', code: 'US', group: 'country' },
  { label: 'Canada', code: 'CA', group: 'country' },
  { label: 'Mexico', code: 'MX', group: 'country' },
  { label: 'Brazil', code: 'BR', group: 'country' },
  { label: 'Argentina', code: 'AR', group: 'country' },
  { label: 'United Kingdom', code: 'GB', group: 'country' },
  { label: 'Ireland', code: 'IE', group: 'country' },
  { label: 'Germany', code: 'DE', group: 'country' },
  { label: 'France', code: 'FR', group: 'country' },
  { label: 'Spain', code: 'ES', group: 'country' },
  { label: 'Portugal', code: 'PT', group: 'country' },
  { label: 'Italy', code: 'IT', group: 'country' },
  { label: 'Netherlands', code: 'NL', group: 'country' },
  { label: 'Belgium', code: 'BE', group: 'country' },
  { label: 'Switzerland', code: 'CH', group: 'country' },
  { label: 'Austria', code: 'AT', group: 'country' },
  { label: 'Sweden', code: 'SE', group: 'country' },
  { label: 'Norway', code: 'NO', group: 'country' },
  { label: 'Denmark', code: 'DK', group: 'country' },
  { label: 'Finland', code: 'FI', group: 'country' },
  { label: 'Poland', code: 'PL', group: 'country' },
  { label: 'Czech Republic', code: 'CZ', group: 'country' },
  { label: 'Hungary', code: 'HU', group: 'country' },
  { label: 'Romania', code: 'RO', group: 'country' },
  { label: 'Ukraine', code: 'UA', group: 'country' },
  { label: 'Greece', code: 'GR', group: 'country' },
  { label: 'Turkey', code: 'TR', group: 'country' },
  { label: 'Israel', code: 'IL', group: 'country' },
  { label: 'Saudi Arabia', code: 'SA', group: 'country' },
  { label: 'United Arab Emirates', code: 'AE', group: 'country' },
  { label: 'Egypt', code: 'EG', group: 'country' },
  { label: 'South Africa', code: 'ZA', group: 'country' },
  { label: 'Nigeria', code: 'NG', group: 'country' },
  { label: 'Kenya', code: 'KE', group: 'country' },
  { label: 'India', code: 'IN', group: 'country' },
  { label: 'China', code: 'CN', group: 'country' },
  { label: 'Hong Kong', code: 'HK', group: 'country' },
  { label: 'Taiwan', code: 'TW', group: 'country' },
  { label: 'Japan', code: 'JP', group: 'country' },
  { label: 'South Korea', code: 'KR', group: 'country' },
  { label: 'Singapore', code: 'SG', group: 'country' },
  { label: 'Malaysia', code: 'MY', group: 'country' },
  { label: 'Thailand', code: 'TH', group: 'country' },
  { label: 'Vietnam', code: 'VN', group: 'country' },
  { label: 'Indonesia', code: 'ID', group: 'country' },
  { label: 'Philippines', code: 'PH', group: 'country' },
  { label: 'Australia', code: 'AU', group: 'country' },
  { label: 'New Zealand', code: 'NZ', group: 'country' },
];

// Lookup the preset for a given display label (case-insensitive).
export function findPresetByLabel(label: string): RegionPreset | undefined {
  const q = label.trim().toLowerCase();
  return REGION_PRESETS.find((p) => p.label.toLowerCase() === q);
}
