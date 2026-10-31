import { useEffect, useState } from 'react';
import type { CatalogActivity, ConfirmReceipt, ScheduleSession } from '../api/types';

export interface Prefs {
  displayName: string;
  interests: string[];
  sessionMinutes: number;
  lowImpact: boolean;
  vegetarian: boolean;
  weightKg: number | null;
}

export interface HistoryEntry {
  id: string;
  sport: string;
  sportName: string;
  durationMin: number;
  startedAt: string;
  fields: Record<string, string | number>;
  energyDisplay: string | null;
  xp: number;
  personalBest: string | null;
}

export interface SavedSchedule {
  id: string;
  goal: string;
  sessions: ScheduleSession[];
  assumptions: string[];
  savedAt: string;
}

export interface PetState {
  /** Legacy stored meters (kept for old saves); live meters come from petMeters(). */
  energy: number;
  joy: number;
  rest: number;
  equipped: string[];
}

export interface PetMeters {
  energy: number;
  joy: number;
  rest: number;
}

export interface QuestState {
  weekId: string;
  claimed: string[];
}

export interface PlusState {
  source: 'none' | 'demo' | 'revenuecat';
  active: boolean;
  checkedAt: string | null;
}

export interface Matchup {
  id: string;
  token: string;
  sport: string;
  sportName: string;
  format: string;
  players: string[];
  venueName: string | null;
  whenISO: string | null;
  court: string | null;
  showVenue: boolean;
  showCalories: boolean;
  createdAt: string;
  expiresAt: string;
  status: 'invite' | 'result';
  resultText: string | null;
  outcome: string | null;
}

export interface Booking {
  id: string;
  venueId: string;
  venueName: string;
  dateISO: string;
  time: string;
  court: string;
  players: number;
  pricePerPerson: number;
  createdAt: string;
}

interface State {
  prefs: Prefs;
  history: HistoryEntry[];
  xpTotal: number;
  schedules: SavedSchedule[];
  dismissed: string[];
  onboarded: boolean;
  pet: PetState;
  quests: QuestState;
  plus: PlusState;
  matches: Matchup[];
  revoked: string[];
  bookings: Booking[];
}

const KEY = 'rally.v1';

const DEFAULTS: State = {
  prefs: { displayName: '', interests: [], sessionMinutes: 45, lowImpact: false, vegetarian: false, weightKg: null },
  history: [],
  xpTotal: 0,
  schedules: [],
  dismissed: [],
  onboarded: false,
  pet: { energy: 70, joy: 70, rest: 70, equipped: [] },
  quests: { weekId: '', claimed: [] },
  plus: { source: 'none', active: false, checkedAt: null },
  matches: [],
  revoked: [],
  bookings: [],
};

function load(): State {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULTS;
    const parsed = JSON.parse(raw) as Partial<State>;
    return { ...DEFAULTS, ...parsed, prefs: { ...DEFAULTS.prefs, ...(parsed.prefs || {}) } };
  } catch {
    return DEFAULTS;
  }
}

export const PET_NAME = 'Rally the Pup';

/** Cumulative XP thresholds: index + 1 is the level. */
export const LEVELS = [0, 60, 150, 300, 500, 800, 1200, 1800, 2500, 3300, 4300];

export interface LevelInfo {
  level: number;
  into: number;
  need: number;
  nextAt: number | null;
}

export function levelFor(xpTotal: number): LevelInfo {
  let level = 1;
  for (let i = 0; i < LEVELS.length; i++) if (xpTotal >= LEVELS[i]) level = i + 1;
  const base = LEVELS[level - 1];
  const nextAt = level < LEVELS.length ? LEVELS[level] : null;
  return { level, into: xpTotal - base, need: nextAt === null ? 0 : nextAt - base, nextAt };
}

const dayOf = (iso: string) => iso.slice(0, 10);
const dayAt = (t: number) => new Date(t).toISOString().slice(0, 10);
function todayStartUtc(): number {
  const now = new Date();
  return Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
}

/** XP earned from on-device history today (UTC). Sent as confirm context. */
export function xpToday(history: HistoryEntry[]): number {
  const today = dayAt(todayStartUtc());
  return history.filter((h) => dayOf(h.startedAt) === today).reduce((s, h) => s + h.xp, 0);
}

/** Streak day-count the session being confirmed lands on (today counts). */
export function confirmStreak(history: HistoryEntry[]): number {
  const days = new Set(history.map((h) => dayOf(h.startedAt)));
  let streak = 1; // this confirm activates today
  let cursor = todayStartUtc() - 86400000;
  while (days.has(dayAt(cursor))) {
    streak += 1;
    cursor -= 86400000;
  }
  return streak;
}

