import ExpoModulesCore
import WidgetKit

// Tiny native bridge: services/widgetBridge.ts calls this after publishing
// fresh LifeScore data into the shared App Group container, so the Home
// Screen widget (targets/widget/Widget.swift) redraws immediately instead of
// waiting for its own timeline schedule.
public class WidgetBridgeModule: Module {
  public func definition() -> ModuleDefinition {
    Name("WidgetBridge")

    AsyncFunction("reloadWidgets") { () -> Void in
      if #available(iOS 14.0, *) {
        WidgetCenter.shared.reloadAllTimelines()
      }
    }
  }
}
