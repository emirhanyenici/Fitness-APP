/**
 * Weekly report → branded PDF export.
 *
 * `buildReportHtml` is a pure string builder (unit-testable, no native deps);
 * `exportReportPdf` renders it via expo-print and hands the file to the OS
 * share sheet via expo-sharing. Works identically for the AI and local report
 * paths since both produce a WeeklyReportData.
 *
 * The HTML is fully self-contained: inline styles only, system font stack
 * (custom app fonts aren't available inside the print webview), inline SVG for
 * the score ring. Palette hexes mirror constants/colors.ts — the PDF is always
 * light-themed print output, so they are frozen here on purpose.
 */
import { logError } from './monitoring';
import type { TFunction } from '../constants/i18n';
import type { WeeklyReportData } from './weeklyReport';

const C = {
  emerald: '#059669',
  emeraldSoft: '#34D399',
  sage: '#F2F6F3',
  forest: '#14261C',
  textSecondary: '#415247',
  textTertiary: '#8AA294',
  border: '#DCE7DE',
  white: '#FFFFFF',
  violet: '#7C3AED',
  teal: '#0D9488',
  success: '#16A34A',
  warning: '#D97706',
  danger: '#DC2626',
};

const scoreColor = (score: number) =>
  score >= 70 ? C.emerald : score >= 50 ? C.teal : score >= 30 ? C.warning : C.danger;

/** Escape interpolated text — AI narrative and i18n strings may contain <, &. */
export function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const FONT = "-apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";

function scoreRingSvg(score: number): string {
  const r = 44;
  const circ = 2 * Math.PI * r;
  const filled = (Math.min(Math.max(score, 0), 100) / 100) * circ;
  const color = scoreColor(score);
  return `
    <svg width="120" height="120" viewBox="0 0 120 120">
      <circle cx="60" cy="60" r="${r}" fill="none" stroke="${C.sage}" stroke-width="11"/>
      <circle cx="60" cy="60" r="${r}" fill="none" stroke="${color}" stroke-width="11"
        stroke-linecap="round" stroke-dasharray="${filled.toFixed(1)} ${circ.toFixed(1)}"
        transform="rotate(-90 60 60)"/>
      <text x="60" y="57" text-anchor="middle" font-family="${FONT}" font-size="30"
        font-weight="800" fill="${C.forest}">${Math.round(score)}</text>
      <text x="60" y="76" text-anchor="middle" font-family="${FONT}" font-size="10"
        fill="${C.textTertiary}">/ 100</text>
    </svg>`;
}

function trendBars(data: WeeklyReportData): string {
  const cols = data.daily.map((d) => {
    const h = d.hasData ? Math.max(6, Math.round((d.score / 100) * 88)) : 4;
    const bg = d.hasData ? scoreColor(d.score) : C.border;
    return `
      <td style="vertical-align:bottom; text-align:center; padding:0 5px;">
        <div style="height:${h}px; border-radius:6px; background:${bg};"></div>
        <div style="font-family:${FONT}; font-size:10px; color:${C.textTertiary}; margin-top:6px;">${esc(d.dayLabel)}</div>
      </td>`;
  }).join('');
  return `<table style="width:100%; border-collapse:collapse; height:110px;"><tr>${cols}</tr></table>`;
}

function pillarRows(data: WeeklyReportData, t: TFunction): string {
  const rows: { label: string; value: number; color: string }[] = [
    { label: t('weeklyReport.pillarSleep'), value: data.stats.pillarAvgs.sleep, color: C.emerald },
    { label: t('weeklyReport.pillarFood'),  value: data.stats.pillarAvgs.food,  color: C.success },
    { label: t('weeklyReport.pillarMove'),  value: data.stats.pillarAvgs.move,  color: C.warning },
    { label: t('weeklyReport.pillarMood'),  value: data.stats.pillarAvgs.mood,  color: C.violet },
  ];
  return rows.map((p) => `
    <div style="display:flex; align-items:center; margin:7px 0;">
      <div style="width:52px; font-family:${FONT}; font-size:11px; color:${C.textSecondary};">${esc(p.label)}</div>
      <div style="flex:1; height:9px; background:${C.sage}; border-radius:5px; overflow:hidden;">
        <div style="width:${Math.min((p.value / 25) * 100, 100).toFixed(0)}%; height:100%; background:${p.color}; border-radius:5px;"></div>
      </div>
      <div style="width:44px; text-align:right; font-family:${FONT}; font-size:11px; font-weight:700; color:${C.forest};">${p.value}/25</div>
    </div>`).join('');
}

function listSection(title: string, emoji: string, items: string[], numbered = false): string {
  if (items.length === 0) return '';
  const lis = items.map((s, i) => `
    <li style="font-family:${FONT}; font-size:11.5px; color:${C.textSecondary}; line-height:1.55; margin-bottom:5px;">
      ${numbered ? '' : ''}${esc(s)}
    </li>`).join('');
  return `
    <div style="margin-top:14px;">
      <div style="font-family:${FONT}; font-size:13px; font-weight:800; color:${C.forest}; margin-bottom:6px;">${emoji}&nbsp; ${esc(title)}</div>
      <${numbered ? 'ol' : 'ul'} style="margin:0; padding-left:18px;">${lis}</${numbered ? 'ol' : 'ul'}>
    </div>`;
}

