/**
 * Legal / compliance copy, kept in one place so the onboarding disclaimer,
 * the profile screen, and any future ToS surface stay in sync.
 */

/** Full medical disclaimer shown in Profile and acknowledged during onboarding. */
export const MEDICAL_DISCLAIMER =
  'Zenova LifeScore provides general wellness and fitness guidance for ' +
  'informational purposes only. It is not medical advice, diagnosis, or ' +
  'treatment, and is not a substitute for consulting a qualified healthcare ' +
  'professional. Always consult your doctor before changing your diet, ' +
  'exercise, or health routine — especially if you have a medical condition, ' +
  'are pregnant, or take medication.';

/** One-line version shown on the onboarding welcome screen. */
export const DISCLAIMER_SHORT =
  'Zenova offers general wellness guidance, not medical advice, diagnosis, or treatment.';

export interface Citation {
  /** What Zenova calculates using this source. */
  metric: string;
  /** Publication / guideline title. */
  title: string;
  /** Publisher or authoring body. */
  source: string;
  url: string;
}

/**
 * Sources for every formula-driven number Zenova shows (calories, macros,
 * sleep and activity targets). Surfaced in full on the Sources screen
 * (Profile → Health Disclaimer) per App Store 1.4.1 — health/medical
 * recommendations must cite the sources they're based on.
 */
export const CITATIONS: Citation[] = [
  {
    metric: 'Calorie target (BMR/TDEE)',
    title: 'A new predictive equation for resting energy expenditure in healthy individuals (Mifflin-St Jeor equation)',
    source: 'American Journal of Clinical Nutrition, 1990',
    url: 'https://pubmed.ncbi.nlm.nih.gov/2305711/',
  },
  {
    metric: 'Protein target',
    title: 'International Society of Sports Nutrition Position Stand: protein and exercise',
    source: 'Journal of the International Society of Sports Nutrition, 2017',
    url: 'https://jissn.biomedcentral.com/articles/10.1186/s12970-017-0177-8',
  },
  {
    metric: 'Carb & fat targets',
    title: 'Acceptable Macronutrient Distribution Ranges — Dietary Guidelines for Americans, 2020–2025',
    source: 'U.S. Department of Health and Human Services / USDA',
    url: 'https://www.dietaryguidelines.gov/',
  },
  {
    metric: 'Sleep target',
    title: 'How Much Sleep Do I Need?',
    source: 'Centers for Disease Control and Prevention',
    url: 'https://www.cdc.gov/sleep/about/index.html',
  },
  {
    metric: 'Workout frequency & duration',
    title: 'Physical Activity Guidelines for Adults',
    source: 'Centers for Disease Control and Prevention',
    url: 'https://www.cdc.gov/physical-activity-basics/guidelines/adults.html',
  },
];
