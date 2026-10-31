import { Check, ChevronLeft, Compass, Footprints, Star, Swords, Trophy } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { levelFor, questWeek, weekStartMs, type HistoryEntry, type Matchup, type Store } from '../state/store';
import { ScrollTop } from './bits';

export interface Cosmetic {
  id: string;
  name: string;
  emoji: string;
  gate: { type: 'xp'; at: number } | { type: 'level'; at: number } | { type: 'quest'; quest: string; label: string } | { type: 'plus' };
}

export const COSMETICS: Cosmetic[] = [
  { id: 'top-hat', name: 'Top hat', emoji: '🎩', gate: { type: 'xp', at: 100 } },
  { id: 'scarf', name: 'Scarf', emoji: '🧣', gate: { type: 'xp', at: 250 } },
  { id: 'shades', name: 'Shades', emoji: '🕶️', gate: { type: 'level', at: 8 } },
  { id: 'beach-house', name: 'Beach house', emoji: '🏖️', gate: { type: 'xp', at: 500 } },
  { id: 'pro-racket', name: 'Pro racket', emoji: '🎾', gate: { type: 'level', at: 9 } },
  { id: 'gold-collar', name: 'Gold collar', emoji: '🥇', gate: { type: 'quest', quest: 'q-sport', label: 'Quest' } },
  { id: 'star-cape', name: 'Star cape', emoji: '🦸', gate: { type: 'plus' } },
  { id: 'crown', name: 'Crown', emoji: '👑', gate: { type: 'plus' } },
];

export interface UnlockCtx {
  xpTotal: number;
  level: number;
  claimedQuests: string[];
  plusActive: boolean;
}

export function cosmeticUnlocked(c: Cosmetic, ctx: UnlockCtx): boolean {
  switch (c.gate.type) {
    case 'xp': return ctx.xpTotal >= c.gate.at;
    case 'level': return ctx.level >= c.gate.at;
    case 'quest': return ctx.claimedQuests.includes(c.gate.quest);
    case 'plus': return ctx.plusActive;
  }
}

export function gateLabel(c: Cosmetic): string {
  switch (c.gate.type) {
    case 'xp': return `${c.gate.at} XP`;
    case 'level': return `Lv ${c.gate.at}`;
    case 'quest': return c.gate.label;
    case 'plus': return 'Plus';
  }
}

export function unlockCtx(store: Store, week: string): UnlockCtx {
  return {
    xpTotal: store.state.xpTotal,
    level: levelFor(store.state.xpTotal).level,
    claimedQuests: store.state.quests.weekId === week ? store.state.quests.claimed : [],
    plusActive: store.state.plus.active,
  };
}

export function Closet({ store, onPlusLocked }: { store: Store; onPlusLocked?: () => void }) {
  const week = questWeek();
  const ctx = unlockCtx(store, week);
  const equipped = store.state.pet.equipped;
  return (
    <div className="closet">
      {COSMETICS.map((c) => {
        const owned = cosmeticUnlocked(c, ctx);
        const isEquipped = equipped.includes(c.id);
        return (
          <button
            key={c.id}
            type="button"
            className={`closet-item${owned ? '' : ' locked'}${isEquipped ? ' equipped' : ''}`}
            disabled={!owned}
            onClick={() => store.toggleEquip(c.id)}
            aria-label={`${c.name}, ${owned ? (isEquipped ? 'equipped' : 'owned') : `locked, requires ${gateLabel(c)}`}`}
          >
            <span className="emoji" aria-hidden="true">{c.emoji}</span>
            {c.name}
            <br />
            <span className="dim">{owned ? (isEquipped ? <>On <Check size={11} aria-hidden="true" /></> : 'Owned') : gateLabel(c)}</span>
          </button>
        );
      })}
      {onPlusLocked && !ctx.plusActive && (
        <p className="dim">Star cape and Crown need Rally Plus. <button className="link" onClick={onPlusLocked}>See Plus</button></p>
      )}
    </div>
  );
}