function statCell(label: string, value: string, sub = ''): string {
  return `
    <td style="width:50%; padding:6px;">
      <div style="background:${C.white}; border:1px solid ${C.border}; border-radius:12px; padding:12px 14px;">
        <div style="font-family:${FONT}; font-size:10px; text-transform:uppercase; letter-spacing:0.6px; color:${C.textTertiary}; margin-bottom:4px;">${esc(label)}</div>
        <div style="font-family:${FONT}; font-size:18px; font-weight:800; color:${C.forest};">${value}</div>
        ${sub ? `<div style="font-family:${FONT}; font-size:10.5px; color:${C.textSecondary}; margin-top:3px;">${sub}</div>` : ''}
      </div>
    </td>`;
}

export function buildReportHtml(data: WeeklyReportData, t: TFunction): string {
  const s = data.stats;

  const workoutsSub = s.workoutBreakdown.length
    ? s.workoutBreakdown.map((w) => `${esc(w.bodyPart)} ×${w.count}`).join(' &middot; ')
    : '';
  const totalMinutes = s.workoutBreakdown.reduce((sum, w) => sum + w.minutes, 0);
  const totalBurned  = s.workoutBreakdown.reduce((sum, w) => sum + w.calories, 0);

  const activityCell = s.activityAvgs
    ? statCell(
        t('weeklyReport.activitySection'),
        `${s.activityAvgs.steps.toLocaleString()} steps`,
        `${s.activityAvgs.caloriesBurned} kcal &middot; ${s.activityAvgs.distanceKm}km &middot; ${s.activityAvgs.exerciseMin}min`,
      )
    : '';

  const weightCell = s.weightDelta !== null
    ? statCell(
        t('weeklyReport.weightChange'),
        `<span style="color:${s.weightDelta > 0 ? C.warning : C.emerald};">${s.weightDelta > 0 ? '+' : ''}${s.weightDelta} kg</span>`,
        esc(t('weeklyReport.weightThisWeek')),
      )
    : '';

  const coachNotes = data.aiNarrative
    ? `
      <div style="margin-top:16px; background:${C.white}; border:1px solid ${C.border}; border-left:4px solid ${C.emerald}; border-radius:12px; padding:14px 16px;">
        <div style="font-family:${FONT}; font-size:13px; font-weight:800; color:${C.forest}; margin-bottom:6px;">💬&nbsp; ${esc(t('weeklyReport.coachNotes'))}</div>
        <div style="font-family:${FONT}; font-size:11.5px; color:${C.textSecondary}; line-height:1.6; white-space:pre-wrap;">${esc(data.aiNarrative)}</div>
      </div>`
    : '';

  return `
  <style>@page { margin: 0; }</style>
  <div style="background:${C.sage}; padding:0; min-height:100%;">

    <!-- Header band -->
    <div style="background:linear-gradient(120deg, ${C.emerald}, ${C.teal}); padding:26px 32px 22px;">
      <table style="width:100%; border-collapse:collapse;"><tr>
        <td>
          <div style="font-family:${FONT}; font-size:21px; font-weight:900; letter-spacing:5px; color:${C.white};">ZENOVA</div>
          <div style="font-family:${FONT}; font-size:12px; color:rgba(255,255,255,0.85); margin-top:3px;">${esc(t('weeklyReport.pdfSubtitle'))}</div>
        </td>
        <td style="text-align:right; vertical-align:top;">
          <div style="display:inline-block; background:rgba(255,255,255,0.16); border-radius:999px; padding:6px 14px; font-family:${FONT}; font-size:11.5px; font-weight:600; color:${C.white};">${esc(data.period.label)}</div>
        </td>
      </tr></table>
    </div>

    <div style="padding:20px 32px 26px;">

      <!-- Hero: ring + stat pills -->
      <table style="width:100%; border-collapse:collapse;"><tr>
        <td style="width:132px; vertical-align:middle;">${scoreRingSvg(s.avgScore)}</td>
        <td style="vertical-align:middle; padding-left:12px;">
          <div style="font-family:${FONT}; font-size:11px; text-transform:uppercase; letter-spacing:0.8px; color:${C.textTertiary}; margin-bottom:8px;">${esc(t('weeklyReport.avgScore'))}</div>
          <table style="border-collapse:separate; border-spacing:6px 0;"><tr>
            ${[
              { v: `${s.daysLogged}/7`, l: t('weeklyReport.daysLogged') },
              { v: String(s.totalWorkouts), l: t('weeklyReport.workouts') },
              { v: s.avgSleep > 0 ? `${s.avgSleep.toFixed(1)}h` : '—', l: t('weeklyReport.avgSleep') },
            ].map((p) => `
              <td style="background:${C.white}; border:1px solid ${C.border}; border-radius:12px; padding:10px 16px; text-align:center;">
                <div style="font-family:${FONT}; font-size:17px; font-weight:800; color:${C.emerald};">${esc(p.v)}</div>
                <div style="font-family:${FONT}; font-size:9.5px; color:${C.textSecondary}; margin-top:2px;">${esc(p.l)}</div>
              </td>`).join('')}
          </tr></table>
        </td>
      </tr></table>

      <!-- Trend -->
      <div style="margin-top:14px; background:${C.white}; border:1px solid ${C.border}; border-radius:12px; padding:14px 16px;">
        <div style="font-family:${FONT}; font-size:13px; font-weight:800; color:${C.forest}; margin-bottom:10px;">📈&nbsp; ${esc(t('weeklyReport.scoreTrend'))}</div>
        ${trendBars(data)}
      </div>

      <!-- Pillars -->
      <div style="margin-top:14px; background:${C.white}; border:1px solid ${C.border}; border-radius:12px; padding:14px 16px;">
        <div style="font-family:${FONT}; font-size:13px; font-weight:800; color:${C.forest}; margin-bottom:8px;">🧩&nbsp; ${esc(t('weeklyReport.pillars'))}</div>
        ${pillarRows(data, t)}
      </div>

      <!-- Stats grid -->
      <table style="width:100%; border-collapse:collapse; margin:8px -6px 0;"><tr>
        ${statCell(
          t('weeklyReport.nutrition'),
          s.avgCalories > 0 ? `${s.avgCalories} kcal` : '—',
          s.avgCalories > 0
            ? `P ${s.macroAvgs.protein}g &middot; C ${s.macroAvgs.carbs}g &middot; F ${s.macroAvgs.fat}g`
            : '',
        )}
        ${statCell(
          t('weeklyReport.workoutsSection'),
          `${s.totalWorkouts} · ${totalMinutes} min · ${totalBurned} kcal`,
          workoutsSub,
        )}
      </tr>${(() => {
        // Extra stat cells (activity, weight) are optional — pair them up two
        // per row, padding a lone trailing cell with an empty spacer.
        const extra = [activityCell, weightCell].filter(Boolean);
        const rows: string[] = [];
        for (let i = 0; i < extra.length; i += 2) {
          rows.push(`<tr>${extra[i]}${extra[i + 1] ?? '<td style="width:50%;"></td>'}</tr>`);
        }
        return rows.join('');
      })()}</table>

      ${coachNotes}

      ${listSection(t('weeklyReport.local.winsHeader'), '🏆', data.sections.wins)}
      ${listSection(t('weeklyReport.local.improveHeader'), '🎯', data.sections.improvements)}
      ${listSection(t('weeklyReport.local.focusHeader'), '🚀', data.sections.focus, true)}

      <div style="margin-top:22px; padding-top:12px; border-top:1px solid ${C.border}; font-family:${FONT}; font-size:9.5px; color:${C.textTertiary}; text-align:center;">
        ${esc(t('weeklyReport.pdfFooter'))} &middot; ${esc(new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }))} &middot; zenovaapp.com
      </div>
    </div>
  </div>`;
}