/** Consecutive active days ending today or yesterday (UTC); 0 when lapsed. */
export function currentStreak(history: HistoryEntry[]): number {
  const days = new Set(history.map((h) => dayOf(h.startedAt)));
  const start = todayStartUtc();
  let cursor = days.has(dayAt(start)) ? start : start - 86400000;
  let streak = 0;
  while (days.has(dayAt(cursor))) {
    streak += 1;
    cursor -= 86400000;
  }
  return streak;
}

/** ISO week id (Monday-based, UTC) used to reset weekly quests. */
export function questWeek(now = new Date()): string {
  const day = (now.getUTCDay() + 6) % 7; // Monday = 0
  const monday = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) - day * 86400000;
  return dayAt(monday);
}

export function weekStartMs(now = new Date()): number {
  const day = (now.getUTCDay() + 6) % 7;
  const n = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return n - day * 86400000;
}

/** Meters derived purely from logged activity (newest-first history). No user action needed. */
export function petMeters(history: HistoryEntry[]): PetMeters {
  if (history.length === 0) return { energy: 60, joy: 55, rest: 70 };
  const now = Date.now();
  const lastAt = new Date(history[0].startedAt).getTime();
  const hours = Number.isFinite(lastAt) ? (now - lastAt) / 3600000 : 999;
  const energy = hours < 24 ? 95 : hours < 48 ? 80 : hours < 72 ? 65 : hours < 168 ? 50 : 40;
  const streak = currentStreak(history);
  const monthAgo = now - 30 * 86400000;
  const sports = new Set(
    history.filter((h) => new Date(h.startedAt).getTime() >= monthAgo).map((h) => h.sport),
  ).size;
  const joy = Math.min(100, 50 + 8 * Math.min(streak, 4) + 5 * Math.min(sports, 3));
  const hard = history[0].durationMin >= 45 && hours < 24;
  const rest = hard ? 45 : hours < 48 ? 70 : 90;
  return { energy, joy, rest };
}

export function petMood(m: PetMeters): string {
  const avg = (m.energy + m.joy + m.rest) / 3;
  if (avg >= 70) return 'Happy';
  if (avg >= 40) return 'Content';
  return 'Tired';
}

export function petRestNote(m: PetMeters): string | null {
  return m.rest >= 60 ? 'Well rested' : null;
}

/** Display text for a stored personal-best marker. */
export function pbLabel(pb: string | null): string | null {
  if (!pb) return null;
  return pb === 'client_reported' ? 'New personal best' : pb;
}

export interface LocalBest {
  sport: string;
  metric: string;
  value: number;
  unit: string;
}

const BEST_UNITS: Record<string, string> = {
  distance_km: 'km', distance_m: 'm', avg_pace_min_per_km: 'min/km',
  top_set_kg: 'kg', rating: 'rating', steps: 'steps',
};
const BEST_LOWER = new Set(['avg_pace_min_per_km']);

/** Last-known score fields for a sport, from the newest history entry that has any. */
export function lastSportFields(history: HistoryEntry[], sport: string): Record<string, string | number> {
  const entry = history.find((h) => h.sport === sport && Object.keys(h.fields).length > 0);
  return entry ? { ...entry.fields } : {};
}

/**
 * Per-match outcome fields. Never prefilled from a previous session: a new
 * match hasn't been won yet, so only stable context (format, opponent, team,
 * position, …) carries over into a fresh draft.
 */
const OUTCOME_FIELDS = new Set(['result', 'score', 'goals', 'assists']);

/** History-backed score fields for a fresh draft, restricted to the template's fields. */
export function draftScoreFields(catalog: CatalogActivity[], history: HistoryEntry[], activityId: string): Record<string, string | number> {
  const names = new Set(catalog.find((t) => t.id === activityId)?.score_fields.map((f) => f.name) ?? []);
  const out: Record<string, string | number> = {};
  for (const [k, v] of Object.entries(lastSportFields(history, activityId))) {
    if (names.has(k) && !OUTCOME_FIELDS.has(k) && v !== '') out[k] = v;
  }
  return out;
}

const RESULT_WORD: Record<string, string> = { win: 'Won', loss: 'Lost', draw: 'Draw' };

/**
 * One-line match outcome for saved fields, e.g. "Won 6-4 6-3 · Singles vs Sam".
 * Null when the entry carries no outcome (plain workout).
 */
