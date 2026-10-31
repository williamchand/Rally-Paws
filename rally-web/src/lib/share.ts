import type { Matchup } from '../state/store';

/** Self-contained match share links (no server): payload rides in the URL fragment. */

export interface SharedMatch {
  v: 1;
  token: string;
  sport: string;
  sportName: string;
  format: string;
  players: string[];
  venue: string | null;
  when: string | null;
  court: string | null;
  showCalories: boolean;
  exp: number;
  status: 'invite' | 'result';
  result: string | null;
  outcome: string | null;
}

export function makeToken(length = 8): string {
  const abc = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  const buf = new Uint32Array(length);
  crypto.getRandomValues(buf);
  return [...buf].map((n) => abc[n % abc.length]).join('');
}

function b64urlEncode(s: string): string {
  const bytes = new TextEncoder().encode(s);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function b64urlDecode(s: string): string {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(b64);
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

export function encodeMatch(m: Matchup): string {
  const payload: SharedMatch = {
    v: 1,
    token: m.token,
    sport: m.sport,
    sportName: m.sportName,
    format: m.format,
    players: m.players,
    venue: m.showVenue ? m.venueName : null,
    when: m.whenISO,
    court: m.court,
    showCalories: m.showCalories,
    exp: new Date(m.expiresAt).getTime(),
    status: m.status,
    result: m.resultText,
    outcome: m.outcome,
  };
  return b64urlEncode(JSON.stringify(payload));
}

export function matchLink(m: Matchup): string {
  return `${location.origin}${location.pathname}#m=${encodeMatch(m)}`;
}

export type DecodedLink = { ok: true; match: SharedMatch } | { ok: false; reason: 'invalid' | 'expired' };

export function decodeMatchLink(hash: string): DecodedLink | null {
  if (!hash.startsWith('#m=')) return null;
  try {
    const p = JSON.parse(b64urlDecode(hash.slice(3))) as SharedMatch;
    if (p.v !== 1 || typeof p.token !== 'string' || typeof p.sport !== 'string'
        || !Array.isArray(p.players) || typeof p.exp !== 'number') {
      return { ok: false, reason: 'invalid' };
    }
    if (p.exp < Date.now()) return { ok: false, reason: 'expired' };
    return { ok: true, match: p };
  } catch {
    return { ok: false, reason: 'invalid' };
  }
}
