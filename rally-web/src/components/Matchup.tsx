import { BookmarkPlus, Clock, Copy, Link2, Plus, RotateCcw, Swords, Trash2, Trophy, Users } from 'lucide-react';
import { useEffect, useState } from 'react';
import { DEMO_VENUES, nextDays, slotBooked } from '../lib/venues';
import { decodeMatchLink, makeToken, matchLink, type SharedMatch } from '../lib/share';
import { ScrollTop } from './bits';
import type { Matchup, Store } from '../state/store';

const SPORTS = [
  { id: 'tennis', name: 'Tennis' },
  { id: 'volleyball', name: 'Volleyball' },
  { id: 'esports', name: 'Esports' },
  { id: 'chess', name: 'Chess' },
];

function fmtWhen(iso: string | null): string {
  if (!iso) return 'Time to be set';
  return new Date(iso).toLocaleString([], { weekday: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export function MatchupSection({ store }: { store: Store }) {
  const [view, setView] = useState<{ name: 'list' } | { name: 'create' } | { name: 'detail'; id: string }>({ name: 'list' });
  const [copied, setCopied] = useState(false);

  if (view.name === 'create') {
    return <MatchupCreate store={store} onBack={() => setView({ name: 'list' })} onCreated={(id) => setView({ name: 'detail', id })} />;
  }

  if (view.name === 'detail') {
    const m = store.state.matches.find((x) => x.id === view.id);
    if (!m) return <div className="card"><p>Gone — that matchup was revoked.</p><button className="btn secondary" onClick={() => setView({ name: 'list' })}>Back</button></div>;
    return <MatchupDetail store={store} m={m} copied={copied} setCopied={setCopied} onBack={() => setView({ name: 'list' })} />;
  }

  const now = Date.now();
  const live = store.state.matches.filter((m) => new Date(m.expiresAt).getTime() > now);
  const expired = store.state.matches.filter((m) => new Date(m.expiresAt).getTime() <= now);
  const row = (m: Matchup) => (
    <div className="quest" key={m.id}>
      <div className="grow">
        <p><strong>{m.sportName}</strong> · {m.players.join(' vs ')}</p>
        <p className="dim">{fmtWhen(m.whenISO)}{m.status === 'result' && m.resultText ? ` · ${m.resultText}` : ''}</p>
      </div>
      <button className="btn secondary" onClick={() => setView({ name: 'detail', id: m.id })}>Open</button>
    </div>
  );
  return (
    <section className="card">
      <h3>Matchups</h3>
      <p className="dim">Plan a match, share a private invite link. Links expire in 7 days and carry no health data.</p>
      <button className="btn primary block" onClick={() => setView({ name: 'create' })}><Plus size={16} aria-hidden="true" />New matchup</button>
      {live.length === 0 && expired.length === 0 && <p className="dim">No matchups yet.</p>}
      {live.map(row)}
      {expired.length > 0 && (
        <>
          <h4>Expired</h4>
          <p className="dim">Links no longer open. Open one to record a late result or delete it.</p>
          {expired.map(row)}
        </>
      )}
    </section>
  );
}

function MatchupCreate({ store, onBack, onCreated }: {
  store: Store;
  onBack: () => void;
  onCreated: (id: string) => void;
}) {
  const [sport, setSport] = useState('tennis');
  const [format, setFormat] = useState('Singles · Best of 3');
  const [friend, setFriend] = useState('');
  const [venueId, setVenueId] = useState<string>('');
  const [day, setDay] = useState(nextDays(6)[0].dateISO);
  const [time, setTime] = useState(() => {
    const d = new Date(Date.now() + 3600000);
    return `${String(d.getHours()).padStart(2, '0')}:00`;
  });
  const [timeTouched, setTimeTouched] = useState(false);
  const [court, setCourt] = useState('');
  const days = nextDays(6);
  const venue = DEMO_VENUES.find((v) => v.id === venueId) || null;

  useEffect(() => {
    if (timeTouched || !venue) return;
    const first = venue.slots.find((s) => !slotBooked(venue.id, day, s.time));
    if (first) setTime(first.time);
  }, [venueId, day]);

  const create = () => {
    const sportName = SPORTS.find((s) => s.id === sport)?.name || sport;
    const whenISO = new Date(`${day}T${time}:00`).toISOString();
    const now = Date.now();
    const m: Matchup = {
      id: `m-${now}`,
      token: makeToken(),
      sport,
      sportName,
      format: format.trim() || 'Friendly',
      players: ['You', friend.trim() || 'Friend'],
      venueName: venue ? venue.name : null,
      whenISO,
      court: court.trim() || null,
      showVenue: true,
      showCalories: false,
      createdAt: new Date(now).toISOString(),
      expiresAt: new Date(now + 7 * 86400000).toISOString(),
      status: 'invite',
      resultText: null,
      outcome: null,
    };
    store.addMatchup(m);
    onCreated(m.id);
  };

  return (
    <section className="card">
      <ScrollTop />
      <h3>New matchup</h3>
      <div className="chips" role="group" aria-label="Sport">
        {SPORTS.map((s) => (
          <button key={s.id} type="button" className={`chip ${sport === s.id ? 'on' : ''}`} onClick={() => setSport(s.id)}>{s.name}</button>
        ))}
      </div>
      <label className="field">Format
        <input value={format} maxLength={60} onChange={(e) => setFormat(e.target.value)} placeholder="Singles · Best of 3" />
      </label>
      <label className="field">Friend
        <input value={friend} maxLength={40} onChange={(e) => setFriend(e.target.value)} placeholder="Sam" />
      </label>
      <label className="field">Venue (optional, demo list)
        <select value={venueId} onChange={(e) => { setVenueId(e.target.value); setCourt(''); }}>
          <option value="">No venue</option>
          {DEMO_VENUES.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
        </select>
      </label>
      {venue && (
        <label className="field">Court
          <select value={court} onChange={(e) => setCourt(e.target.value)}>
            <option value="">Any court</option>
            {venue.courts.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>
      )}
      <div className="field"><span>Day</span>
        <div className="chips">
          {days.map((d) => (
            <button key={d.dateISO} type="button" className={`chip ${day === d.dateISO ? 'on' : ''}`} onClick={() => setDay(d.dateISO)}>
              {d.weekday} {d.dayNum}
            </button>
          ))}
        </div>
      </div>
      <label className="field">Time
        <input type="time" value={time} onChange={(e) => { setTime(e.target.value); setTimeTouched(true); }} />
      </label>
      <div className="row">
        <button className="btn secondary" onClick={onBack}>Cancel</button>
        <button className="btn primary" onClick={create}><Link2 size={16} aria-hidden="true" />Create invite</button>
      </div>
    </section>
  );
}

function MatchupDetail({ store, m, copied, setCopied, onBack }: {
  store: Store;
  m: Matchup;
  copied: boolean;
  setCopied: (v: boolean) => void;
  onBack: () => void;
}) {
  const [score, setScore] = useState(m.resultText || '');
  const [outcome, setOutcome] = useState(m.outcome || 'win');
  const [confirming, setConfirming] = useState(false);
  const link = matchLink(m);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };

  return (
    <section className="card">
      <ScrollTop />
      <h3>{m.sportName} · {m.format}</h3>
      <p className="meta-line"><Users size={14} aria-hidden="true" />{m.players.join(' vs ')}</p>
      <p className="meta-line dim"><Clock size={13} aria-hidden="true" />{fmtWhen(m.whenISO)}{m.venueName && m.showVenue ? ` · ${m.venueName}` : ''}{m.court ? ` · ${m.court}` : ''}</p>
      <p className="dim">Status: {m.status === 'result' ? `result recorded${m.resultText ? ` (${m.resultText})` : ''}` : 'invite open'} · score is self-reported{new Date(m.expiresAt).getTime() <= Date.now() ? ' · link expired' : ''}</p>

      <h4>Share link</h4>
      <div className="linkbox"><code>{link}</code><button className="btn secondary" onClick={copy}><Copy size={16} aria-hidden="true" />{copied ? 'Copied' : 'Copy'}</button></div>

      {m.status === 'invite' ? (
        <>
          <h4>Record result</h4>
          <div className="grid2">
            <label className="field">Score
              <input value={score} maxLength={40} onChange={(e) => setScore(e.target.value)} placeholder="6-4 6-3" />
            </label>
            <label className="field">Outcome
              <select value={outcome} onChange={(e) => setOutcome(e.target.value)}>
                <option value="win">You won</option>
                <option value="loss">You lost</option>
                <option value="draw">Draw</option>
              </select>
            </label>
          </div>
          <div className="row">
            <button className="btn secondary" onClick={() => store.updateMatchup(m.id, { status: 'result', resultText: score.trim() || null, outcome })}><Trophy size={16} aria-hidden="true" />Save result</button>
          </div>
        </>
      ) : (
        <div className="row">
          <button className="btn secondary" onClick={() => store.updateMatchup(m.id, { status: 'invite' })}><RotateCcw size={16} aria-hidden="true" />Reopen invite</button>
        </div>
      )}

      <div className="row">
        <button className="btn secondary" onClick={onBack}>Back</button>
        {!confirming ? (
          <button className="btn danger" onClick={() => setConfirming(true)}><Trash2 size={16} aria-hidden="true" />Revoke & delete</button>
        ) : (
          <>
            <span className="dim">Revoke the link and remove from this device? Copies opened on other devices stay readable until expiry.</span>
            <button className="btn danger" onClick={() => { store.removeMatchup(m.id); onBack(); }}><Trash2 size={16} aria-hidden="true" />Yes, revoke</button>
            <button className="btn ghost" onClick={() => setConfirming(false)}>Cancel</button>
          </>
        )}
      </div>
    </section>
  );
}

export function SharedMatchView({ hash, revoked, onSave, onDismiss }: {
  hash: string;
  revoked: string[];
  onSave: (m: Matchup) => void;
  onDismiss: () => void;
}) {
  const decoded = decodeMatchLink(hash);
  if (!decoded || !decoded.ok) {
    const reason = !decoded || decoded.reason === 'invalid' ? 'That link is invalid.' : 'That link has expired.';
    return (
      <div className="screen">
        <ScrollTop />
        <div className="card"><h3>Match invite</h3><p>{reason}</p>
          <button className="btn primary" onClick={onDismiss}>Open Rally</button>
        </div>
      </div>
    );
  }
  const s: SharedMatch = decoded.match;
  if (revoked.includes(s.token)) {
    return (
      <div className="screen">
        <ScrollTop />
        <div className="card"><h3>Match invite</h3><p>This invite was revoked by the owner.</p>
          <button className="btn primary" onClick={onDismiss}>Open Rally</button>
        </div>
      </div>
    );
  }
  const save = () => {
    const now = new Date().toISOString();
    onSave({
      id: `shared-${s.token}`, token: s.token, sport: s.sport, sportName: s.sportName,
      format: s.format, players: s.players, venueName: s.venue, whenISO: s.when,
      court: s.court, showVenue: s.venue !== null, showCalories: s.showCalories,
      createdAt: now, expiresAt: new Date(s.exp).toISOString(),
      status: s.status, resultText: s.result, outcome: s.outcome,
    });
  };
  return (
    <div className="screen">
      <ScrollTop />
      <div className="card">
        <p className="kicker"><Swords size={12} aria-hidden="true" /> Match invite · via link</p>
        <h3>{s.sportName} · {s.format}</h3>
        <p className="meta-line"><Users size={14} aria-hidden="true" />{s.players.join(' vs ')}</p>
        <p className="meta-line dim"><Clock size={13} aria-hidden="true" />{s.when ? new Date(s.when).toLocaleString([], { weekday: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : 'Time to be set'}{s.venue ? ` · ${s.venue}` : ''}{s.court ? ` · ${s.court}` : ''}</p>
        {s.status === 'result' && <p>{s.result ? `Result: ${s.result}` : 'Result recorded.'} <span className="dim">Self-reported.</span></p>}
        <p className="dim">Invite-only link · expires {new Date(s.exp).toLocaleDateString()} · no health data attached.</p>
        <div className="row">
          <button className="btn primary" onClick={save}><BookmarkPlus size={16} aria-hidden="true" />Save to my matches</button>
          <button className="btn ghost" onClick={onDismiss}>Dismiss</button>
        </div>
      </div>
    </div>
  );
}
