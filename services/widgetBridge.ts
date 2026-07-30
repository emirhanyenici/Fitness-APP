/**
 * Publishes today's LifeScore into the iOS App Group shared container so the
 * Home Screen widget (targets/widget/Widget.swift) can render it, then asks
 * WidgetKit to redraw via the local `widget-bridge` native module
 * (modules/widget-bridge). iOS only — no-op elsewhere. Both native touchpoints
 * are lazily `require`'d, same pattern as services/healthkit.ts, so
 * Android/web/Jest never touch them.
 */
import { Platform } from 'react-native';
import { logError } from './monitoring';

const APP_GROUP = 'group.com.zenova.lifescore';
const SCORE_KEY = 'zenova_widget_score';
const COLOR_KEY = 'zenova_widget_color';
const UPDATED_KEY = 'zenova_widget_updatedAt';

/** Writes the current score/color to the shared container and triggers a widget redraw. */
export async function publishScoreToWidget(score: number, colorHex: string): Promise<void> {
  if (Platform.OS !== 'ios') return;
  try {
    const SharedGroupPreferences = require('react-native-shared-group-preferences').default;
    await SharedGroupPreferences.setItem(SCORE_KEY, Math.round(score), APP_GROUP);
    await SharedGroupPreferences.setItem(COLOR_KEY, colorHex, APP_GROUP);
    await SharedGroupPreferences.setItem(UPDATED_KEY, new Date().toISOString(), APP_GROUP);

    const { reloadWidgets } = require('widget-bridge');
    await reloadWidgets();
  } catch (e) {
    logError(e, { context: 'publishScoreToWidget' });
  }
}
