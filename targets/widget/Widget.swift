import WidgetKit
import SwiftUI

// MARK: - Shared data model
//
// Reads what services/widgetBridge.ts (running in the main app) last wrote
// into the shared App Group container. This process never runs JS — it can
// only render whatever was published there.

private let appGroupID = "group.com.zenova.lifescore"
private let scoreKey = "zenova_widget_score"
private let colorKey = "zenova_widget_color"

struct LifeScoreData {
    let score: Int
    let colorHex: String
    let hasData: Bool

    static func load() -> LifeScoreData {
        guard let defaults = UserDefaults(suiteName: appGroupID),
              defaults.object(forKey: scoreKey) != nil else {
            // No data published yet (fresh install, or app never opened) —
            // render an empty ring instead of a bogus score.
            return LifeScoreData(score: 0, colorHex: "#8AA294", hasData: false)
        }
        let score = defaults.integer(forKey: scoreKey)
        // Matches constants/colors.ts lightColors.score.excellent — kept in
        // sync by hand since Swift can't import the TS palette.
        let color = defaults.string(forKey: colorKey) ?? "#059669"
        return LifeScoreData(score: score, colorHex: color, hasData: true)
    }
}

// MARK: - Timeline

struct LifeScoreEntry: TimelineEntry {
    let date: Date
    let data: LifeScoreData
}

struct LifeScoreProvider: TimelineProvider {
    func placeholder(in context: Context) -> LifeScoreEntry {
        LifeScoreEntry(date: Date(), data: LifeScoreData(score: 72, colorHex: "#059669", hasData: true))
    }

    func getSnapshot(in context: Context, completion: @escaping (LifeScoreEntry) -> Void) {
        completion(LifeScoreEntry(date: Date(), data: LifeScoreData.load()))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<LifeScoreEntry>) -> Void) {
        let entry = LifeScoreEntry(date: Date(), data: LifeScoreData.load())
        // The real refresh trigger is WidgetCenter.reloadAllTimelines(), called
        // by services/widgetBridge.ts whenever the app publishes a new score.
        // This periodic fallback just catches a stale ring if the app hasn't
        // been opened in a while — no background work is added for it.
        let nextRefresh = Calendar.current.date(byAdding: .hour, value: 4, to: Date()) ?? Date().addingTimeInterval(4 * 3600)
        completion(Timeline(entries: [entry], policy: .after(nextRefresh)))
    }
}

// MARK: - View

private func color(fromHex hex: String) -> Color {
    var s = hex.trimmingCharacters(in: .whitespacesAndNewlines)
    if s.hasPrefix("#") { s.removeFirst() }
    var rgb: UInt64 = 0
    Scanner(string: s).scanHexInt64(&rgb)
    let r = Double((rgb >> 16) & 0xFF) / 255
    let g = Double((rgb >> 8) & 0xFF) / 255
    let b = Double(rgb & 0xFF) / 255
    return Color(red: r, green: g, blue: b)
}

struct LifeScoreRingView: View {
    let entry: LifeScoreEntry

    var body: some View {
        let ringColor = color(fromHex: entry.data.colorHex)
        let progress = min(1, max(0, Double(entry.data.score) / 100))

        VStack(spacing: 6) {
            ZStack {
                // Translucent track, same treatment as ProgressRing.tsx.
                Circle()
                    .stroke(ringColor.opacity(0.15), lineWidth: 10)
                // Filled arc, starts at 12 o'clock, rounded cap.
                Circle()
                    .trim(from: 0, to: entry.data.hasData ? progress : 0)
                    .stroke(ringColor, style: StrokeStyle(lineWidth: 10, lineCap: .round))
                    .rotationEffect(.degrees(-90))
                VStack(spacing: 0) {
                    Text(entry.data.hasData ? "\(entry.data.score)" : "–")
                        .font(.system(size: 28, weight: .bold, design: .rounded))
                    Text("SCORE")
                        .font(.system(size: 9, weight: .semibold))
                        .foregroundColor(.secondary)
                }
            }
            .padding(10)

            if !entry.data.hasData {
                Text("Open Zenova")
                    .font(.system(size: 10, weight: .medium))
                    .foregroundColor(.secondary)
            }
        }
        .widgetURL(URL(string: "zenova-lifescore://"))
        .containerBackground(for: .widget) { Color(.systemBackground) }
    }
}

struct LifeScoreWidget: Widget {
    let kind: String = "LifeScoreWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: LifeScoreProvider()) { entry in
            LifeScoreRingView(entry: entry)
        }
        .configurationDisplayName("LifeScore")
        .description("Your daily LifeScore at a glance.")
        .supportedFamilies([.systemSmall])
    }
}

@main
struct LifeScoreWidgetBundle: WidgetBundle {
    var body: some Widget {
        LifeScoreWidget()
    }
}
