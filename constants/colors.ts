/**
 * Derive a translucent version of a #RRGGBB token (borders, tints).
 * Replaces the ad-hoc `color + '50'` hex-suffix concatenations (finding T8)
 * with one explicit, clamped helper.
 */
export function withAlpha(hex: string, alpha: number): string {
  const a = Math.round(Math.min(1, Math.max(0, alpha)) * 255);
  return hex + a.toString(16).padStart(2, '0').toUpperCase();
}

export const lightColors = {
  bg: {
    primary:   '#F2F6F3',   // Soft sage-tinted off-white — calm & natural
    secondary: '#FFFFFF',   // Pure white cards
    tertiary:  '#E9F0EA',   // Sheet / modal background (green-grey)
    elevated:  '#FFFFFF',   // Inputs, tooltips (add shadow)
  },
  accent: {
    primary:   '#059669',   // Emerald — health, growth, nature (brand)
    soft:      '#34D399',   // Fresh emerald
    glow:      'rgba(5, 150, 105, 0.14)',
    dim:       'rgba(5, 150, 105, 0.08)',
  },
  violet: {
    primary:   '#7C3AED',   // Recovery & mood — complements green
    soft:      '#8B5CF6',
    glow:      'rgba(124, 58, 237, 0.12)',
  },
  status: {
    success:   '#16A34A',   // Green — vibrant, distinct from emerald brand
    warning:   '#D97706',   // Earthy amber
    danger:    '#DC2626',   // Red
    info:      '#0D9488',   // Teal — calm water tone (hydration, info)
  },
  score: {
    excellent: '#059669',   // Emerald
    good:      '#0D9488',   // Teal
    fair:      '#D97706',   // Amber
    poor:      '#DC2626',   // Red
  },
  text: {
    primary:   '#14261C',   // Deep forest near-black (green-tinted)
    secondary: '#415247',   // Muted green-slate
    tertiary:  '#8AA294',   // Soft sage grey
    inverse:   '#FFFFFF',   // White on colored bg
  },
  border: {
    subtle:    'rgba(20, 38, 28, 0.06)',
    default:   'rgba(20, 38, 28, 0.10)',
    strong:    'rgba(20, 38, 28, 0.20)',
  },
  shadow: {
    card:      'rgba(20, 38, 28, 0.08)',
    medium:    'rgba(20, 38, 28, 0.12)',
    accent:    'rgba(5, 150, 105, 0.18)',
  },
};

export const darkColors = {
  bg: {
    primary:   '#0F1712',   // Near-black, faint sage/forest tint
    secondary: '#182119',   // Card surface, one step up
    tertiary:  '#1E2A20',   // Sheet / modal background
    elevated:  '#22301F',   // Inputs, tooltips (add shadow)
  },
  accent: {
    primary:   '#10B981',   // Emerald, nudged brighter for dark-bg legibility
    soft:      '#34D399',
    glow:      'rgba(16, 185, 129, 0.20)',
    dim:       'rgba(16, 185, 129, 0.12)',
  },
  violet: {
    primary:   '#8B5CF6',   // Promote old "soft" to primary — reads better on dark
    soft:      '#A78BFA',
    glow:      'rgba(139, 92, 246, 0.16)',
  },
  status: {
    success:   '#22C55E',
    warning:   '#F59E0B',
    danger:    '#EF4444',
    info:      '#2DD4BF',
  },
  score: {
    excellent: '#10B981',
    good:      '#2DD4BF',
    fair:      '#F59E0B',
    poor:      '#EF4444',
  },
  text: {
    primary:   '#F2F6F3',   // Near-white, sage-tinted — mirrors light bg.primary
    secondary: '#B9C7BC',
    tertiary:  '#75887B',
    inverse:   '#14261C',   // For text placed on light/accent chips within dark mode
  },
  border: {
    subtle:    'rgba(242, 246, 243, 0.08)',
    default:   'rgba(242, 246, 243, 0.12)',
    strong:    'rgba(242, 246, 243, 0.22)',
  },
  shadow: {
    card:      'rgba(0, 0, 0, 0.40)',
    medium:    'rgba(0, 0, 0, 0.55)',
    accent:    'rgba(16, 185, 129, 0.25)',
  },
};

export type Colors = typeof lightColors;

/** @deprecated Use useColors() for theme-reactive access. Kept for not-yet-migrated files (resolves to light palette only). */
export const colors = lightColors;

/**
 * The ONE BMI color scale (finding T8 — onboarding and profile each had their
 * own off-token variant). Underweight blue is intentionally off-palette:
 * a clinical category color, not UI chrome. Theme-independent by design —
 * rendered on their own chips/badges, not raw text-on-bg.
 */
export const bmiColors = {
  underweight: '#3B82F6',
  normal:      lightColors.status.success,
  overweight:  lightColors.status.warning,
  obese1:      '#F97316',   // 30-35 — between warning and danger
  obese2:      lightColors.status.danger,
} as const;

export function bmiColor(bmi: number): string {
  if (bmi < 18.5) return bmiColors.underweight;
  if (bmi < 25)   return bmiColors.normal;
  if (bmi < 30)   return bmiColors.overweight;
  if (bmi < 35)   return bmiColors.obese1;
  return bmiColors.obese2;
}