export function matchSummary(fields: Record<string, string | number>): string | null {
  const parts: string[] = [];
  const word = RESULT_WORD[String(fields.result ?? '').toLowerCase()];
  if (word) parts.push(word);
  const score = String(fields.score ?? '').trim();
  if (score) parts.push(score);
  const goals = Number(fields.goals);
  if (Number.isFinite(goals) && goals > 0) parts.push(`${goals} goal${goals === 1 ? '' : 's'}`);
  const assists = Number(fields.assists);
  if (Number.isFinite(assists) && assists > 0) parts.push(`${assists} assist${assists === 1 ? '' : 's'}`);
  if (parts.length === 0) return null;
  const context: string[] = [];
  for (const key of ['format', 'session', 'mode']) {
    const v = String(fields[key] ?? '').trim();
    if (v) {
      context.push(v[0].toUpperCase() + v.slice(1));
      break;
    }
  }
  const opponent = String(fields.opponent ?? '').trim();
  if (opponent) context.push(`vs ${opponent}`);
  const team = String(fields.team ?? '').trim();
  if (team) context.push(team);
  const head = parts.join(' ');
  return context.length ? `${head} · ${context.join(' · ')}` : head;
}

/** Best per sport+metric from on-device history (like-for-like only). */
export function personalBests(history: HistoryEntry[]): LocalBest[] {
  const best = new Map<string, LocalBest>();
  for (const h of history) {
    for (const [metric, raw] of Object.entries(h.fields)) {
      const value = Number(raw);
      if (!Number.isFinite(value) || value <= 0 || !(metric in BEST_UNITS)) continue;
      const key = `${h.sport}:${metric}`;
      const prev = best.get(key);
      const better = !prev || (BEST_LOWER.has(metric) ? value < prev.value : value > prev.value);
      if (better) best.set(key, { sport: h.sportName, metric, value, unit: BEST_UNITS[metric] });
    }
  }
  return [...best.values()];
}

