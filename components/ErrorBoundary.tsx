import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { colors } from '../constants/colors';
import { typography } from '../constants/typography';
import { spacing, radius } from '../constants/spacing';
import { logError } from '../services/monitoring';

interface Props {
  children: React.ReactNode;
}
interface State {
  hasError: boolean;
}

/**
 * App-wide error boundary. Catches render/lifecycle crashes anywhere below it,
 * reports them via `logError` (Sentry-ready), and shows a friendly fallback
 * instead of a white screen. "Try Again" clears the error and re-renders.
 * Persisted data is untouched, so users don't lose anything.
 */
export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    logError(error, { componentStack: info.componentStack });
  }

  reset = () => this.setState({ hasError: false });

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <View style={styles.container}>
        <Text style={styles.emoji}>🌿</Text>
        <Text style={styles.title}>Something went wrong</Text>
        <Text style={styles.body}>
          An unexpected error occurred. Your data is safe — let's try that again.
        </Text>
        <TouchableOpacity
          style={styles.btn}
          onPress={this.reset}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel="Try again"
        >
          <Text style={styles.btnText}>Try Again</Text>
        </TouchableOpacity>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing['2xl'],
  },
  emoji: { fontSize: 48, marginBottom: spacing.base },
  title: {
    fontFamily: typography.fonts.display,
    fontSize: typography.sizes.xl,
    color: colors.text.primary,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  body: {
    fontFamily: typography.fonts.body,
    fontSize: typography.sizes.sm,
    color: colors.text.secondary,
    textAlign: 'center',
    lineHeight: typography.sizes.sm * typography.lineHeights.loose,
    marginBottom: spacing.xl,
  },
  btn: {
    backgroundColor: colors.accent.primary,
    borderRadius: radius.full,
    paddingVertical: 14,
    paddingHorizontal: 32,
  },
  btnText: {
    fontFamily: typography.fonts.display,
    fontSize: typography.sizes.base,
    color: colors.text.inverse,
  },
});