interface QuestDef {
  id: string;
  title: string;
  target: number;
  reward: number;
  icon: LucideIcon;
  plusOnly?: boolean;
  progress: (history: HistoryEntry[], matches: Matchup[], weekStart: number) => number;
}

const inWeek = (iso: string, weekStart: number) => new Date(iso).getTime() >= weekStart;

const QUESTS: QuestDef[] = [
  {
    id: 'q-sessions', title: 'Log 3 sessions', target: 3, reward: 60, icon: Footprints,
    progress: (h, _m, w) => h.filter((e) => inWeek(e.startedAt, w)).length,
  },
  {
    id: 'q-sport', title: 'Try a new sport', target: 1, reward: 80, icon: Compass,
    progress: (h, _m, w) => new Set(h.filter((e) => inWeek(e.startedAt, w)).map((e) => e.sport)).size >= 2 ? 1 : 0,
  },
  {
    id: 'q-match', title: 'Invite a friend to a match', target: 1, reward: 50, icon: Swords,
    progress: (_h, m, w) => (m.some((x) => new Date(x.createdAt).getTime() >= w) ? 1 : 0),
  },
  {
    id: 'q-seasonal', title: 'Seasonal: log 5 sessions', target: 5, reward: 120, icon: Star, plusOnly: true,
    progress: (h, _m, w) => h.filter((e) => inWeek(e.startedAt, w)).length,
  },
];

export function Rewards({ store, onBack, onPlusLocked }: {
  store: Store;
  onBack: () => void;
  onPlusLocked: () => void;
}) {
  const week = questWeek();
  const weekStart = weekStartMs();
  const claimed = store.state.quests.weekId === week ? store.state.quests.claimed : [];
  const lv = levelFor(store.state.xpTotal);

  return (
    <div className="screen">
      <ScrollTop />
      <header className="topbar">
        <button className="btn ghost" onClick={onBack} aria-label="Back"><ChevronLeft size={16} aria-hidden="true" />Back</button>
      </header>

      <div className="card">
        <p className="kicker">Rewards</p>
        <h2 className="display"><Trophy size={26} aria-hidden="true" /> Level {lv.level}</h2>
        <p className="dim">{store.state.xpTotal.toLocaleString()} / {(lv.nextAt ?? store.state.xpTotal).toLocaleString()} XP</p>
        <div className="xpbar" aria-hidden="true">
          <div style={{ width: `${lv.nextAt === null ? 100 : Math.round((lv.into / lv.need) * 100)}%` }} />
        </div>
      </div>

      <section className="card">
        <h3>Weekly quests</h3>
        <p className="dim">Resets Mon · progress counts this week's sessions on this device.</p>
        {QUESTS.map((q) => {
          const done = Math.min(q.target, q.progress(store.state.history, store.state.matches, weekStart));
          const isClaimed = claimed.includes(q.id);
          const locked = !!q.plusOnly && !store.state.plus.active;
          return (
            <div className="quest" key={q.id}>
              <q.icon size={22} aria-hidden="true" className="quest-ic" />
              <div className="grow">
                <p className="quest-title"><strong>{q.title}</strong> {q.plusOnly && <span className="tag plus">Plus</span>}</p>
                <p className="dim">{done}/{q.target} · +{q.reward} XP</p>
              </div>
              {isClaimed ? (
                <span className="dim"><Check size={13} aria-hidden="true" /> Claimed</span>
              ) : locked ? (
                <button className="btn secondary" onClick={onPlusLocked}>Plus</button>
              ) : (
                <button
                  className="btn secondary"
                  disabled={done < q.target}
                  onClick={() => store.claimQuest(week, q.id, q.reward)}
                >
                  Claim
                </button>
              )}
            </div>
          );
        })}
      </section>

      <section className="card">
        <h3>Unlock with XP</h3>
        <p className="dim">Earnable · no pay-to-win. Tap an owned look to dress your pet.</p>
        <Closet store={store} onPlusLocked={onPlusLocked} />
      </section>
    </div>
  );
}
