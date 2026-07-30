/** @type {import('@bacons/apple-targets/app.plugin').ConfigFunction} */
module.exports = (config) => ({
  type: 'widget',
  name: 'ZenovaWidget',
  displayName: 'Zenova LifeScore',
  colors: {
    $accent: '#059669',
  },
  frameworks: ['SwiftUI', 'WidgetKit'],
  entitlements: {
    // Mirror the main app's App Group so the widget can read what
    // services/widgetBridge.ts writes from the running app.
    'com.apple.security.application-groups': config.ios.entitlements['com.apple.security.application-groups'],
  },
  deploymentTarget: '17.0',
});
