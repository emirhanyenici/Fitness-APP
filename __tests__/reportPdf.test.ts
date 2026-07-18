/**
 * buildReportHtml — pure HTML string builder for the weekly report PDF.
 * (printToFileAsync/shareAsync are native and exercised on-device.)
 */
import { buildReportHtml, esc, reportFileName } from '../services/reportPdf';
import { translate } from '../constants/i18n';
import type { WeeklyReportData } from '../services/weeklyReport';

const t = translate;

const baseData: WeeklyReportData = {
  period: { start: '2026-07-12', end: '2026-07-18', label: 'Jul 12 – Jul 18' },
  stats: {
    daysLogged: 5, avgCalories: 2100, totalWorkouts: 3, avgMood: 4.2, avgSleep: 7.6,
    avgScore: 78,
    pillarAvgs: { food: 20, move: 18, mood: 21, sleep: 19 },
    macroAvgs: { protein: 130, carbs: 210, fat: 65 },
    workoutBreakdown: [{ bodyPart: 'chest', count: 2, minutes: 80, calories: 550 }],
    weightDelta: -0.6,
  },
  daily: Array.from({ length: 7 }, (_, i) => ({
    date: `2026-07-${12 + i}`, dayLabel: 'M', score: 60 + i, hasData: i > 0,
  })),
  sections: {
    wins: ['You completed 3 workouts — real momentum.'],
    improvements: ['Only 5 of 7 days had data.'],
    focus: ['Log at least one thing every day.'],
  },
  aiNarrative: 'Solid week overall. Keep the rhythm going.',
  source: 'ai',
};

describe('esc', () => {
  it('escapes HTML-sensitive characters', () => {
    expect(esc('<script>alert("x")</script> & more'))
      .toBe('&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; &amp; more');
  });
});

describe('reportFileName', () => {
  it('names the file after the week-ending date', () => {
    expect(reportFileName(baseData)).toBe('Zenova-Weekly-Report-2026-07-18.pdf');
  });
});

describe('buildReportHtml', () => {
  it('contains period label, score, and all three section headers', () => {
    const html = buildReportHtml(baseData, t);
    expect(html).toContain('Jul 12 – Jul 18');
    expect(html).toContain('>78<');
    expect(html).toContain(t('weeklyReport.local.winsHeader'));
    expect(html).toContain(t('weeklyReport.local.improveHeader'));
    expect(html).toContain(t('weeklyReport.local.focusHeader'));
    expect(html).toContain('ZENOVA');
  });

  it('escapes markup inside the AI narrative', () => {
    const html = buildReportHtml(
      { ...baseData, aiNarrative: '<script>alert(1)</script>' },
      t,
    );
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it("omits the Coach's Notes card on the local path", () => {
    const html = buildReportHtml({ ...baseData, aiNarrative: null, source: 'local' }, t);
    expect(html).not.toContain(t('weeklyReport.coachNotes'));
  });

  it('omits the weight block when there is no weight delta', () => {
    const html = buildReportHtml(
      { ...baseData, stats: { ...baseData.stats, weightDelta: null } },
      t,
    );
    expect(html).not.toContain(t('weeklyReport.weightChange'));
  });

  it('renders the weight delta with sign', () => {
    const html = buildReportHtml(baseData, t);
    expect(html).toContain('-0.6 kg');
  });
});
