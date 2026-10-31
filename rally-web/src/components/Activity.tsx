import { Award, ChevronRight, Flame, TrendingDown, TrendingUp, Trophy, Zap } from 'lucide-react';
import { useState } from 'react';
import { currentStreak, matchSummary, pbLabel, personalBests, type HistoryEntry, type Store } from '../state/store';
import { Modal, Prov } from './bits';

function PaceTrend({ history }: { history: HistoryEntry[] }) {
  const runs = history
    .filter((h) => h.sport === 'running'
      && Number.isFinite(Number(h.fields.avg_pace_min_per_km))
      && Number(h.fields.avg_pace_min_per_km) > 0)
    .slice(0, 6)
    .reverse();
  if (runs.length < 2) {
    return (
      <div className="trend">
        <p className="kicker">Run pace trend</p>
        <p className="dim">Log runs with distance and pace to see your trend here.</p>
      </div>
    );
  }
  const paces = runs.map((r) => Number(r.fields.avg_pace_min_per_km));
  const avg = paces.reduce((s, p) => s + p, 0) / paces.length;
  const last = paces[paces.length - 1];
  const min = Math.min(...paces);
  const max = Math.max(...paces);
  const span = max - min || 1;
  const pts = paces.map((p, i) => `${(i / (paces.length - 1)) * 100},${58 - ((p - min) / span) * 52}`).join(' ');
  return (
    <div className="trend">
      <p className="kicker">Run pace · last {runs.length} runs</p>
      <svg viewBox="0 0 100 64" preserveAspectRatio="none" role="img" aria-label={`Pace trend, latest ${last} minutes per kilometer`}>
        <polyline points={pts} fill="none" stroke="#1f6f5c" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
        <circle cx={100} cy={58 - ((last - min) / span) * 52} r="3" fill="#1f6f5c" />
      </svg>
      <p className="dim">{last <= avg ? <TrendingUp size={13} aria-hidden="true" /> : <TrendingDown size={13} aria-hidden="true" />} {last < avg ? 'Faster than your average — nice.' : last > avg ? 'A touch slower than your average.' : 'Right on your average.'} <Prov kind="self-reported" /></p>
    </div>
  );
}

/** Compact activity summary: trend + streak + menu rows. Details open in modals. */
export function ActivitySections({ store }: { store: Store }) {
  const { state } = store;
  const [sheet, setSheet] = useState<'none' | 'history' | 'bests' | 'plans'>('none');
  const [filter, setFilter] = useState<string>('all');

  const sports = [...new Set(state.history.map((h) => h.sport))].slice(0, 6);
  const sportName = (id: string) => state.history.find((h) => h.sport === id)?.sportName || id;
  const visible = filter === 'all' ? state.history : state.history.filter((h) => h.sport === filter);
  const shown = visible.slice(0, 60);
  const bests = personalBests(state.history);
  const streak = currentStreak(state.history);

  const close = () => setSheet('none');

  return (
    <div className="stack">
      <PaceTrend history={state.history} />

      <section>
        <h3 className="section-title">Streak</h3>
        {streak > 0
          ? <p><Flame size={15} aria-hidden="true" /> <strong>{streak}-day streak</strong> <span className="dim">· consistency earns bonus XP; rest days never erase progress.</span></p>
          : <p className="dim">No active streak — log a session to start one. Rest days never set you back.</p>}
      </section>

      <section className="card menu">
        <button type="button" className="menu-row" onClick={() => setSheet('history')}>
          <span className="grow"><strong>History</strong> <span className="dim">· {state.history.length} session{state.history.length === 1 ? '' : 's'}</span></span>
          <ChevronRight size={18} aria-hidden="true" />
        </button>
        <button type="button" className="menu-row" onClick={() => setSheet('bests')}>
          <span className="grow"><strong>Personal bests</strong> <span className="dim">· {bests.length} on this device</span></span>
          <ChevronRight size={18} aria-hidden="true" />
        </button>
        {state.schedules.length > 0 && (
          <button type="button" className="menu-row" onClick={() => setSheet('plans')}>
            <span className="grow"><strong>Saved plans</strong> <span className="dim">· {state.schedules.length}</span></span>
            <ChevronRight size={18} aria-hidden="true" />
          </button>
        )}
      </section>

      {sheet === 'history' && (
        <Modal label="Session history" onClose={close}>
          <h3>History ({visible.length})</h3>
          <div className="chips" role="group" aria-label="Filter by sport">
            <button type="button" className={`chip ${filter === 'all' ? 'on' : ''}`} onClick={() => setFilter('all')}>All</button>
            {sports.map((s) => (
              <button key={s} type="button" className={`chip ${filter === s ? 'on' : ''}`} onClick={() => setFilter(s)}>{sportName(s)}</button>
            ))}
          </div>
          {visible.length === 0 && <p className="dim">Nothing logged yet. Say “I played tennis for an hour” in Today.</p>}
          {shown.map((h) => (
            <div className="card" key={h.id}>
              <p><strong>{h.sportName}</strong> · {h.durationMin} min</p>
              {matchSummary(h.fields) && <p><Trophy size={13} aria-hidden="true" /> {matchSummary(h.fields)}</p>}
              <p className="dim">{new Date(h.startedAt).toLocaleString()} · <Zap size={12} aria-hidden="true" />+{h.xp} XP</p>
              {h.energyDisplay && <p className="est-note">{h.energyDisplay} <Prov kind="estimated" /></p>}
              {pbLabel(h.personalBest) && <p className="pb"><Award size={13} aria-hidden="true" /> {pbLabel(h.personalBest)}</p>}
            </div>
          ))}
          {visible.length > shown.length && <p className="dim">Showing the {shown.length} most recent.</p>}
          <div className="row">
            <button className="btn secondary" onClick={close}>Close</button>
          </div>
        </Modal>
      )}

      {sheet === 'bests' && (
        <Modal label="Personal bests" onClose={close}>
          <h3>Personal bests</h3>
          {bests.length === 0 ? (
            <p className="dim">No records yet — log a session to set baselines.</p>
          ) : (
            <ul className="plain">
              {bests.map((b, i) => (
                <li key={i}><Award size={13} aria-hidden="true" /> <strong>{b.sport}</strong> · {b.metric}: {b.value} {b.unit} <Prov kind={b.metric === 'rating' ? 'self-entered' : 'self-reported'} /></li>
              ))}
            </ul>
          )}
          <div className="row">
            <button className="btn secondary" onClick={close}>Close</button>
          </div>
        </Modal>
      )}

      {sheet === 'plans' && (
        <Modal label="Saved plans" onClose={close}>
          <h3>Saved plans</h3>
          {state.schedules.map((s) => (
            <div className="card" key={s.id}>
              <h4>{s.goal}</h4>
              <ul className="sched">
                {s.sessions.map((ss, i) => (
                  <li key={i}><strong>{ss.day}</strong> · {ss.activity_id} · {ss.minutes} min</li>
                ))}
              </ul>
            </div>
          ))}
          <div className="row">
            <button className="btn secondary" onClick={close}>Close</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
