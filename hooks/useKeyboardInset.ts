import { useEffect } from 'react';
import { Keyboard, Platform, useWindowDimensions } from 'react-native';
import { useSharedValue, useAnimatedStyle, withTiming, Easing } from 'react-native-reanimated';

/**
 * Overlap between the keyboard's end frame and the window bottom, in window
 * coordinates. Unlike KeyboardAvoidingView's `padding` math this stays correct
 * inside iOS pageSheet modals, whose frame origin is offset from the window.
 * `bottomOffset` is static bottom padding the layout already reserves (e.g.
 * home-indicator padding) so it isn't double-counted while the keyboard is up.
 */
export function computeKeyboardInset(windowHeight: number, keyboardScreenY: number, bottomOffset = 0): number {
  return Math.max(0, windowHeight - keyboardScreenY - bottomOffset);
}

/**
 * iOS-only animated bottom padding that tracks the keyboard frame. Android
 * returns a constant 0 — `adjustResize` already resizes the window there.
 * Apply the returned style to the screen's root (Reanimated) view.
 */
export function useKeyboardInset(bottomOffset = 0) {
  const inset = useSharedValue(0);
  const { height: windowHeight } = useWindowDimensions();

  useEffect(() => {
    if (Platform.OS !== 'ios') return;
    const sub = Keyboard.addListener('keyboardWillChangeFrame', (e) => {
      const target = computeKeyboardInset(windowHeight, e.endCoordinates.screenY, bottomOffset);
      inset.value = withTiming(target, {
        duration: e.duration > 0 ? e.duration : 250,
        // Approximates UIKit's keyboard curve
        easing: Easing.bezier(0.17, 0.59, 0.4, 0.77),
      });
    });
    return () => sub.remove();
  }, [windowHeight, bottomOffset, inset]);

  return useAnimatedStyle(() => ({ paddingBottom: inset.value }));
}