export function useStore() {
  const [state, setState] = useState<State>(load);

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch {
      /* storage full or unavailable; app still works for the session */
    }
  }, [state]);

  const setPrefs = (prefs: Prefs) => setState((s) => ({ ...s, prefs }));
  const saveOnboarding = (prefs: Prefs) => setState((s) => ({ ...s, prefs, onboarded: true }));
  const skipOnboarding = () => setState((s) => ({ ...s, onboarded: true }));
  const dismiss = (id: string) => setState((s) => ({ ...s, dismissed: [...s.dismissed, id] }));
  const saveSchedule = (goal: string, sessions: ScheduleSession[], assumptions: string[]) =>
    setState((s) => ({
      ...s,
      schedules: [{ id: `sch-${Date.now()}`, goal, sessions, assumptions, savedAt: new Date().toISOString() }, ...s.schedules].slice(0, 20),
    }));

  const applyReceipt = (receipt: ConfirmReceipt) => {
    const entry: HistoryEntry = {
      id: receipt.activity_id,
      sport: receipt.sport,
      sportName: receipt.sport_name,
      durationMin: receipt.duration_minutes,
      startedAt: receipt.started_at,
      fields: receipt.fields,
      energyDisplay: receipt.energy && 'display' in receipt.energy ? (receipt.energy.display as string) : null,
      xp: receipt.xp.total,
      personalBest: receipt.personal_best,
    };
    setState((s) => {
      if (s.history.some((h) => h.id === entry.id)) return s;
      return {
        ...s,
        history: [entry, ...s.history].slice(0, 300),
        xpTotal: s.xpTotal + receipt.xp.total,
      };
    });
    return entry;
  };

  const toggleEquip = (itemId: string) =>
    setState((s) => ({
      ...s,
      pet: {
        ...s.pet,
        equipped: s.pet.equipped.includes(itemId)
          ? s.pet.equipped.filter((e) => e !== itemId)
          : [...s.pet.equipped, itemId].slice(0, 6),
      },
    }));

  const claimQuest = (weekId: string, questId: string, reward: number) =>
    setState((s) => {
      const claimed = s.quests.weekId === weekId ? s.quests.claimed : [];
      if (claimed.includes(questId)) return s;
      return {
        ...s,
        xpTotal: s.xpTotal + reward,
        quests: { weekId, claimed: [...claimed, questId] },
      };
    });

  const addMatchup = (m: Matchup) =>
    setState((s) => ({ ...s, matches: [m, ...s.matches].slice(0, 50) }));

  const updateMatchup = (id: string, patch: Partial<Matchup>) =>
    setState((s) => ({
      ...s,
      matches: s.matches.map((m) => (m.id === id ? { ...m, ...patch } : m)),
    }));

  const removeMatchup = (id: string) =>
    setState((s) => {
      const m = s.matches.find((x) => x.id === id);
      return {
        ...s,
        matches: s.matches.filter((x) => x.id !== id),
        revoked: m && !s.revoked.includes(m.token) ? [...s.revoked, m.token].slice(-100) : s.revoked,
      };
    });

  const addBooking = (b: Booking) =>
    setState((s) => ({ ...s, bookings: [b, ...s.bookings].slice(0, 50) }));

  const setPlus = (plus: PlusState) => setState((s) => ({ ...s, plus }));

  /** Personal-best check against on-device history. */
  const isLocalBest = (sport: string, metric: string, value: number, higherBetter: boolean): boolean => {
    const others = state.history.filter((h) => h.sport === sport);
    if (others.length === 0) return false; // first session is a baseline, not a best
    const vals = others.map((h) => Number(h.fields[metric])).filter((v) => Number.isFinite(v) && v > 0);
    if (vals.length === 0) return false;
    return higherBetter ? value > Math.max(...vals) : value < Math.min(...vals);
  };

  const clearLocal = () => {
    localStorage.removeItem(KEY);
    localStorage.removeItem('rally.calEvents'); // legacy key from removed calendar import
    setState(DEFAULTS);
  };

  /** One-tap rich demo state. Replaces history, XP, plan, matches, and equipped items. */
  const seedDemo = () => setState((s) => {
    const day = 86400000;
    const now = Date.now();
    const at = (daysAgo: number, h: number, m = 0) => {
      const d = new Date(now - daysAgo * day);
      d.setUTCHours(h, m, 0, 0);
      return d.toISOString();
    };
    const history: HistoryEntry[] = [
      { id: 'seed-run-1', sport: 'running', sportName: 'Running', durationMin: 30, startedAt: at(0, 18), fields: { distance_km: 5.2, avg_pace_min_per_km: 5.8, effort: 'moderate' }, energyDisplay: 'about 300-340 active kcal (estimate)', xp: 30, personalBest: 'New personal best' },
      { id: 'seed-tennis-1', sport: 'tennis', sportName: 'Tennis', durationMin: 60, startedAt: at(0, 7), fields: { format: 'singles', score: '6-4 6-3', result: 'win' }, energyDisplay: 'about 430-470 active kcal (estimate)', xp: 35, personalBest: null },
      { id: 'seed-swim-1', sport: 'swimming', sportName: 'Swimming', durationMin: 45, startedAt: at(0, 6, 30), fields: { distance_m: 1500, pool_length_m: 25, stroke: 'freestyle' }, energyDisplay: 'about 380-420 active kcal (estimate)', xp: 30, personalBest: null },
      { id: 'seed-cycle-1', sport: 'cycling', sportName: 'Cycling', durationMin: 40, startedAt: at(1, 17), fields: { distance_km: 12.4, effort: 'moderate' }, energyDisplay: 'about 330-370 active kcal (estimate)', xp: 25, personalBest: null },
      { id: 'seed-run-2', sport: 'running', sportName: 'Running', durationMin: 28, startedAt: at(2, 7), fields: { distance_km: 4.6, effort: 'easy' }, energyDisplay: 'about 250-280 active kcal (estimate)', xp: 30, personalBest: null },
      { id: 'seed-tennis-2', sport: 'tennis', sportName: 'Tennis', durationMin: 45, startedAt: at(5, 18), fields: { format: 'doubles', result: 'win' }, energyDisplay: 'about 320-360 active kcal (estimate)', xp: 30, personalBest: null },
    ];
    const matchWhen = new Date(now + 2 * day);
    matchWhen.setUTCHours(18, 0, 0, 0);
    return {
      ...s,
      prefs: { ...s.prefs, interests: s.prefs.interests.length ? s.prefs.interests : ['running', 'tennis', 'swimming'] },
      history,
      xpTotal: history.reduce((t, h) => t + h.xp, 0),
      schedules: [{
        id: 'seed-plan', goal: 'Run 3x + lift 2x',
        sessions: [
          { day: 'mon', activity_id: 'running', minutes: 30, note: 'Easy 5k' },
          { day: 'wed', activity_id: 'strength', minutes: 45, note: 'Full body' },
          { day: 'fri', activity_id: 'running', minutes: 30, note: 'Intervals' },
        ],
        assumptions: ['Sample plan loaded for the demo.'],
        savedAt: new Date(now).toISOString(),
      }],
      matches: [{
        id: 'seed-match', token: 'DEMO7D', sport: 'tennis', sportName: 'Tennis',
        format: 'Singles · Best of 3', players: ['You', 'Sam'],
        venueName: 'Greenfield Tennis Courts', whenISO: matchWhen.toISOString(), court: 'Court 2',
        showVenue: true, showCalories: false,
        createdAt: new Date(now).toISOString(),
        expiresAt: new Date(now + 7 * day).toISOString(),
        status: 'invite', resultText: null, outcome: null,
      }],
      pet: { ...s.pet, equipped: ['top-hat'] },
    };
  });

  return { state, setPrefs, saveOnboarding, skipOnboarding, dismiss, saveSchedule, applyReceipt, isLocalBest, clearLocal, seedDemo, toggleEquip, claimQuest, addMatchup, updateMatchup, removeMatchup, addBooking, setPlus };
}

export type Store = ReturnType<typeof useStore>;
