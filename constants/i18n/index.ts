/**
 * Lightweight pure-JS i18n (no native module, no device-locale dependency).
 *
 * Usage in a component:
 *   const t = useT();
 *   <Text>{t('home.greeting')}</Text>
 *   <Text>{t('common.glassesOf', { count: 3 })}</Text>
 *
 * The app ships English-only (Turkish was removed 2026-07-05); the key-based
 * indirection stays so copy lives in one file and future languages only need
 * a new dictionary. Missing keys fall back to the raw key (never crashes).
 */
import { en } from './en';

export type Translations = typeof en;

function resolve(dict: unknown, key: string): unknown {
  return key.split('.').reduce<unknown>(
    (o, k) => (o != null && typeof o === 'object' ? (o as Record<string, unknown>)[k] : undefined),
    dict,
  );
}

export function translate(
  key: string,
  params?: Record<string, string | number>,
): string {
  const val = resolve(en, key) ?? key;
  if (typeof val !== 'string') return key;
  if (!params) return val;
  return val.replace(/\{(\w+)\}/g, (_, p) => (params[p] != null ? String(params[p]) : `{${p}}`));
}

export type TFunction = (key: string, params?: Record<string, string | number>) => string;

/** Returns the `t` function (stable reference — single-language app). */
export function useT(): TFunction {
  return translate;
}
