import { colors } from './colors';

/**
 * Surface elevation presets (finding T4). The ONLY place shadows are defined —
 * screens must never hardcode shadowColor/shadowOpacity. Color comes from
 * colors.shadow.* tokens (forest-tinted, matches the nature palette; the old
 * slate rgba(15,23,42,x) hardcodes came from the removed dark theme).
 *
 * Hierarchy:
 *  - card:   default content card, sits just above the sage background
 *  - raised: emphasized card (AI plan, active toggle pill)
 *  - hero:   the one flagship surface per screen (LifeScore hero)
 */
export const elevation = {
  card: {
    shadowColor: colors.shadow.card,
    shadowOpacity: 1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  raised: {
    shadowColor: colors.shadow.medium,
    shadowOpacity: 1,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  hero: {
    shadowColor: colors.shadow.medium,
    shadowOpacity: 1,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
} as const;
