import { requireNativeModule } from 'expo-modules-core';

interface WidgetBridgeNativeModule {
  reloadWidgets(): Promise<void>;
}

/** Tells WidgetKit to redraw the LifeScore widget's timeline. iOS only. */
export async function reloadWidgets(): Promise<void> {
  const WidgetBridge = requireNativeModule<WidgetBridgeNativeModule>('WidgetBridge');
  await WidgetBridge.reloadWidgets();
}
