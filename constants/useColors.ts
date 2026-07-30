import { useThemeStore } from '../stores/themeStore';
import { lightColors, darkColors, type Colors } from './colors';

export function useIsDark(): boolean {
  return useThemeStore((s) => s.mode === 'dark');
}

export function useColors(): Colors {
  const isDark = useIsDark();
  return isDark ? darkColors : lightColors;
}