/** Human-friendly file name — the share sheet and Files app show this. */
export function reportFileName(data: WeeklyReportData): string {
  return `Zenova-Weekly-Report-${data.period.end}.pdf`;
}

/**
 * Render the report HTML to a PDF file and open the OS share sheet.
 * Throws on failure (after logging) so the modal can surface `pdfError`.
 */
export async function exportReportPdf(data: WeeklyReportData, t: TFunction): Promise<void> {
  try {
    // Lazy imports: native modules absent from older dev builds must not crash
    // the modal at load time — only when the button is pressed.
    const Print = await import('expo-print');
    const Sharing = await import('expo-sharing');

    const { uri } = await Print.printToFileAsync({ html: buildReportHtml(data, t) });

    // printToFileAsync names the file randomly (e.g. Print-1A2B.pdf); rename it
    // so the share sheet / Files app show a meaningful name.
    let shareUri = uri;
    try {
      const FileSystem = await import('expo-file-system/legacy');
      const named = `${uri.slice(0, uri.lastIndexOf('/') + 1)}${reportFileName(data)}`;
      if (named !== uri) {
        // A re-export the same day targets the same name — clear it first.
        await FileSystem.deleteAsync(named, { idempotent: true });
        await FileSystem.moveAsync({ from: uri, to: named });
        shareUri = named;
      }
    } catch (e) {
      // Rename is cosmetic — fall back to the original file on any failure.
      logError(e, { scope: 'exportReportPdf', step: 'rename' });
    }

    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(shareUri, {
        mimeType: 'application/pdf',
        dialogTitle: t('weeklyReport.pdfSubtitle'),
        UTI: 'com.adobe.pdf',
      });
    }
  } catch (e) {
    logError(e, { scope: 'exportReportPdf' });
    throw e;
  }
}
