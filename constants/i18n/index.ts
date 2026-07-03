/**
 * Lightweight pure-JS i18n (no native module, no device-locale dependency).
 *
 * Usage in a component:
 *   const t = useT();
 *   <Text>{t('home.greeting')}</Text>
 *   <Text>{t('common.glassesOf', { count: 3 })}</Text>
 *
 * The active language lives in `useLocaleStore` (persisted + synced), so calling
 * `useT()` re-renders the component when the user switches language in Profile.
 * Missing keys fall back to English, then to the raw key (never crashes).
 */
import { useCallback } from 'react';
import { useLocaleStore } from '../../stores/localeStore';
import { en } from './en';
import { tr } from './tr';

export type Translations = typeof en;

const DICTS: Record<string, unknown> = { en, tr };

function resolve(dict: unknown, key: string): unknown {
  return key.split('.').reduce<unknown>(
    (o, k) => (o != null && typeof o === 'object' ? (o as Record<string, unknown>)[k] : undefined),
    dict,
  );
}

export function translate(
  lang: string,
  key: string,
  params?: Record<string, string | number>,
): string {
  const val = resolve(DICTS[lang], key) ?? resolve(DICTS.en, key) ?? key;
  if (typeof val !== 'string') return key;
  if (!params) return val;
  return val.replace(/\{(\w+)\}/g, (_, p) => (params[p] != null ? String(params[p]) : `{${p}}`));
}

export type TFunction = (key: string, params?: Record<string, string | number>) => string;

/** Returns a `t` function bound to the current language; re-renders on change. */
export function useT(): TFunction {
  const lang = useLocaleStore((s) => s.lang);
  return useCallback<TFunction>((key, params) => translate(lang, key, params), [lang]);
}
