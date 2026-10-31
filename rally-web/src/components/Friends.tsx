import { Award, Share2 } from 'lucide-react';
import { useState } from 'react';
import { pbLabel, type Store } from '../state/store';
import { MatchupSection } from './Matchup';

export function Friends({ store }: { store: Store }) {
  const { state } = store;
  const [picked, setPicked] = useState<string | null>(state.history[0]?.id || null);
  const [notice, setNotice] = useState<string | null>(null);

  const entry = state.history.find((h) => h.id === picked) || null;

  const pb = entry ? pbLabel(entry.personalBest) : null;
  const shareText = entry
    ? `Rally: ${entry.sportName} · ${entry.durationMin} min${pb ? ` · ★ ${pb}` : ''}${entry.energyDisplay ? ` · ${entry.energyDisplay}` : ''} (+${entry.xp} XP)`
    : '';

  const share = async () => {
    if (!entry) return;
    setNotice(null);
    const nav = navigator as Navigator & { share?: (d: { title: string; text: string }) => Promise<void> };
    if (nav.share) {
      try {
        await nav.share({ title: 'Rally activity', text: shareText });
        return;
      } catch {
        return; // user dismissed the sheet
      }
    }
    try {
      await navigator.clipboard.writeText(shareText);
      setNotice('Copied to clipboard.');
    } catch {
      setNotice('Copy this text manually: ' + shareText);
    }
  };

  return (
    <div className="screen">
      <header className="topbar"><h2>Friends</h2></header>

      <MatchupSection store={store} />

      <section className="card">
        <h3>Share an activity card</h3>
        {state.history.length === 0 ? (
          <p className="dim">Log a session first — then share a card from here. Sharing is always your choice; nothing posts itself.</p>
        ) : (
          <>
            <label className="field">Session
              <select value={picked || ''} onChange={(e) => setPicked(e.target.value)}>
                {state.history.map((h) => (
                  <option key={h.id} value={h.id}>{h.sportName} · {h.durationMin} min · {h.startedAt.slice(0, 10)}</option>
                ))}
              </select>
            </label>
            {entry && (
              <div className="sharecard">
                <p className="share-kicker">RALLY</p>
                <p className="share-title">{entry.sportName}</p>
                <p>{entry.durationMin} min · +{entry.xp} XP</p>
                {pb && <p><Award size={14} aria-hidden="true" /> {pb}</p>}
                {entry.energyDisplay && <p className="dim">{entry.energyDisplay}</p>}
              </div>
            )}
            <div className="row">
              <button className="btn primary" onClick={share}><Share2 size={16} aria-hidden="true" />Share</button>
            </div>
            {notice && <p className="dim">{notice}</p>}
          </>
        )}
      </section>

    </div>
  );
}
