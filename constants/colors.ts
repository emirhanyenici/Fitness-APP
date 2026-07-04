/**
 * Derive a translucent version of a #RRGGBB token (borders, tints).
 * Replaces the ad-hoc `color + '50'` hex-suffix concatenations (finding T8)
 * with one explicit, clamped helper.
 */
export function withAlpha(hex: string, alpha: number): string {
  const a = Math.round(Math.min(1, Math.max(0, alpha)) * 255);
  return hex + a.toString(16).padStart(2, '0').toUpperCase();
}

export const colors = {
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

/**
 * The ONE BMI color scale (finding T8 — onboarding and profile each had their
 * own off-token variant). Underweight blue is intentionally off-palette:
 * a clinical category color, not UI chrome.
 */
export const bmiColors = {
  underweight: '#3B82F6',
  normal:      colors.status.success,
  overweight:  colors.status.warning,
  obese1:      '#F97316',   // 30-35 — between warning and danger
  obese2:      colors.status.danger,
} as const;

export function bmiColor(bmi: number): string {
  if (bmi < 18.5) return bmiColors.underweight;
  if (bmi < 25)   return bmiColors.normal;
  if (bmi < 30)   return bmiColors.overweight;
  if (bmi < 35)   return bmiColors.obese1;
  return bmiColors.obese2;
}
