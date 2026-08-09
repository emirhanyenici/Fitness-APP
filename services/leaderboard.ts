import { supabase } from './supabase';

export type LeaderboardMetric = 'streak' | 'avg_score' | 'effort_score';

export interface LeaderboardRow {
  user_id: string;
  nickname: string;
  tag: number;
  streak: number;
  avg_score: number;
  effort_score: number;
}

const NICKNAME_MAX_LEN = 20;

/**
 * Small static blocklist — v1 profanity/slur filter for the public,
 * unmoderated leaderboard nickname field (Apple UGC guideline 1.2 requires
 * some filtering mechanism for public user-generated content). Substring
 * match, case/diacritic-insensitive. Not exhaustive — paired with the report
 * mechanism below as a second line of defense.
 */
const BLOCKED_SUBSTRINGS = [
  'fuck', 'shit', 'bitch', 'cunt', 'nigger', 'nigga', 'faggot', 'retard',
  'whore', 'slut', 'rape', 'nazi', 'hitler',
];

/** Trims, strips the reserved '#' tag-separator, and caps a leaderboard nickname. */
export function sanitizeNickname(raw: string): string {
  return raw.replace(/#/g, '').trim().slice(0, NICKNAME_MAX_LEN);
}

/** True if the (already-sanitized) nickname contains a blocked term. */
export function isNicknameBlocked(nickname: string): boolean {
  const normalized = nickname.toLowerCase();
  return BLOCKED_SUBSTRINGS.some((word) => normalized.includes(word));
}

/** "Nickname#tag" — the reserved '#' separator disambiguates duplicate nicknames (server-assigned, join order). */
export function formatHandle(nickname: string, tag: number): string {
  return `${nickname}#${tag}`;
}

/** Returns true on success — callers must not treat the user as joined/updated on false. */
export async function upsertMyStats(
  userId: string,
  nickname: string,
  streak: number,
  avgScore: number,
  effortScore: number,
): Promise<boolean> {
  const { error } = await supabase.from('leaderboard_stats').upsert(
    { user_id: userId, nickname: sanitizeNickname(nickname), streak, avg_score: avgScore, effort_score: effortScore },
    { onConflict: 'user_id' },
  );
  if (error) {
    console.warn('[leaderboard] upsert failed:', error.message);
    return false;
  }
  return true;
}

/** Returns true on success — callers must not treat the user as left on false. */
export async function leaveLeaderboard(userId: string): Promise<boolean> {
  const { error } = await supabase.from('leaderboard_stats').delete().eq('user_id', userId);
  if (error) {
    console.warn('[leaderboard] leave failed:', error.message);
    return false;
  }
  return true;
}

export async function fetchMine(userId: string): Promise<LeaderboardRow | null> {
  const { data, error } = await supabase
    .from('leaderboard_stats')
    .select('user_id, nickname, tag, streak, avg_score, effort_score')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) {
    console.warn('[leaderboard] fetchMine failed:', error.message);
    return null;
  }
  return data;
}

export async function fetchTop(metric: LeaderboardMetric, limit = 50): Promise<LeaderboardRow[]> {
  const { data, error } = await supabase
    .from('leaderboard_stats')
    .select('user_id, nickname, tag, streak, avg_score, effort_score')
    .order(metric, { ascending: false })
    .limit(limit);
  if (error) {
    console.warn('[leaderboard] fetchTop failed:', error.message);
    return [];
  }
  return data ?? [];
}

/** Returns true on success. Write-only from the app's side — no way to read back submitted reports. */
export async function reportUser(
  reporterId: string,
  reportedUserId: string,
  reportedNickname: string,
): Promise<boolean> {
  const { error } = await supabase.from('leaderboard_reports').insert({
    reporter_id: reporterId,
    reported_user_id: reportedUserId,
    reported_nickname: reportedNickname,
  });
  if (error) {
    console.warn('[leaderboard] report failed:', error.message);
    return false;
  }
  return true;
}

/** 1-based rank by strictly-greater count; null when the value is 0 (not meaningfully ranked yet). */
export async function fetchMyRank(metric: LeaderboardMetric, myValue: number): Promise<number | null> {
  if (myValue <= 0) return null;
  const { count, error } = await supabase
    .from('leaderboard_stats')
    .select('user_id', { count: 'exact', head: true })
    .gt(metric, myValue);
  if (error) {
    console.warn('[leaderboard] fetchMyRank failed:', error.message);
    return null;
  }
  return (count ?? 0) + 1;
}
